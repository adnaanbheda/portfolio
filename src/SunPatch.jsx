import { useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, CanvasTexture, SRGBColorSpace } from 'three'

// Sunlight through the window, landing on the floor. level.glb's panes are solid
// and the walls are closed, so a real light can't get through; this is the same
// shape, worked out from the window and drawn straight onto the floor. It fades
// out at night: any blue added to this floor comes out pink.
//
// All in Level's local units, read from level.glb: the room spans -4..4 in x and
// z, the window pane sits on the x = PANE_X plane, and the floor top is FLOOR_Y.
const ROOM_HALF = 4
const FLOOR_Y = 0.57
const PANE_X = -3.65
const PANE_ROWS = [[2.5, 4.45], [4.75, 6.7]]
const PANE_COLUMNS = [[-2.0, 0], [0.3, 2.3]]
const SUN_DIRECTION = [1, -1.15, 0.42]

const TEXTURE_SIZE = 512

const OPACITY = 0.5

function onFloor(y, z)
{
    const [dx, dy, dz] = SUN_DIRECTION
    const distance = (FLOOR_Y - y) / dy
    return [PANE_X + dx * distance, z + dz * distance]
}

function drawPatch()
{
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = TEXTURE_SIZE
    const context = canvas.getContext('2d')
    const toPixels = (value) => (value + ROOM_HALF) / (ROOM_HALF * 2) * TEXTURE_SIZE

    // Safari has no canvas filter and just gets harder edges, which still read
    // as sunlight.
    context.filter = 'blur(5px)'
    context.fillStyle = '#fff'

    for (const [bottom, top] of PANE_ROWS) {
        for (const [left, right] of PANE_COLUMNS) {
            const corners = [[bottom, left], [bottom, right], [top, right], [top, left]]
            context.beginPath()
            for (const [y, z] of corners) {
                const [x, floorZ] = onFloor(y, z)
                context.lineTo(toPixels(x), toPixels(floorZ))
            }
            context.fill()
        }
    }

    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    return texture
}

export default function SunPatch({ night })
{
    const texture = useMemo(drawPatch, [])
    useEffect(() => () => texture.dispose(), [texture])

    const materialRef = useRef()
    const invalidate = useThree((state) => state.invalidate)

    const hasMounted = useRef(false)
    useEffect(() => {
        if (!hasMounted.current) {
            hasMounted.current = true
            return
        }

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const tween = gsap.to(materialRef.current, {
            opacity: night ? 0 : OPACITY,
            duration: reducedMotion ? 0 : 1.2,
            ease: 'sine.inOut',
            onUpdate: invalidate,
        })
        return () => tween.kill()
    }, [night])

    return (
        // Texture +x/+z run along the canvas's right/down, which is what a plane
        // laid flat by this rotation shows with its v axis flipped back.
        <mesh position={[0, FLOOR_Y + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[ROOM_HALF * 2, ROOM_HALF * 2]} />
            <meshBasicMaterial
                ref={materialRef}
                map={texture}
                alphaMap={texture}
                color="#ffb765"
                transparent
                opacity={OPACITY}
                blending={AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
            />
        </mesh>
    )
}
