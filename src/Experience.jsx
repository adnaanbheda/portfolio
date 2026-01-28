import { CameraControls, ContactShadows, PresentationControls, Sparkles, Svg, Text } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { useEffect, useRef } from 'react'
import linkedinSvg from '../public/linkedin.svg'
import resumeSvg from '../public/resume.svg'
import Lamp from './Lamplight'
import Level from './Level'
import Monitor from './Monitor'
import SnakePlant from './SnakePlant'
import Speakers from './Speakers'
import StandingDesk from './StandingDesk'

export default function Experience({ iframeSrc, zoomTrigger })
{   
    const meshRef = useRef()
    const cameraControlsRef = useRef()
    const { camera, size } = useThree()
    const perspectiveCameraRef = useRef()
    
    useEffect(() => {
        if (zoomTrigger > 0) {
            moveToMonitor()
        }
    }, [zoomTrigger])
    
    // Responsive logic
    const isMobile = size.width < 768
    const textPosition = isMobile ? [-0.25, 1.5, 0] : [-1.5, 0.5, 0]
    const textScale = isMobile ? 0.6 : 1
    const sceneScale = isMobile ? 0.55 : 1
    const scenePosition = isMobile ? [0, -0.6, 0] : [0, 0, 0]
    
    const moveToMonitor = () => {
        cameraControlsRef.current.rotateAzimuthTo(-Math.PI/2, true);
        cameraControlsRef.current.fitToBox(meshRef.current, true);
        console.log('Moving to monitor');
        cameraControlsRef.current.enabled = false;
    }

    const moveCameraToDefault = () => {
        cameraControlsRef.current?.reset(true);
        cameraControlsRef.current.enabled = true;
        console.log('Moving to default');        
        camera.updateProjectionMatrix()
        camera.updateWorldMatrix(true, true);
    }

    return <>

        <EffectComposer>
            <Bloom luminanceThreshold={0} luminanceSmoothing={0} height={300} />
            <Noise opacity={0.09} />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>

        <CameraControls
            ref={cameraControlsRef} 
            minAzimuthAngle={-Math.PI / 2}
            maxAzimuthAngle={Math.PI / 4}
            minPolarAngle={0.5}
            maxPolarAngle={isMobile ? 2 : 1.5}
            rotation={ [ 0, 1, 0 ] }
            polar={ [ - 0.4, 0.2 ] }
            azimuth={ [ -2, 0.75 ] }
            infinityDolly={true} />

        <group                 
            position={ textPosition }
            rotation={[0, -0.75, 0]}
            scale={textScale}
        >
            <Sparkles
                size={0.2}
            />
            <Text
                font="./jost.ttf"
                fontSize={ isMobile ? 0.25 : 0.4 }
                maxWidth={ 1 }
            >
                Adnaan Bheda
                Hi.
            </Text>
            <group>
                <Svg position={isMobile?[-0.5, -0.7, 0]:[-0.35, -0.9, 0]} onClick={()=>open("/cv.pdf")} src={resumeSvg} alt="Resume" scale={0.001} />
                <Svg position={isMobile?[-0.2, -0.7, 0]:[-0.65, -0.9, 0]} onClick={()=>open("https://linkedin.com/in/adnaanb")} src={linkedinSvg} alt="LinkedIn" scale={0.001} />
            </group>
        </group>
        
        <PresentationControls
            global
            ref={perspectiveCameraRef}
            rotation={ [ 0, 1, 0 ] }
            polar={ [ - 0.4, 0.2 ] }
            azimuth={ [ - 1, 0.75 ] }
            damping={ 0.1 }
            snap
        > 
                <group onDoubleClick={moveCameraToDefault} scale={sceneScale} position={scenePosition}>
                    <Level scale={0.3} rotation={[0, Math.PI+0.5, 0]} position={ isMobile ? [0, -1, 0] : [0, -1.4, 2] }>
                        <Lamp position={[0, 5,0]} rotation={[0, -1.5, 0]} scale={2.25} intensity={0.2} />
                        <StandingDesk position={[1, 0.6, -2.4]} rotation={[0, 1.6, 0]} scale={3.5} >
                            <SnakePlant position={[0.1, 1.05, 0.7]} scale={0.4} />
                            <Monitor ref={meshRef} onPointerOver={moveToMonitor} iframeSrc={iframeSrc} position={[0, 0.87, 0]} rotation={[0, Math.PI / 2, 0]} scale={1.5} />
                            <Speakers position={[0, 1.05, -0.45]} rotation={[0,-Math.PI / 2, 0]} />
                        </StandingDesk>
                    </Level>
                </group>

        </PresentationControls>

        <ContactShadows
            position-y={ - 1.4 }
            opacity={ 0.4 }
            scale={ 10 }
            blur={ 2.4 }
        />

    </>
}