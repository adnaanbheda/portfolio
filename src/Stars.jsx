import { useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three'

// A flat field of stars behind the room, square to the default view. Keep CAMERA
// in sync with the Canvas camera in index.jsx. Always mounted at opacity 0 by day,
// so turning them on doesn't change the scene's shaders.
const CAMERA = new Vector3(-300, 150, 400)
const DISTANCE = 1500

const COUNT = 90
const SPREAD = [1500, 800]
const OPACITY = 0.7

function makeStars()
{
    const [width, height] = SPREAD
    const positions = []
    for (let i = 0; i < COUNT; i++) {
        positions.push((Math.random() - 0.5) * 2 * width, (Math.random() - 0.5) * 2 * height, 0)
    }
    return new BufferGeometry().setAttribute('position', new Float32BufferAttribute(positions, 3))
}

export default function Stars({ night })
{
    const invalidate = useThree((state) => state.invalidate)
    const pointsRef = useRef()
    const materialRef = useRef()
    const geometry = useMemo(makeStars, [])

    useEffect(() => () => geometry.dispose(), [geometry])

    useLayoutEffect(() => {
        const view = new Vector3().sub(CAMERA).normalize()
        pointsRef.current.position.copy(CAMERA).addScaledVector(view, DISTANCE)
        pointsRef.current.lookAt(CAMERA)
    }, [])

    const hasMounted = useRef(false)
    useEffect(() => {
        if (!hasMounted.current) {
            hasMounted.current = true
            return
        }

        const opacity = night ? OPACITY : 0

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            materialRef.current.opacity = opacity
            invalidate()
            return
        }

        const tween = gsap.to(materialRef.current, { opacity, duration: 1.2, ease: 'sine.inOut', delay: night ? 0.5 : 0, onUpdate: invalidate })
        return () => tween.kill()
    }, [night])

    return (
        <points ref={pointsRef} geometry={geometry}>
            <pointsMaterial ref={materialRef} color="#f2ecd8" size={1.8} sizeAttenuation={false} transparent opacity={0} depthWrite={false} toneMapped={false} />
        </points>
    )
}
