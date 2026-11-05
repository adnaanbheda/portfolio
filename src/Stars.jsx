import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Vector3 } from 'three'

// A field of soft stars behind the room, square to the default view. Keep CAMERA
// in sync with the Canvas camera in index.jsx. Always mounted at opacity 0 by
// day, so turning them on doesn't change the scene's shaders.
const CAMERA = new Vector3(-300, 150, 400)
const DISTANCE = 1500

const COUNT = 130
const SPREAD = [1500, 800]

function makeStars()
{
    const [width, height] = SPREAD
    const positions = []
    const sizes = []
    const phases = []

    for (let i = 0; i < COUNT; i++) {
        positions.push((Math.random() - 0.5) * 2 * width, (Math.random() - 0.5) * 2 * height, 0)
        // Mostly faint, a few bright enough to carry spikes.
        sizes.push(i % 16 === 0 ? 20 + Math.random() * 8 : 2 + Math.random() * 3)
        phases.push(Math.random() * Math.PI * 2)
    }

    return new BufferGeometry()
        .setAttribute('position', new Float32BufferAttribute(positions, 3))
        .setAttribute('size', new Float32BufferAttribute(sizes, 1))
        .setAttribute('phase', new Float32BufferAttribute(phases, 1))
}

const vertexShader = /* glsl */`
    attribute float size;
    attribute float phase;
    uniform float time;
    uniform float pixelRatio;
    varying float vTwinkle;
    varying float vBright;

    void main() {
        vTwinkle = 0.72 + 0.28 * sin(time * 0.9 + phase);
        vBright = step(12.0, size);
        gl_PointSize = size * pixelRatio;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`

const fragmentShader = /* glsl */`
    uniform float opacity;
    varying float vTwinkle;
    varying float vBright;

    void main() {
        vec2 p = abs(gl_PointCoord - 0.5) * 2.0;
        float core = exp(-dot(p, p) * mix(5.0, 40.0, vBright));
        float spikes = exp(-p.x * 30.0) * exp(-p.y * 4.0) + exp(-p.y * 30.0) * exp(-p.x * 4.0);
        float light = core + spikes * vBright * 0.7;
        gl_FragColor = vec4(vec3(0.96, 0.93, 0.85), light * vTwinkle * opacity);
        #include <colorspace_fragment>
    }
`

export default function Stars({ night })
{
    const invalidate = useThree((state) => state.invalidate)
    const pixelRatio = useThree((state) => state.viewport.dpr)
    const pointsRef = useRef()
    const geometry = useMemo(makeStars, [])

    const uniforms = useMemo(() => ({
        time: { value: 0 },
        opacity: { value: 0 },
        pixelRatio: { value: 1 },
    }), [])

    useEffect(() => () => geometry.dispose(), [geometry])
    useEffect(() => { uniforms.pixelRatio.value = pixelRatio }, [pixelRatio])

    useLayoutEffect(() => {
        const view = new Vector3().sub(CAMERA).normalize()
        pointsRef.current.position.copy(CAMERA).addScaledVector(view, DISTANCE)
        pointsRef.current.lookAt(CAMERA)
    }, [])

    useFrame((state) => {
        uniforms.time.value = state.clock.elapsedTime
    })

    const hasMounted = useRef(false)
    useEffect(() => {
        if (!hasMounted.current) {
            hasMounted.current = true
            return
        }

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const tween = gsap.to(uniforms.opacity, {
            value: night ? 1 : 0,
            duration: reducedMotion ? 0 : 1.2,
            delay: night && !reducedMotion ? 0.5 : 0,
            ease: 'sine.inOut',
            onUpdate: invalidate,
        })
        return () => tween.kill()
    }, [night])

    return (
        <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
            <shaderMaterial
                uniforms={uniforms}
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                transparent
                blending={AdditiveBlending}
                depthWrite={false}
            />
        </points>
    )
}
