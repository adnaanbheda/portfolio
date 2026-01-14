import { CameraControls, ContactShadows, Environment, PresentationControls, Svg, Text } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { useRef } from 'react'
import linkedinSvg from '../public/linkedin.svg'
import resumeSvg from '../public/resume.svg'
import Level from './Level'
import Monitor from './Monitor'
import SnakePlant from './SnakePlant'
import Speakers from './Speakers'
import StandingDesk from './StandingDesk'

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
        console.log('Moving to default');
        camera.updateProjectionMatrix()
        camera.updateWorldMatrix(true, true);
    }
    return <>

        <color args={ [ '#241a1a' ] } attach="background" />

        <Environment preset="city" />
        <EffectComposer>
            <Bloom luminanceThreshold={0} luminanceSmoothing={0.3} height={300} />
            <Noise opacity={0.05} />
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
                <Svg position={[-0.65, -0.9, 0]} onClick={()=>open("https://www.icloud.com/iclouddrive/0d5zhG8EZFpV1_LlX4Fl1V6hw#Adnaan_Bheda_CV")} src={resumeSvg} alt="Resume" scale={0.001} />
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
            <group onDoubleClick={moveCameraToDefault}>
                    <Level scale={0.3} rotation={[0, Math.PI+0.5, 0]} position={[0, -1.4, 2]}>
                        <StandingDesk position={[1, 0.6, -2.4]} rotation={[0, 1.6, 0]} scale={3.5} >
                            <SnakePlant position={[0.1, 1.05, 0.7]} scale={0.4} />
                            <Monitor ref={meshRef} onPointerOver={moveToMonitor} iframeSrc={iframeSrc} position={[0, 0.87, 0]} rotation={[0, Math.PI / 2, 0]} scale={1.5} />
                            <Speakers position={[0, 1.05, -0.45]} rotation={[0,-Math.PI / 2, 0]} />
                        </StandingDesk>
                    </Level>
                {/* <Chair position={[0, -1.25, 3.2]} rotation={[0, Math.PI, 0]} scale={0.5} /> */}
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