import { useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { moods, useMoodChange } from './moods'

// The room's two moods, with their values in moods.json. Day: the sky fills
// everything and the warm key from the camera's side separates the two walls.
// Night: both drop low and the street lamp does the work, so the room stays warm
// instead of going dark and screen-lit.
export default function Lighting({ night })
{
    const invalidate = useThree((state) => state.invalidate)
    const fillRef = useRef()
    const keyRef = useRef()
    const nightAmount = useRef({ value: 0 })

    const apply = () => {
        const { day, night: dark, lightColours } = moods
        const amount = nightAmount.current.value
        fillRef.current.intensity = day.fillLight + (dark.fillLight - day.fillLight) * amount
        keyRef.current.intensity = day.keyLight + (dark.keyLight - day.keyLight) * amount
        fillRef.current.color.set(lightColours.sky)
        fillRef.current.groundColor.set(lightColours.ground)
        keyRef.current.color.set(lightColours.key)
        invalidate()
    }

    useLayoutEffect(apply, [])
    useMoodChange(apply)

    const hasMounted = useRef(false)
    useEffect(() => {
        if (!hasMounted.current) {
            hasMounted.current = true
            return
        }

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const tween = gsap.to(nightAmount.current, {
            value: night ? 1 : 0,
            duration: reducedMotion ? 0 : 1.2,
            ease: 'sine.inOut',
            onUpdate: apply,
        })
        return () => tween.kill()
    }, [night])

    return <>
        <hemisphereLight ref={fillRef} />
        <directionalLight ref={keyRef} position={[ -300, 350, 400 ]} />
    </>
}
