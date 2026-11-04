import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BoxGeometry, Color, CylinderGeometry, DoubleSide, TorusGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Small props on the desk, built from primitives rather than loaded as models.
// Everything sits in one merged mesh with vertex colours, so the lot costs one
// draw call instead of one per part. That matters twice over here, because the
// monitor's reflector redraws the scene as well.
//
// Coordinates are the desk's own: -x is the front edge, the side the monitor
// faces. z runs along the desk, and y is measured up from the desktop.
const DESKTOP_Y = 0.867

const KEYBOARD = { x: -0.3, z: 0 }
// Beside the monitor rather than in front of it: its screen is DOM layered over
// the canvas, so nothing in the scene can draw across it, steam included.
const MUG = { x: -0.1, z: 0.6 }
const PI = { x: -0.3, z: -0.4 }

function paint(geometry, hex)
{
    const { r, g, b } = new Color(hex)
    const count = geometry.attributes.position.count
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) colors.set([r, g, b], i * 3)
    geometry.setAttribute('color', geometry.attributes.position.clone())
    geometry.attributes.color.array.set(colors)
    return geometry
}

function box(width, height, depth, x, y, z, color)
{
    return paint(new BoxGeometry(width, height, depth).translate(x, y, z), color)
}

function keyboard({ x, z })
{
    const parts = [box(0.15, 0.016, 0.44, x, 0.008, z, '#1b1b20')]

    const KEY = 0.0235
    const GAP = 0.0275
    const rows = 5
    const columns = 15
    for (let row = 0; row < rows - 1; row++) {
        for (let column = 0; column < columns; column++) {
            const accent = (row === 0 && column === 0) || (row === 3 && column === columns - 1)
            parts.push(box(
                KEY, 0.009, KEY,
                x + 0.055 - row * GAP, 0.02, z - 0.1925 + column * GAP,
                accent ? '#e7a60b' : '#c9c9d2',
            ))
        }
    }
    // Space bar row.
    parts.push(box(KEY, 0.009, 0.17, x - 0.055, 0.02, z, '#c9c9d2'))
    parts.push(box(KEY, 0.009, 0.07, x - 0.055, 0.02, z - 0.14, '#8f8f9a'))
    parts.push(box(KEY, 0.009, 0.07, x - 0.055, 0.02, z + 0.14, '#8f8f9a'))
    return parts
}

function mug({ x, z })
{
    const HEIGHT = 0.1
    return [
        paint(new CylinderGeometry(0.04, 0.036, HEIGHT, 16).translate(x, HEIGHT / 2, z), '#e8e2d4'),
        paint(new CylinderGeometry(0.035, 0.035, 0.002, 16).translate(x, HEIGHT + 0.001, z), '#2e1b10'),
        paint(new TorusGeometry(0.024, 0.006, 6, 12).translate(x, HEIGHT / 2, z + 0.042), '#e8e2d4'),
    ]
}

function raspberryPi({ x, z })
{
    return [
        box(0.1, 0.006, 0.15, x, 0.012, z, '#17693d'),
        box(0.035, 0.006, 0.035, x - 0.005, 0.018, z - 0.01, '#16161a'),
        box(0.018, 0.005, 0.03, x + 0.02, 0.0175, z + 0.03, '#16161a'),
        // USB and ethernet along the short edge, GPIO header along the back.
        box(0.03, 0.02, 0.028, x - 0.03, 0.025, z + 0.062, '#b9bcc2'),
        box(0.03, 0.02, 0.028, x + 0.005, 0.025, z + 0.062, '#b9bcc2'),
        box(0.03, 0.02, 0.028, x + 0.04, 0.025, z + 0.062, '#b9bcc2'),
        box(0.008, 0.01, 0.1, x - 0.042, 0.02, z - 0.015, '#111114'),
        // Power LED. The activity LED beside it is its own mesh so it can blink.
        box(0.006, 0.004, 0.006, x + 0.042, 0.017, z - 0.068, '#ff3b30'),
    ]
}

const STEAM_NOISE = /* glsl */ `
    float hash(vec2 p)
    {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p)
    {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
        );
    }
`

const STEAM_VERTEX = /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;
    ${ STEAM_NOISE }

    void main()
    {
        vUv = uv;
        vec3 bent = position;

        // Slow drift that grows with height: the base stays on the mug while
        // the top wanders, which is what makes it read as rising air.
        float drift = noise(vec2(uTime * 0.25, uv.y * 1.6 - uTime * 0.35)) - 0.5;
        bent.x += drift * uv.y * uv.y * 0.11;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(bent, 1.0);
    }
`

const STEAM_FRAGMENT = /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;
    ${ STEAM_NOISE }

    void main()
    {
        float y = vUv.y;
        float t = uTime;

        // Two strands, each following its own wandering line. They start
        // together over the coffee and curl apart as they rise.
        float line1 = 0.5 + (noise(vec2(y * 2.2 - t * 0.45, 1.7)) - 0.5) * 0.55 * y + sin(y * 7.0 - t * 1.1) * 0.05 * y;
        float line2 = 0.5 + (noise(vec2(y * 1.8 - t * 0.38, 9.2)) - 0.5) * 0.7 * y - sin(y * 6.0 - t * 0.9) * 0.06 * y;

        // Gaussian falloff, so a strand has no edge at all. Each one spreads
        // and thins out as it climbs.
        float width = mix(0.035, 0.17, y);
        float d1 = (vUv.x - line1) / width;
        float d2 = (vUv.x - line2) / (width * 0.8);
        float strands = max(exp(-d1 * d1), exp(-d2 * d2) * 0.8);

        // Noise rising through the strands breaks them into wisps. It only
        // thins them, so there is always some steam on screen.
        vec2 p = vec2(vUv.x * 5.0, y * 4.0 - t * 0.5);
        float breakup = noise(p) * 0.65 + noise(p * 2.3 + 5.0) * 0.35;
        breakup = mix(0.35, 1.0, smoothstep(0.25, 0.7, breakup));

        // Fades in just above the coffee, and has dissolved by the top.
        float height = smoothstep(0.0, 0.08, y) * (1.0 - smoothstep(0.3, 0.95, y));

        gl_FragColor = vec4(0.97, 0.95, 0.91, strands * breakup * height * 0.5);
    }
`

// Vapour isn't particles: it's one soft sheet of scrolling noise, so this is a
// single upright plane that turns to face the camera. Normal blending rather
// than additive, which would wash out against the daylit wall.
function Steam({ x, z })
{
    const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
    const still = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

    useFrame(({ clock }) => {
        if (!still) uniforms.uTime.value = clock.elapsedTime
    })

    return <Billboard position={ [ x, 0.1, z ] } lockX lockZ>
        <mesh position-y={ 0.17 }>
            <planeGeometry args={ [ 0.2, 0.34, 1, 24 ] } />
            <shaderMaterial
                uniforms={ uniforms }
                vertexShader={ STEAM_VERTEX }
                fragmentShader={ STEAM_FRAGMENT }
                transparent
                depthWrite={ false }
                side={ DoubleSide }
            />
        </mesh>
    </Billboard>
}

export default function DeskProps()
{
    const activityLed = useRef()

    const geometry = useMemo(() => mergeGeometries([
        ...keyboard(KEYBOARD),
        ...mug(MUG),
        ...raspberryPi(PI),
    ]), [])

    // Two sines at odd rates flicker unevenly, like real disk activity.
    useFrame(({ clock }) => {
        const t = clock.elapsedTime
        const on = Math.sin(t * 9) + Math.sin(t * 3.7) > 0
        if (activityLed.current.visible !== on) activityLed.current.visible = on
    })

    return <group position-y={ DESKTOP_Y }>
        <mesh geometry={ geometry }>
            <meshStandardMaterial vertexColors roughness={ 0.55 } />
        </mesh>

        <mesh ref={ activityLed } position={ [ PI.x + 0.042, 0.017, PI.z - 0.056 ] }>
            <boxGeometry args={ [ 0.006, 0.004, 0.006 ] } />
            <meshBasicMaterial color="#39ff7a" />
        </mesh>

        <Steam { ...MUG } />
    </group>
}
