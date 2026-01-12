import React from 'react'
import { useGLTF } from '@react-three/drei'

export default function Himalayan(props)
{
    const { scene } = useGLTF('himalayan450.glb')

    return <primitive object={ scene } { ...props } />
}

useGLTF.preload && useGLTF.preload('himalayan450.glb')
