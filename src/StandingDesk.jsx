import React from 'react'
import { useGLTF } from '@react-three/drei'

export default function     StandingDesk(props)
{
    const { scene } = useGLTF('standing_desk.glb')

    return <primitive object={ scene } { ...props }>
        { props.children }
    </primitive>
}

useGLTF.preload && useGLTF.preload('standing_desk.glb')
