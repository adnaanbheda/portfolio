import { useGLTF } from '@react-three/drei'
import { useLayoutEffect } from 'react'

// Set here rather than baked into level.glb so the colours can be tuned without
// a round trip through Blender. What changes between day and night is in
// Lighting.jsx.
const WALL_COLOR = '#c3cfb6'
const FLOOR_COLOR = '#a26b3c'

// Exposed ceiling joists, resting on the desk wall's top and cut off at the open
// side the way the walls are. A full ceiling would hide the room from above.
const JOIST_X = [-2.6, 0, 2.6]
const JOIST_Y = 8.15
const JOIST_SIZE = [0.26, 0.3, 8]
const JOIST_COLOR = '#6e4a2f'

export default function Level(props)
{
    const { scene, materials } = useGLTF('level.glb')

    useLayoutEffect(() => {
        materials.RoomMaterial.color.set(WALL_COLOR)
        materials.FlootMaterial.color.set(FLOOR_COLOR)
        // WindowView takes its place; the two would z-fight.
        materials['Window Pane.001'].visible = false
    }, [materials])

    return <primitive object={ scene } { ...props }>
        {JOIST_X.map((x) => (
            <mesh key={x} position={[x, JOIST_Y, 0]}>
                <boxGeometry args={JOIST_SIZE} />
                <meshStandardMaterial color={JOIST_COLOR} />
            </mesh>
        ))}
        {props.children}
    </primitive>
}

useGLTF.preload && useGLTF.preload('level.glb')
