import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BufferGeometry, CanvasTexture, DoubleSide, Float32BufferAttribute, SRGBColorSpace } from 'three'
import { moods, useMoodChange } from './moods'
import { AMBER, archTop, COBALT, EMERALD, FLOOR_Y, RUBY, WINDOW } from './roomShape'

// Sunlight through the window, landing on the floor, coloured by the stained
// glass. Real lights wouldn't take the arch's shape without shadow maps; this is
// that shape, worked out from the window and drawn straight onto the floor.
//
// Room-local units: the room spans about -4..4 in x and z. Window shape comes from
// roomShape.js.
const ROOM_HALF = 5
const PANE_X = -3.6
const SUN_DIRECTION = [1, -1.15, 0.42]

const TEXTURE_SIZE = 512

// Where the window's middle sits along z.
const WINDOW_Z = 0.14

// Heights the beams leave from, 0 at the sill and 1 at the arch's crown, and how
// much of the window's width they fill.
const SHAFT_HEIGHTS = [0.12, 0.34, 0.56, 0.76]
const SHAFT_WIDTH = 0.92

function onFloor(y, z)
{
    const [dx, dy, dz] = SUN_DIRECTION
    const distance = (FLOOR_Y - y) / dy
    return [PANE_X + dx * distance, z + dz * distance]
}

function drawPatch()
{
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = TEXTURE_SIZE
    const context = canvas.getContext('2d')
    const toPixels = (value) => (value + ROOM_HALF) / (ROOM_HALF * 2) * TEXTURE_SIZE
    const project = (t, height) => {
        const [x, z] = onFloor(height, WINDOW_Z - t * WINDOW.halfWidth)
        return [toPixels(x), toPixels(z)]
    }

    const trace = (edge) => {
        context.beginPath()
        for (let i = 0; i <= 32; i++) {
            const t = -1 + (i / 32) * 2
            context.lineTo(...project(t, edge(t)))
        }
        for (let i = 32; i >= 0; i--) {
            const t = -1 + (i / 32) * 2
            context.lineTo(...project(t, WINDOW.sill))
        }
        context.fill()
    }

    // Safari has no canvas filter and just gets harder edges, which still read
    // as sunlight.
    context.filter = 'blur(4px)'

    // The clear lower window, then the stained crown laid over it in bands: the
    // glass colours the light it lets through.
    context.fillStyle = '#ffc98a'
    trace(archTop)

    const bands = [AMBER, RUBY, COBALT, EMERALD]
    bands.forEach((colour, index) => {
        context.fillStyle = colour
        const inner = (t) => archTop(t) - 1.1 + index * 0.27
        const outer = (t) => inner(t) + 0.27
        context.beginPath()
        for (let i = 0; i <= 32; i++) {
            const t = -1 + (i / 32) * 2
            context.lineTo(...project(t, outer(t)))
        }
        for (let i = 32; i >= 0; i--) {
            const t = -1 + (i / 32) * 2
            context.lineTo(...project(t, Math.max(inner(t), WINDOW.sill)))
        }
        context.fill()
    })

    // The tracery's shadow.
    context.globalCompositeOperation = 'destination-out'
    context.strokeStyle = '#000'
    context.lineWidth = 7
    context.beginPath()
    context.moveTo(...project(0, WINDOW.sill))
    context.lineTo(...project(0, archTop(0)))
    context.moveTo(...project(-1, WINDOW.sill + 2.2))
    context.lineTo(...project(1, WINDOW.sill + 2.2))
    context.stroke()

    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    return texture
}

// Sunbeams from the window down to the patch. Sheets at a few heights in the
// window, each running along the sun's direction: flat quads, because real
// volumetric light would cost far more than this scene can spare. They slant
// across the room rather than standing upright, which from the default camera
// would put them edge-on, the sun being almost behind it.
function makeShafts()
{
    const positions = []
    const beams = []
    const indices = []

    SHAFT_HEIGHTS.forEach((fraction, sheet) => {
        const height = WINDOW.sill + (WINDOW.apex - WINDOW.sill) * fraction
        const reach = Math.sqrt(1 - fraction) * SHAFT_WIDTH

        for (const t of [-reach, reach]) {
            const z = WINDOW_Z - t * WINDOW.halfWidth
            const [floorX, floorZ] = onFloor(height, z)
            const across = Math.sign(t)
            positions.push(PANE_X, height, z, floorX, FLOOR_Y + 0.05, floorZ)
            beams.push(z, 0, across, z, 1, across)
        }

        const first = sheet * 4
        indices.push(first, first + 1, first + 2, first + 1, first + 3, first + 2)
    })

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setAttribute('beam', new Float32BufferAttribute(beams, 3))
    geometry.setIndex(indices)
    return geometry
}

// Brighter and dimmer rays, by where a beam left the window. Sines, not noise
// lookups, to stay cheap.
const rays = /* glsl */`
    float rays(float pane, float time) {
        float light = sin(pane * 5.1 + time * 0.35)
            + sin(pane * 9.7 - time * 0.5 + 1.3)
            + 0.6 * sin(pane * 17.3 + time * 0.8 + 2.1);
        return smoothstep(-0.2, 1.7, light);
    }
`

const patchVertexShader = /* glsl */`
    varying vec2 vUv;

    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`

// Old glass is uneven, so the light it throws never sits still: the patch's edge
// wavers, and a web of brighter ripples drifts across it.
const patchFragmentShader = /* glsl */`
    uniform sampler2D map;
    uniform float floorLight;
    uniform float saturation;
    uniform float sun;
    uniform float time;
    varying vec2 vUv;

    void main() {
        vec2 waver = vec2(sin(vUv.y * 70.0 + time * 0.9), sin(vUv.x * 60.0 - time * 0.7));
        vec4 light = texture2D(map, vUv + waver * 0.0028);

        vec2 point = vUv * 85.0;
        float a = sin(point.x + time * 0.8 + 1.7 * sin(point.y * 0.8 - time * 0.45));
        float b = sin(point.y * 1.2 - time * 0.65 + 1.7 * sin(point.x * 0.9 + time * 0.35));
        float web = pow(1.0 - abs(a + b) * 0.5, 3.0);

        vec3 colour = light.rgb * (0.82 + web * 0.75);
        float grey = dot(colour, vec3(0.2126, 0.7152, 0.0722));
        colour = max(mix(vec3(grey), colour, saturation), 0.0);

        gl_FragColor = vec4(colour, light.a * floorLight * sun);
        #include <colorspace_fragment>
    }
`

const shaftVertexShader = /* glsl */`
    attribute vec3 beam;
    varying vec3 vBeam;

    void main() {
        vBeam = beam;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`

const shaftFragmentShader = /* glsl */`
    uniform float beams;
    uniform float sun;
    uniform float time;
    varying vec3 vBeam;

    ${rays}

    float hash(vec2 point) {
        return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
        float pane = vBeam.x;
        float along = vBeam.y;
        float ray = rays(pane, time);

        float reach = smoothstep(0.03, 0.32, along) * (1.0 - smoothstep(0.82, 1.0, along));
        float sides = 1.0 - smoothstep(0.55, 1.0, abs(vBeam.z));

        // Dust turning in the light, sinking slowly down the beam.
        vec2 grid = vec2(pane * 26.0, along * 34.0 - time * 0.12);
        float seed = hash(floor(grid));
        float twinkle = pow(0.5 + 0.5 * sin(time * (0.8 + seed * 1.6) + seed * 6.283), 10.0);
        float mote = (1.0 - smoothstep(0.05, 0.3, length(fract(grid) - 0.5))) * step(0.72, seed) * twinkle;

        float strength = (0.055 + ray * 0.03 + mote * 0.14) * reach * sides;
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.62), strength * beams * sun);
        #include <colorspace_fragment>
    }
`

export default function SunPatch({ night })
{
    const uniforms = useMemo(() => ({
        map: { value: drawPatch() },
        floorLight: { value: moods.day.floorLight },
        saturation: { value: moods.day.floorSaturation },
        beams: { value: moods.day.beams },
        sun: { value: night ? 0 : 1 },
        time: { value: 0 },
    }), [])
    const shafts = useMemo(makeShafts, [])
    useEffect(() => () => {
        uniforms.map.value.dispose()
        shafts.dispose()
    }, [uniforms, shafts])

    const invalidate = useThree((state) => state.invalidate)
    const sunlightRef = useRef()

    const still = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
    useFrame(({ clock }) => {
        if (!still) uniforms.time.value = clock.elapsedTime
        // No sun at night, so nothing to draw.
        sunlightRef.current.visible = uniforms.sun.value > 0
    })

    useMoodChange(() => {
        uniforms.floorLight.value = moods.day.floorLight
        uniforms.saturation.value = moods.day.floorSaturation
        uniforms.beams.value = moods.day.beams
    })

    const hasMounted = useRef(false)
    useEffect(() => {
        if (!hasMounted.current) {
            hasMounted.current = true
            return
        }

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const tween = gsap.to(uniforms.sun, {
            value: night ? 0 : 1,
            duration: reducedMotion ? 0 : 1.2,
            ease: 'sine.inOut',
            onUpdate: invalidate,
        })
        return () => tween.kill()
    }, [night])

    return <group ref={sunlightRef}>
        {/* Texture +x/+z run along the canvas's right/down, which is what a plane
            laid flat by this rotation shows with its v axis flipped back. */}
        <mesh position={[0, FLOOR_Y + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[ROOM_HALF * 2, ROOM_HALF * 2]} />
            <shaderMaterial
                uniforms={uniforms}
                vertexShader={patchVertexShader}
                fragmentShader={patchFragmentShader}
                transparent
                blending={AdditiveBlending}
                depthWrite={false}
            />
        </mesh>
        <mesh geometry={shafts}>
            <shaderMaterial
                uniforms={uniforms}
                vertexShader={shaftVertexShader}
                fragmentShader={shaftFragmentShader}
                transparent
                blending={AdditiveBlending}
                depthWrite={false}
                side={DoubleSide}
            />
        </mesh>
    </group>
}
