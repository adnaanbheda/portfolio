import { useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useMemo, useRef } from 'react'
import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three'
import { fillGrain } from './grain'
import { moods } from './moods'

// The sky: a watercolour wash, painted once per mood at load and cross-faded on
// the GPU. A screen-filling quad behind everything, so it doesn't move with the
// camera, the way paper wouldn't.
const smallScreen = () => window.innerWidth < 768

function paintWash({ wash, blooms })
{
    // Painted in the screen's shape, because the quad fills the screen: a square
    // wash stretched its grain into streaks on a tall phone. Same pixel count
    // either way, so this costs no more.
    const SIZE = smallScreen() ? 512 : 1024
    const aspect = window.innerWidth / window.innerHeight
    const width = Math.round(SIZE * Math.sqrt(aspect))
    const height = Math.round(SIZE / Math.sqrt(aspect))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')

    const gradient = context.createLinearGradient(0, 0, 0, height)
    wash.forEach((color, index) => gradient.addColorStop(index / (wash.length - 1), color))
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)

    // Pigment pooling: wide, faint blooms laid over one another.
    for (let i = 0; i < 44; i++) {
        const x = Math.random() * width
        const y = Math.random() * height
        const radius = (0.1 + Math.random() * 0.25) * SIZE
        const bloom = context.createRadialGradient(x, y, 0, x, y, radius)
        bloom.addColorStop(0, blooms[i % 2])
        bloom.addColorStop(1, blooms[i % 2].replace(/[\d.]+\)$/, '0)'))
        context.fillStyle = bloom
        context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
    }

    // Paper tooth.
    fillGrain(context, width, height, { dark: 'rgba(0, 0, 0, 0.03)', light: 'rgba(255, 255, 255, 0.03)' })

    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    // Seen once, at about screen size: mipmaps would only cost memory.
    texture.generateMipmaps = false
    texture.minFilter = LinearFilter
    return texture
}

const vertexShader = /* glsl */`
    varying vec2 vUv;

    void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 1.0, 1.0);
    }
`

const fragmentShader = /* glsl */`
    uniform sampler2D dayWash;
    uniform sampler2D sunsetWash;
    uniform sampler2D nightWash;
    uniform float sunsetAmount;
    uniform float nightAmount;
    varying vec2 vUv;

    void main() {
        vec4 day = mix(texture2D(dayWash, vUv), texture2D(sunsetWash, vUv), sunsetAmount);
        gl_FragColor = mix(day, texture2D(nightWash, vUv), nightAmount);
        #include <colorspace_fragment>
    }
`

export default function Backdrop({ night, sunset })
{
    const invalidate = useThree((state) => state.invalidate)

    const uniforms = useMemo(() => ({
        dayWash: { value: paintWash(moods.sky.day) },
        sunsetWash: { value: paintWash(moods.sky.sunset) },
        nightWash: { value: paintWash(moods.sky.night) },
        sunsetAmount: { value: 0 },
        nightAmount: { value: 0 },
    }), [])

    useEffect(() => () => {
        uniforms.dayWash.value.dispose()
        uniforms.sunsetWash.value.dispose()
        uniforms.nightWash.value.dispose()
    }, [uniforms])

    const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const nightMounted = useRef(false)
    useEffect(() => {
        if (!nightMounted.current) {
            nightMounted.current = true
            return
        }

        // A sunset ends in night, so its colour clears once night has covered it.
        const timeline = gsap.timeline({ onUpdate: invalidate })
            .to(uniforms.nightAmount, { value: night ? 1 : 0, duration: reducedMotion() ? 0 : 1.2, ease: 'sine.inOut' })
            .set(uniforms.sunsetAmount, { value: 0 })
        return () => timeline.kill()
    }, [night])

    useEffect(() => {
        if (!sunset) return

        const tween = gsap.to(uniforms.sunsetAmount, {
            value: 1,
            duration: reducedMotion() ? 0 : 2.6,
            ease: 'sine.inOut',
            onUpdate: invalidate,
        })
        return () => tween.kill()
    }, [sunset])

    return (
        <mesh frustumCulled={false} renderOrder={-1000}>
            <planeGeometry args={[2, 2]} />
            <shaderMaterial
                uniforms={uniforms}
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                depthTest={false}
                depthWrite={false}
            />
        </mesh>
    )
}
