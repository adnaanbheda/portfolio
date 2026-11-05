import { Billboard } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, CanvasTexture, Color, SRGBColorSpace } from 'three'
import { moods, useMoodChange } from './moods'

// An old street lamp on the planet, lit at dusk: the kind with a bar below the
// lantern for a lamplighter's ladder. Level's local units, standing on the
// plateau. The lights stay mounted at intensity 0 by day: adding or removing one
// makes three recompile every material, which would hitch at the moment it lights.
const POST_HEIGHT = 6.8
const IRON = '#23222a'

const GLASS_OFF = new Color('#6e7a7c')
const GLASS_ON = new Color('#ffd487')

const LIGHT_COLOR = '#ffb965'
const LIGHT_REACH = 620

// The lantern's four corners, for the frame ribs.
const RIBS = [0, 1, 2, 3].map((corner) => (corner + 0.5) * (Math.PI / 2))

function drawGlow()
{
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const context = canvas.getContext('2d')
    const glow = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    // Falls away like a curve, not a line: straight ramps leave a visible edge.
    for (let stop = 0; stop <= 1; stop += 0.1) {
        glow.addColorStop(stop, `rgba(255, 196, 120, ${0.8 * (1 - stop) ** 3})`)
    }
    context.fillStyle = glow
    context.fillRect(0, 0, size, size)
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    return texture
}

const Iron = () => <meshStandardMaterial color={IRON} roughness={0.7} metalness={0.4} />

export default function LampPost({ on, ...props })
{
    const invalidate = useThree((state) => state.invalidate)
    const lightRef = useRef()
    const fillRef = useRef()
    const glassRef = useRef()
    const glowRef = useRef()

    const glow = useMemo(drawGlow, [])
    useEffect(() => () => glow.dispose(), [glow])

    // One number drives the whole lamp, so the flicker stays in step.
    const brightness = useRef({ value: 0 })
    const apply = () => {
        const { value } = brightness.current
        lightRef.current.intensity = moods.night.lampLight * value
        fillRef.current.intensity = moods.night.lampRoomFill * value
        glassRef.current.color.lerpColors(GLASS_OFF, GLASS_ON, value)
        glowRef.current.opacity = moods.night.lampGlow * value
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

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            brightness.current.value = on ? 1 : 0
            apply()
            return
        }

        const timeline = gsap.timeline({ onUpdate: apply })

        if (on) {
            // Lit as the sky darkens, catching on the second try.
            timeline
                .set(brightness.current, { value: 0.6 }, 0.7)
                .set(brightness.current, { value: 0 }, 0.78)
                .to(brightness.current, { value: 1, duration: 0.3 }, 0.92)
        } else {
            timeline.to(brightness.current, { value: 0, duration: 0.25 })
        }

        return () => timeline.kill()
    }, [on])

    return (
        <group {...props}>
            <mesh position-y={0.1}>
                <cylinderGeometry args={[0.16, 0.2, 0.2, 10]} />
                <Iron />
            </mesh>
            <mesh position-y={0.42}>
                <cylinderGeometry args={[0.07, 0.13, 0.5, 10]} />
                <Iron />
            </mesh>
            <mesh position-y={POST_HEIGHT / 2}>
                <cylinderGeometry args={[0.028, 0.055, POST_HEIGHT, 8]} />
                <Iron />
            </mesh>
            {/* The ladder bar */}
            <mesh position-y={POST_HEIGHT - 0.55} rotation-z={Math.PI / 2}>
                <cylinderGeometry args={[0.016, 0.016, 0.62, 6]} />
                <Iron />
            </mesh>

            <group position-y={POST_HEIGHT}>
                <mesh position-y={0.02}>
                    <cylinderGeometry args={[0.13, 0.05, 0.08, 4]} />
                    <Iron />
                </mesh>
                <mesh position-y={0.3}>
                    <cylinderGeometry args={[0.2, 0.12, 0.5, 4]} />
                    <meshBasicMaterial ref={glassRef} toneMapped={false} />
                </mesh>
                {RIBS.map((angle) => (
                    <mesh key={angle} position={[Math.cos(angle) * 0.165, 0.3, Math.sin(angle) * 0.165]} rotation={[Math.sin(angle) * 0.16, 0, -Math.cos(angle) * 0.16]}>
                        <cylinderGeometry args={[0.012, 0.012, 0.52, 5]} />
                        <Iron />
                    </mesh>
                ))}
                <mesh position-y={0.64}>
                    <coneGeometry args={[0.26, 0.2, 4]} />
                    <Iron />
                </mesh>
                <mesh position-y={0.78}>
                    <cylinderGeometry args={[0.012, 0.03, 0.14, 6]} />
                    <Iron />
                </mesh>

                {/* Drawn over everything: a halo is in the eye, and depth testing
                    it would slice it off along the wall. */}
                <Billboard position-y={0.3}>
                    <mesh renderOrder={10}>
                        <planeGeometry args={[3, 3]} />
                        <meshBasicMaterial ref={glowRef} map={glow} transparent opacity={0} blending={AdditiveBlending} depthTest={false} depthWrite={false} toneMapped={false} />
                    </mesh>
                </Billboard>

                <pointLight ref={lightRef} position-y={0.3} color={LIGHT_COLOR} distance={LIGHT_REACH} decay={0} />
            </group>

            {/* Warmth in the room's far corner, which the lamp can't reach. */}
            <ambientLight ref={fillRef} color="#ffc98a" />
        </group>
    )
}
