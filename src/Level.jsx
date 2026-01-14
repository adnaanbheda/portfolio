import { useGLTF } from '@react-three/drei'

export default function Level(props)
{
    const { scene } = useGLTF('level.glb')

    return <primitive object={ scene } { ...props }>{props.children}</primitive>
}

useGLTF.preload && useGLTF.preload('level.glb')
