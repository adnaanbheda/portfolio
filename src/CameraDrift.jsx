import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { MathUtils } from 'three'

// A small sideways lean of the camera towards the pointer, and a slow sway when
// nobody's touching anything, so the room feels held rather than fixed. Fractions
// of the camera's distance from the room.
const POINTER_REACH = 0.035
const SWAY_REACH = 0.007

// Higher catches up with the pointer sooner.
const FOLLOW = 2.4

// Uses the controls' focal offset, which is separate from the orbit, so it can't
// fight a drag or a camera move. Going to the monitor clears it: fitToBox zeroes
// the offset, and with `active` off this stops writing to it.
export default function CameraDrift({ controlsRef, active })
{
    const pointer = useRef({ x: 0, y: 0 })
    const lean = useRef({ x: 0, y: 0 })
    const still = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

    useEffect(() => {
        const dragging = { current: false }
        const controls = controlsRef.current
        const startDrag = () => { dragging.current = true }
        const endDrag = () => { dragging.current = false }

        const follow = (event) => {
            if (event.pointerType !== 'mouse' || dragging.current) return
            pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1
            pointer.current.y = 1 - (event.clientY / window.innerHeight) * 2
        }

        window.addEventListener('pointermove', follow)
        controls?.addEventListener('controlstart', startDrag)
        controls?.addEventListener('controlend', endDrag)
        return () => {
            window.removeEventListener('pointermove', follow)
            controls?.removeEventListener('controlstart', startDrag)
            controls?.removeEventListener('controlend', endDrag)
        }
    }, [])

    useFrame(({ clock }, delta) => {
        const controls = controlsRef.current
        if (!controls || still) return

        if (!active) {
            lean.current.x = lean.current.y = 0
            return
        }

        lean.current.x = MathUtils.damp(lean.current.x, pointer.current.x, FOLLOW, delta)
        lean.current.y = MathUtils.damp(lean.current.y, pointer.current.y, FOLLOW, delta)

        const time = clock.elapsedTime
        const swayX = Math.sin(time * 0.21) + 0.5 * Math.sin(time * 0.37 + 1)
        const swayY = Math.sin(time * 0.16 + 2)

        const { distance } = controls
        controls.setFocalOffset(
            (lean.current.x * POINTER_REACH + swayX * SWAY_REACH) * distance,
            (lean.current.y * POINTER_REACH * 0.6 + swayY * SWAY_REACH * 0.6) * distance,
            0,
            false
        )
    })

    return null
}
