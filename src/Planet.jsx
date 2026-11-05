import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { fillGrain } from './grain'
import { moods, useMoodChange } from './moods'
import { BufferAttribute, CanvasTexture, Color, LatheGeometry, Matrix4, PlaneGeometry, Quaternion, RepeatWrapping, SRGBColorSpace, Vector2, Vector3 } from 'three'

// The small world the room stands on, big enough that the frame crops it to a
// curved horizon: a whole ball in shot reads as a toy. A sphere whose top eases
// into a flat plateau, so the room sits level with no seam. Level's local units,
// with the plateau at y = 0. It has to clear the room's corners and the things
// standing beside the room. `radius` is smaller on phones, whose narrow frame
// would otherwise see no curve at all.
const PLATEAU_RADIUS = 7.4
const SHOULDER = 2
const STEPS = 72

// The surface is painted in greys around this, and tinted by the mood's colour,
// so the colour can change without repainting.
const PAPER = '#d8d8d8'
const groundTint = () => new Color(moods.planet.ground).multiplyScalar(1 / new Color(PAPER).r)

const STONE_COUNT = 26

// Three small volcanoes, two smoking and one gone out, up on the horizon where
// they read as a broken edge against the sky. On the planet's face they looked
// like spots. `along` is how far down the slope, 0 at the plateau's edge, so they
// hold their place on the phone's smaller planet.
const CRATERS = [
    { angle: 2.1, along: 0.16, size: 0.5, smoke: true },
    { angle: 2.4, along: 0.2, size: 0.36, smoke: true },
    { angle: -1.1, along: 0.18, size: 0.44, smoke: false },
]
const SMOKING = CRATERS.filter((crater) => crater.smoke)

// Up the flank to the rim, then down into the throat, as radius and height.
const CRATER_PROFILE = [[1.3, -0.3], [1.08, -0.02], [0.82, 0.22], [0.58, 0.46], [0.44, 0.6], [0.36, 0.55], [0.26, 0.34], [0.1, 0.2], [0, 0.16]]
const CRATER_HEIGHT = 0.6

// Smooth minimum: follows the lower of two heights, rounding the corner between
// them instead of creasing it.
const softMin = (a, b) => -SHOULDER * Math.log(Math.exp(-a / SHOULDER) + Math.exp(-b / SHOULDER))

const plateauHeight = (radius) => Math.sqrt(radius ** 2 - PLATEAU_RADIUS ** 2)
const topHeight = (radius) => softMin(radius, plateauHeight(radius))

// Height of the ground at a distance from the planet's axis.
const groundHeight = (radius, distance) =>
    softMin(Math.sqrt(radius ** 2 - distance ** 2), plateauHeight(radius)) - topHeight(radius)

function makeProfile(radius)
{
    const points = []

    // Bottom to top, which is the order that makes the lathe face outward.
    for (let i = 0; i <= STEPS; i++) {
        const angle = Math.PI - (i / STEPS) * Math.PI
        const height = softMin(radius * Math.cos(angle), plateauHeight(radius))
        points.push(new Vector2(radius * Math.sin(angle), height - topHeight(radius)))
    }

    return new LatheGeometry(points, 80)
}

function drawSurface()
{
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1024
    const context = canvas.getContext('2d')

    context.fillStyle = PAPER
    context.fillRect(0, 0, 1024, 1024)

    // Broad, faint tonal drifts, then a fine dry grain.
    for (let i = 0; i < 30; i++) {
        const x = Math.random() * 1024
        const y = Math.random() * 1024
        const radius = 60 + Math.random() * 180
        const tone = i % 2 ? '84, 84, 84' : '244, 244, 244'
        const drift = context.createRadialGradient(x, y, 0, x, y, radius)
        drift.addColorStop(0, `rgba(${tone}, 0.1)`)
        drift.addColorStop(1, `rgba(${tone}, 0)`)
        context.fillStyle = drift
        context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
    }

    fillGrain(context, 1024, 1024, { dark: 'rgba(58, 58, 58, 0.14)', light: 'rgba(240, 240, 240, 0.12)', dots: 9000 })

    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.wrapS = texture.wrapT = RepeatWrapping
    texture.repeat.set(3, 2)
    texture.anisotropy = 8
    return texture
}

// Scattered on the slope below the plateau. The golden angle keeps them from
// lining up; one instanced mesh keeps them to a single draw call.
function Stones({ radius })
{
    const meshRef = useRef()
    const materialRef = useRef()
    useMoodChange(() => materialRef.current.color.set(moods.planet.stone))

    useLayoutEffect(() => {
        const matrix = new Matrix4()
        const rotation = new Quaternion()
        const axis = new Vector3()

        for (let i = 0; i < STONE_COUNT; i++) {
            const angle = i * 2.39996
            const distance = PLATEAU_RADIUS - 0.4 + ((i * 0.7549) % 1) * (radius * 0.93 - PLATEAU_RADIUS)
            const size = 0.06 + ((i * 0.5698) % 1) ** 3 * 0.26

            axis.set((i * 0.31) % 1 - 0.5, (i * 0.47) % 1 - 0.5, (i * 0.73) % 1 - 0.5).normalize()
            rotation.setFromAxisAngle(axis, i)
            matrix.compose(
                new Vector3(Math.cos(angle) * distance, groundHeight(radius, distance) + size * 0.2, Math.sin(angle) * distance),
                rotation,
                new Vector3(size * 1.3, size * 0.7, size)
            )
            meshRef.current.setMatrixAt(i, matrix)
        }

        meshRef.current.instanceMatrix.needsUpdate = true
    }, [radius])

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, STONE_COUNT]}>
            <icosahedronGeometry args={[1, 0]} />
            <meshLambertMaterial ref={materialRef} color={moods.planet.stone} flatShading />
        </instancedMesh>
    )
}

// Where a spot on the slope sits, and which way a crater stands there: half way
// to the true normal, because leaning the full amount tips them at the camera.
function onSlope(radius, { angle, along })
{
    const distance = PLATEAU_RADIUS + along * (radius * 0.93 - PLATEAU_RADIUS)
    const step = 0.01
    const slope = (groundHeight(radius, distance + step) - groundHeight(radius, distance - step)) / (step * 2)
    const [x, z] = [Math.cos(angle), Math.sin(angle)]
    const lean = slope * 0.5

    return {
        position: new Vector3(x * distance, groundHeight(radius, distance), z * distance),
        normal: new Vector3(-lean * x, 1, -lean * z).normalize(),
    }
}

// A cone with a throat, its rim broken up so it reads as drawn by hand. Whole
// numbers of waves round the rim, so the lathe's seam still meets.
function makeCrater()
{
    const geometry = new LatheGeometry(CRATER_PROFILE.map(([r, y]) => new Vector2(r, y)), 40)
    const positions = geometry.attributes.position
    const colours = new Float32Array(positions.count * 3)

    for (let i = 0; i < positions.count; i++) {
        const step = i % CRATER_PROFILE.length
        const [x, y, z] = [positions.getX(i), positions.getY(i), positions.getZ(i)]
        const angle = Math.atan2(z, x)
        const ragged = Math.sin(angle * 3 + 1) + 0.7 * Math.sin(angle * 7 + 2) + 0.5 * Math.sin(angle * 13)
        const nearRim = Math.max(0, 1 - Math.abs(y - CRATER_HEIGHT) / 0.4)

        positions.setY(i, y + ragged * nearRim * 0.045)
        const wider = 1 + ragged * 0.02
        positions.setX(i, x * wider)
        positions.setZ(i, z * wider)

        // Shades of the ground's colour. The foot matches it exactly, so a cone
        // rises out of the planet rather than sitting on it.
        const shade = step > 4 ? 0.12 : step < 2 ? 1 - step * 0.1 : 0.85 + (step - 2) * 0.25
        colours.fill(shade, i * 3, i * 3 + 3)
    }

    geometry.setAttribute('color', new BufferAttribute(colours, 3))
    geometry.computeVertexNormals()
    return geometry
}

function Craters({ radius })
{
    const meshRef = useRef()
    const materialRef = useRef()
    useMoodChange(() => materialRef.current.color.set(moods.planet.ground))
    const geometry = useMemo(makeCrater, [])
    useEffect(() => () => geometry.dispose(), [geometry])

    useLayoutEffect(() => {
        const matrix = new Matrix4()
        const upright = new Quaternion()
        const turn = new Quaternion()
        const up = new Vector3(0, 1, 0)

        CRATERS.forEach((crater, index) => {
            const { position, normal } = onSlope(radius, crater)
            upright.setFromUnitVectors(up, normal)
            turn.setFromAxisAngle(up, index * 2.1)
            matrix.compose(position, upright.multiply(turn), new Vector3(crater.size, crater.size, crater.size))
            meshRef.current.setMatrixAt(index, matrix)
        })

        meshRef.current.instanceMatrix.needsUpdate = true
    }, [radius])

    return (
        <instancedMesh ref={meshRef} args={[geometry, undefined, CRATERS.length]} frustumCulled={false}>
            <meshLambertMaterial ref={materialRef} color={moods.planet.ground} vertexColors />
        </instancedMesh>
    )
}

// Each wisp faces the camera from its crater's mouth, so it stays a thin drawn
// line from any angle.
const smokeVertexShader = /* glsl */`
    uniform float time;
    varying vec2 vUv;

    void main() {
        vUv = uv;
        mat4 placed = modelViewMatrix * instanceMatrix;
        vec2 size = vec2(length(placed[0].xyz), length(placed[1].xyz));
        float seed = instanceMatrix[3].x;
        float sway = sin(uv.y * 4.0 - time * 0.7 + seed) * uv.y * 0.9 - uv.y * uv.y * 1.6;

        vec4 mouth = placed * vec4(0.0, 0.0, 0.0, 1.0);
        mouth.xy += vec2(uv.x - 0.5 + sway, uv.y) * size;
        gl_Position = projectionMatrix * mouth;
    }
`

const smokeFragmentShader = /* glsl */`
    uniform vec3 colour;
    varying vec2 vUv;

    void main() {
        float halfWidth = mix(0.5, 0.08, vUv.y);
        float line = 1.0 - smoothstep(halfWidth * 0.4, halfWidth, abs(vUv.x - 0.5));
        float fade = smoothstep(0.0, 0.06, vUv.y) * (1.0 - vUv.y);
        gl_FragColor = vec4(colour, line * fade * 0.7);
        #include <colorspace_fragment>
    }
`

function Smoke({ radius })
{
    const meshRef = useRef()
    const geometry = useMemo(() => new PlaneGeometry(1, 1, 1, 14), [])
    useEffect(() => () => geometry.dispose(), [geometry])

    const uniforms = useMemo(() => ({
        colour: { value: new Color('#ece6d8') },
        time: { value: 0 },
    }), [])

    const still = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
    useFrame(({ clock }) => {
        if (!still) uniforms.time.value = clock.elapsedTime
    })

    useLayoutEffect(() => {
        const matrix = new Matrix4()

        SMOKING.forEach((crater, index) => {
            const { position, normal } = onSlope(radius, crater)
            position.addScaledVector(normal, crater.size * CRATER_HEIGHT * 0.8)
            matrix.makeScale(crater.size * 0.34, crater.size * 3, 1).setPosition(position)
            meshRef.current.setMatrixAt(index, matrix)
        })

        meshRef.current.instanceMatrix.needsUpdate = true
    }, [radius])

    return (
        <instancedMesh ref={meshRef} args={[geometry, undefined, SMOKING.length]} frustumCulled={false}>
            <shaderMaterial
                uniforms={uniforms}
                vertexShader={smokeVertexShader}
                fragmentShader={smokeFragmentShader}
                transparent
                depthWrite={false}
            />
        </instancedMesh>
    )
}

export default function Planet({ radius })
{
    const geometry = useMemo(() => makeProfile(radius), [radius])
    const surface = useMemo(drawSurface, [])
    const materialRef = useRef()
    useMoodChange(() => materialRef.current.color.copy(groundTint()))

    useEffect(() => () => {
        geometry.dispose()
        surface.dispose()
    }, [geometry, surface])

    return <>
        <mesh geometry={geometry}>
            {/* Lambert: it covers a third of the screen, and matte ground gains
                nothing from a physically based shader. */}
            <meshLambertMaterial ref={materialRef} map={surface} color={groundTint()} />
        </mesh>
        <Stones radius={radius} />
        <Craters radius={radius} />
        <Smoke radius={radius} />
    </>
}
