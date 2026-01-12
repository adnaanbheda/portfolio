import React from 'react'
import { Html, useGLTF } from '@react-three/drei'
import { useControls } from 'leva'

export default function Monitor(props)
{
    const { scene } = useGLTF('monitor.glb')

    return <primitive object={ scene } { ...props }>
        <Html wrapperClass='htmlScreen' position={[-0.02, 0.28,-0.12]} rotation={[0, -Math.PI, 0]} scale={0.3} distanceFactor={1} transform occlude>
            <iframe 
                src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1&loop=1&playlist=dQw4w9WgXcQ" 
                width="560" 
                height="315"
                frameBorder="0" 
                allow="autoplay; encrypted-media; picture-in-picture" 
                allowFullScreen
                title="Embedded youtube"
            />
        </Html>
    </primitive>
}

useGLTF.preload && useGLTF.preload('monitor.glb')
