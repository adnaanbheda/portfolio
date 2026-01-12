import React from 'react'
import { useGLTF } from '@react-three/drei'

export default function Chair(props)
{
    const { scene } = useGLTF('chair.glb')

    return <primitive object={ scene } { ...props } />
}

useGLTF.preload && useGLTF.preload('chair.glb')
