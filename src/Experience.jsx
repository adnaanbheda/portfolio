import { CameraControls, ContactShadows, PresentationControls, Sparkles, Svg, Text } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { lazy, Suspense, useRef } from 'react'
import linkedinSvg from '../public/linkedin.svg'
import resumeSvg from '../public/resume.svg'

const Lamp = lazy(() => import('./Lamplight'))
const Level = lazy(() => import('./Level'))
const Monitor = lazy(() => import('./Monitor'))
const SnakePlant = lazy(() => import('./SnakePlant'))
const Speakers = lazy(() => import('./Speakers'))
const StandingDesk = lazy(() => import('./StandingDesk'))

export default function Experience({ iframeSrc })
{   
    const meshRef = useRef()
    const cameraControlsRef = useRef()
    const { camera } = useThree()
    const perspectiveCameraRef = useRef()
    
    const moveToMonitor = () => {
            cameraControlsRef.current.fitToBox(meshRef.current, true, 1.5)
            cameraControlsRef.current.rotate(-2, 0, true);
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
            minAzimuthAngle={-Math.PI/4}
            maxAzimuthAngle={-Math.PI/8}
            minPolarAngle={0.75}
            maxPolarAngle={1.5}
            rotation={ [ 0, 1, 0 ] }
            polar={ [ - 0.4, 0.2 ] }
            azimuth={ [ -2, 0.75 ] }
            infinityDolly={true} />

        <group                 
            position={ [-1.5, 0.5, 0 ] }
            rotation={[0,-0.75,0]}
        >
            <Sparkles
                size={0.2}
            />
            <Text
                font="./jost.ttf"
                fontSize={ 0.4 }
                maxWidth={ 1 }
            >
                Adnaan Bheda
                Hi.
            </Text>
            <group>
                <Svg position={[-0.35, -0.9, 0]} onClick={()=>open("https://linkedin.com/in/adnaanb")} src={linkedinSvg} alt="LinkedIn" scale={0.001} />
                <Svg position={[-0.65, -0.9, 0]} onClick={()=>open("/cv.pdf")} src={resumeSvg} alt="Resume" scale={0.001} />
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
            <Suspense fallback={null}>
                <group onDoubleClick={moveCameraToDefault}>
                    <Level scale={0.3} rotation={[0, Math.PI+0.5, 0]} position={[0, -1.4, 2]}>
                        <Lamp position={[0, 5,0]} rotation={[0, -1.5, 0]} scale={2.25} intensity={0.2} />
                        <StandingDesk position={[1, 0.6, -2.4]} rotation={[0, 1.6, 0]} scale={3.5} >
                            <SnakePlant position={[0.1, 1.05, 0.7]} scale={0.4} />
                            <Monitor ref={meshRef} onPointerOver={moveToMonitor} iframeSrc={iframeSrc} position={[0, 0.87, 0]} rotation={[0, Math.PI / 2, 0]} scale={1.5} />
                            <Speakers position={[0, 1.05, -0.45]} rotation={[0,-Math.PI / 2, 0]} />
                        </StandingDesk>
                    </Level>
                </group>
            </Suspense>

        </PresentationControls>

        <ContactShadows
            position-y={ - 1.4 }
            opacity={ 0.4 }
            scale={ 10 }
            blur={ 2.4 }
        />

    </>
}