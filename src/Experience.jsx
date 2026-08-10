import { CameraControls, ContactShadows, Sparkles, Svg, Text } from '@react-three/drei'
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

// The monitor's screen content is a drei <Html transform>, which projects
// through a CSS matrix3d built from the object's full world-space scale.
// This scene's original scale chain put that scale around 1e-4 - fine for
// Chromium's matrix3d decomposition, but small enough that Safari/WebKit's
// (which every iOS browser runs on, Chrome included) loses precision and
// collapses the iframe to a ~0px degenerate box, rendering it detached from
// the screen mesh. Blowing up every spatial prop in the scene by the same
// factor - and moving the camera out by the same factor in index.jsx -
// leaves the on-screen result pixel-identical (angular size only depends on
// the size/distance ratio) while giving WebKit a numerically safe matrix to
// work with. Keep this in sync with the camera position in index.jsx.
const SCENE_SCALE_FACTOR = 100

export default function Experience({ iframeSrc, zoomTrigger, onResetZoom, isZoomed })
{
    const meshRef = useRef()
    const cameraControlsRef = useRef()
    const { camera, size } = useThree()

    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            moveCameraToDefault()
            onResetZoom?.()
        }
    });
    
    useEffect(() => {
        if (zoomTrigger > 0) {
            moveToMonitor()
        }
    }, [zoomTrigger])
    
    // Handle back button click from parent
    useEffect(() => {
        if (isZoomed === false && cameraControlsRef.current) {
            moveCameraToDefault()
        }
    }, [isZoomed])
    
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
            minAzimuthAngle={-Math.PI /2}
            maxAzimuthAngle={Math.PI / 8}
            minPolarAngle={0.5}
            maxPolarAngle={isMobile ? 2 : 1.5}
            rotation={ [ 0, 1, 0 ] }
            polar={ [ - 0.3, 0 ] }
            azimuth={ [ -2, 0.75 ] }
            infinityDolly={true} />

        {/* Everything spatial lives at SCENE_SCALE_FACTOR x the scale the whole
            scene was originally authored/tuned at - see the constant's comment.
            Nothing in here needed its own numbers touched; scaling one shared
            ancestor keeps every relative position/size exactly as it was. */}
        <group scale={SCENE_SCALE_FACTOR}>
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
                    <Svg position={isMobile?[-0.5, -0.7, 0]:[-0.35, -0.9, 0]} onClick={()=>open("/cv.pdf")} src={resumeSvg} alt="Resume" scale={0.001} onPointerOver={() => document.body.style.cursor = 'pointer'} onPointerOut={() => document.body.style.cursor = 'auto'} />
                    <Svg position={isMobile?[-0.2, -0.7, 0]:[-0.65, -0.9, 0]} onClick={()=>open("https://linkedin.com/in/adnaanb")} src={linkedinSvg} alt="LinkedIn" scale={0.001} onPointerOver={() => document.body.style.cursor = 'pointer'} onPointerOut={() => document.body.style.cursor = 'auto'} />
                </group>
            </group>

            <group global rotation={ [ 0, 1, 0 ] }>
                    <group onDoubleClick={moveCameraToDefault} scale={sceneScale} position={scenePosition}>
                        <Level scale={0.3} rotation={[0, Math.PI+0.5, 0]} position={ isMobile ? [0, -1, 0] : [0, -1.4, 2] }>
                            <Lamp position={[0, 5,0]} rotation={[0, -1.5, 0]} scale={2.25} intensity={0.2} />
                            <StandingDesk position={[1, 0.6, -2.4]} rotation={[0, 1.6, 0]} scale={3.5} >
                                <SnakePlant position={[0.1, 1.05, 0.7]} scale={0.4} />
                                <Monitor ref={meshRef} iframeSrc={iframeSrc} position={[0, 0.87, 0]} rotation={[0, Math.PI / 2, 0]} scale={1.5} />
                                <Speakers position={[0, 1.05, -0.45]} rotation={[0,-Math.PI / 2, 0]} />
                            </StandingDesk>
                        </Level>
                    </group>

            </group>

            <ContactShadows
                position-y={ - 1.4 }
                opacity={ 0.4 }
                scale={ 10 }
                blur={ 2.4 }
            />
        </group>

    </>
}