import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useMemo, useRef } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { moods, useMoodChange } from './moods'
import { AMBER, archTop, COBALT, EMERALD, RUBY, WINDOW } from './roomShape'

// The view out of the window: the planet's edge and the sky, with the sun and
// moon painted into it, and stained glass round the crown of the arch. One mesh
// blending two textures, not two stacked planes: surfaces this close together
// z-fight once the scene is scaled up 100x. For the same
// reason it's a single plane inside the wall's thickness, seen through the arch.
// Room-local units.
const POSITION = [-3.86, 4.25, 0.14]
const SIZE = 5

const TEXTURE_SIZE = 512

// Grid the stained glass is laid out on, shared with the shader's glints.
const GLASS_CELLS = 40

const DAY = {
    sky: ['#9fb6bf', '#cfd5c6', '#efdcb6'],
    ground: '#a08f74',
}

const NIGHT = {
    sky: ['#0c1230', '#16204a', '#2a3360'],
    ground: '#0d1226',
}

// The planet's own edge, curving away across the window. 0 to 1, top to bottom.
const horizon = (x) => 0.8 + (x - 0.5) ** 2 * 0.3

function drawRidge(context, size, ridge, color)
{
    context.fillStyle = color
    context.beginPath()
    context.moveTo(0, size)
    for (let x = 0; x <= 1; x += 0.01) context.lineTo(x * size, ridge(x) * size)
    context.lineTo(size, size)
    context.fill()
}

// Low sun behind the hills: a glow with no hard edge, so it reads as light.
function drawSun(context, size)
{
    const [x, y] = [size * 0.3, size * 0.74]
    const glow = context.createRadialGradient(x, y, 0, x, y, size * 0.42)
    glow.addColorStop(0, 'rgba(255, 244, 214, 1)')
    glow.addColorStop(0.16, 'rgba(255, 228, 170, 0.85)')
    glow.addColorStop(1, 'rgba(255, 214, 150, 0)')
    context.fillStyle = glow
    context.fillRect(0, 0, size, size)
}

function drawMoon(context, size)
{
    const radius = size * 0.05
    const crescent = document.createElement('canvas')
    crescent.width = crescent.height = radius * 4
    const shape = crescent.getContext('2d')
    shape.fillStyle = '#efe9d4'
    shape.beginPath()
    shape.arc(radius * 2, radius * 2, radius, 0, Math.PI * 2)
    shape.fill()
    shape.globalCompositeOperation = 'destination-out'
    shape.beginPath()
    shape.arc(radius * 2.5, radius * 1.75, radius * 0.92, 0, Math.PI * 2)
    shape.fill()
    context.drawImage(crescent, size * 0.56, size * 0.4)
}

// Whether a grid cell, in 0 to 1 across the view, holds stained glass.
function isGlass(x, y)
{
    const t = ((x - 0.5) * SIZE) / WINDOW.halfWidth
    const height = POSITION[1] + SIZE / 2 - y * SIZE
    if (Math.abs(t) > 1.05) return false

    const belowArch = archTop(t) - height
    return belowArch >= -0.3 && belowArch <= 0.95
}

// Shards of coloured glass following the arch, thickest at the crown.
function drawGlass(context, size, opacity)
{
    const colours = [AMBER, RUBY, COBALT, EMERALD, AMBER, COBALT]
    const cell = size / GLASS_CELLS
    context.globalAlpha = opacity

    for (let row = 0; row < GLASS_CELLS; row++) {
        for (let column = 0; column < GLASS_CELLS; column++) {
            const x = (column + 0.5) * cell
            const y = (row + 0.5) * cell
            if (!isGlass(x / size, y / size)) continue

            context.fillStyle = colours[Math.floor(Math.random() * colours.length)]
            const jitter = () => (Math.random() - 0.5) * cell * 0.5
            context.beginPath()
            context.moveTo(x - cell * 0.7 + jitter(), y - cell * 0.7 + jitter())
            context.lineTo(x + cell * 0.7 + jitter(), y - cell * 0.7 + jitter())
            context.lineTo(x + cell * 0.7 + jitter(), y + cell * 0.7 + jitter())
            context.lineTo(x - cell * 0.7 + jitter(), y + cell * 0.7 + jitter())
            context.fill()
        }
    }

    context.globalAlpha = 1
}

// Which cells can catch the light. One pixel a cell, so the shader's glints stay
// on the glass without a second full-size texture.
function drawGlassMask()
{
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = GLASS_CELLS
    const context = canvas.getContext('2d')
    context.fillStyle = '#000'
    context.fillRect(0, 0, GLASS_CELLS, GLASS_CELLS)
    context.fillStyle = '#fff'

    for (let row = 0; row < GLASS_CELLS; row++) {
        for (let column = 0; column < GLASS_CELLS; column++) {
            if (isGlass((column + 0.5) / GLASS_CELLS, (row + 0.5) / GLASS_CELLS)) context.fillRect(column, row, 1, 1)
        }
    }

    return new CanvasTexture(canvas)
}

function drawStars(context, size)
{
    context.fillStyle = '#f2ecd8'
    for (let i = 0; i < 28; i++) {
        const star = 1.5 + Math.random() * 1.5
        context.fillRect(Math.random() * size, Math.random() * size * 0.55, star, star)
    }
}

function drawView({ sky, ground }, night)
{
    const size = TEXTURE_SIZE
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const context = canvas.getContext('2d')

    const gradient = context.createLinearGradient(0, 0, 0, size * 0.8)
    sky.forEach((color, index) => gradient.addColorStop(index / (sky.length - 1), color))
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)

    if (night) {
        drawStars(context, size)
        drawMoon(context, size)
    } else {
        drawSun(context, size)
    }

    drawRidge(context, size, horizon, ground)
    drawGlass(context, size, night ? 0.5 : 0.85)

    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 8
    return texture
}

const vertexShader = /* glsl */`
    varying vec2 vUv;

    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`

const fragmentShader = /* glsl */`
    uniform sampler2D dayView;
    uniform sampler2D nightView;
    uniform sampler2D glassMask;
    uniform float nightAmount;
    uniform float time;
    uniform float dayGlimmer;
    uniform float nightGlimmer;
    uniform float sunGlow;
    varying vec2 vUv;

    const float CELLS = ${GLASS_CELLS}.0;
    const vec2 SUN = vec2(0.3, 0.26);

    float hash(vec2 point) {
        return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
        vec4 view = mix(texture2D(dayView, vUv), texture2D(nightView, vUv), nightAmount);

        // Moonlight barely moves the glass; the sun is what makes it glimmer.
        float strength = mix(dayGlimmer, nightGlimmer, nightAmount);

        // Each shard catches the light on its own beat, under a slow band of
        // brightness crossing the arch.
        vec2 cell = vUv * CELLS;
        float phase = hash(floor(cell));
        float beat = 0.5 + 0.5 * sin(time * (0.7 + phase * 1.3) + phase * 6.283);
        float centre = 1.0 - smoothstep(0.1, 0.62, length(fract(cell) - 0.5));
        float glint = pow(beat, 14.0) * centre;
        float band = 0.5 + 0.5 * sin(time * 0.45 + (vUv.x - vUv.y) * 6.0);
        float glass = texture2D(glassMask, vUv).r;
        view.rgb *= 1.0 + glass * strength * 0.3 * band;
        view.rgb += vec3(1.0, 0.9, 0.72) * glass * strength * glint * 0.75;

        // The low sun breathes a little behind the clear panes.
        float sun = 1.0 - smoothstep(0.0, 0.42, distance(vUv, SUN));
        float breath = 0.5 + 0.3 * sin(time * 0.8) + 0.2 * sin(time * 1.9 + 1.3);
        view.rgb += vec3(1.0, 0.84, 0.6) * sun * sun * breath * sunGlow * (1.0 - nightAmount);

        gl_FragColor = view;
        #include <colorspace_fragment>
    }
`

export default function WindowView({ night })
{
    const invalidate = useThree((state) => state.invalidate)

    const uniforms = useMemo(() => ({
        dayView: { value: drawView(DAY, false) },
        nightView: { value: drawView(NIGHT, true) },
        glassMask: { value: drawGlassMask() },
        nightAmount: { value: 0 },
        time: { value: 0 },
        dayGlimmer: { value: moods.day.glassGlimmer },
        nightGlimmer: { value: moods.night.glassGlimmer },
        sunGlow: { value: moods.day.sunGlow },
    }), [])

    useEffect(() => () => {
        uniforms.dayView.value.dispose()
        uniforms.nightView.value.dispose()
        uniforms.glassMask.value.dispose()
    }, [uniforms])

    useMoodChange(() => {
        uniforms.dayGlimmer.value = moods.day.glassGlimmer
        uniforms.nightGlimmer.value = moods.night.glassGlimmer
        uniforms.sunGlow.value = moods.day.sunGlow
    })

    const still = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
    useFrame(({ clock }) => {
        if (!still) uniforms.time.value = clock.elapsedTime
    })

    const hasMounted = useRef(false)
    useEffect(() => {
        if (!hasMounted.current) {
            hasMounted.current = true
            return
        }

        const value = night ? 1 : 0

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            uniforms.nightAmount.value = value
            invalidate()
            return
        }

        const tween = gsap.to(uniforms.nightAmount, { value, duration: 1.2, ease: 'sine.inOut', onUpdate: invalidate })
        return () => tween.kill()
    }, [night])

    return (
        <mesh position={POSITION} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[SIZE, SIZE]} />
            <shaderMaterial uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} />
        </mesh>
    )
}
