import { useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { Color } from 'three'

// The room's two moods. Day: the sky fills everything and the warm key from the
// camera's side separates the two walls. Night: both drop low and the lamp does
// the work, so the room stays warm instead of going dark and screen-lit.
const DAY = {
    sky: new Color('#9db4b8'),
    fill: 1.7,
    key: 1.1,
}

const NIGHT = {
    sky: new Color('#1d2440'),
    fill: 0.5,
    key: 0.12,
}

export default function Lighting({ night })
{
    const invalidate = useThree((state) => state.invalidate)
    const skyRef = useRef()
    const fillRef = useRef()
    const keyRef = useRef()

    const apply = (from, to, amount) => {
        skyRef.current.lerpColors(from.sky, to.sky, amount)
        fillRef.current.intensity = from.fill + (to.fill - from.fill) * amount
        keyRef.current.intensity = from.key + (to.key - from.key) * amount
    }

    useLayoutEffect(() => apply(DAY, DAY, 1), [])

    const hasMounted = useRef(false)
    useEffect(() => {
        if (!hasMounted.current) {
            hasMounted.current = true
            return
        }

        const from = night ? DAY : NIGHT
        const to = night ? NIGHT : DAY

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            apply(from, to, 1)
            invalidate()
            return
        }

        const progress = { amount: 0 }
        const tween = gsap.to(progress, {
            amount: 1,
            duration: 1.2,
            ease: 'sine.inOut',
            onUpdate: () => {
                apply(from, to, progress.amount)
                invalidate()
            },
        })
        return () => tween.kill()
    }, [night])

    return <>
        <color ref={skyRef} attach="background" args={[ DAY.sky ]} />
        <hemisphereLight ref={fillRef} args={[ '#fff1dc', '#9c7a58', DAY.fill ]} />
        <directionalLight ref={keyRef} position={[ -300, 350, 400 ]} color="#ffdcb0" intensity={DAY.key} />
    </>
}
