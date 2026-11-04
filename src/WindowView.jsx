import { useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useMemo, useRef } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'

// The view out of the window: the same hills by day and night, with the sun and
// moon painted into it. One mesh blending two textures, not two stacked planes:
// surfaces this close together z-fight once the scene is scaled up 100x. For the
// same reason level.glb's solid pane is hidden, in Level.jsx. Sits behind the
// frame's crossbars, so the frame still draws over it. Level's local units.
const POSITION = [-3.63, 4.59, 0.14]
const SIZE = 4.5

const TEXTURE_SIZE = 512

const DAY = {
    sky: ['#a9cdd8', '#d9e0c8', '#f9d9a0'],
    far: '#a8b98a',
    near: '#7d9a68',
}

const NIGHT = {
    sky: ['#0c1430', '#17224a', '#2c3a6b'],
    far: '#18233f',
    near: '#0f172c',
}

// Height of each ridge at a point across the window, 0 to 1.
const farRidge = (x) => 0.66 + Math.sin(x * 5.2 + 1) * 0.04 + Math.sin(x * 11) * 0.015
const nearRidge = (x) => 0.78 + Math.sin(x * 3.4 + 2.4) * 0.05 + Math.sin(x * 8.5) * 0.012

const HOUSES = [[0.2, 0.012], [0.27, 0.01], [0.61, 0.012], [0.78, 0.01], [0.83, 0.012]]

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
    const [x, y] = [size * 0.3, size * 0.62]
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
    context.drawImage(crescent, size * 0.68, size * 0.1)
}

function drawStars(context, size)
{
    context.fillStyle = '#f2ecd8'
    for (let i = 0; i < 28; i++) {
        const star = 1.5 + Math.random() * 1.5
        context.fillRect(Math.random() * size, Math.random() * size * 0.55, star, star)
    }
}

function drawView({ sky, far, near }, night)
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

    drawRidge(context, size, farRidge, far)
    drawRidge(context, size, nearRidge, near)

    if (night) {
        context.fillStyle = '#f0b64a'
        for (const [x, width] of HOUSES) {
            context.fillRect(x * size, (nearRidge(x) + 0.03) * size, width * size, width * size)
        }
    }

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
    uniform float nightAmount;
    varying vec2 vUv;

    void main() {
        gl_FragColor = mix(texture2D(dayView, vUv), texture2D(nightView, vUv), nightAmount);
        #include <colorspace_fragment>
    }
`

export default function WindowView({ night })
{
    const invalidate = useThree((state) => state.invalidate)

    const uniforms = useMemo(() => ({
        dayView: { value: drawView(DAY, false) },
        nightView: { value: drawView(NIGHT, true) },
        nightAmount: { value: 0 },
    }), [])

    useEffect(() => () => {
        uniforms.dayView.value.dispose()
        uniforms.nightView.value.dispose()
    }, [uniforms])

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
