import React from 'react'
import { useGLTF } from '@react-three/drei'

export default function Speakers(props)
{
    const { scene } = useGLTF('speakers.glb')

    return <primitive object={ scene } { ...props } />
}

useGLTF.preload && useGLTF.preload('speakers.glb')
