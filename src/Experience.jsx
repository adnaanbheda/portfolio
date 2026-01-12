import { Text, Html, ContactShadows, PresentationControls, Float, Environment, useGLTF } from '@react-three/drei'
import Himalayan from './Himalayan'
import StandingDesk from './StandingDesk'
import Monitor from './Monitor'
import Speakers from './Speakers'

export default function Experience()
{   
    return <>

        <color args={ [ '#241a1a' ] } attach="background" />

        <Environment preset="city" />
        
        <PresentationControls
            global
            rotation={ [ 0, 1, 0 ] }
            polar={ [ - 0.4, 0.2 ] }
            azimuth={ [ - 1, 0.75 ] }
            damping={ 0.1 }
            snap
        >
            <Float rotationIntensity={ 0.4 } >  
                <rectAreaLight
                    width={ 2.5 }
                    height={ 1.65 }
                    intensity={ 65 }
                    color={ '#ff6900' }
                    rotation={ [ - 0.1, Math.PI, 0 ] }
                    position={ [ 0, 0.55, - 1.15 ] }
                />

                <Himalayan position-y={ - 1.2 } />
                <Text
                    font="./bangers-v20-latin-regular.woff"
                    fontSize={ 1 }
                    position={ [ 2, 0.75, 0.75 ] }
                    rotation-y={ - 1.25 }
                    maxWidth={ 2 }
                >
                    Adnaan Bheda
                </Text>
            </Float>
            <group>
                <StandingDesk position-y={ - 1.2 } position-z={ 2.5 } />
                <Monitor position={[0.30, -0.32, 2.5]} rotation={[0, Math.PI / 2, 0]} scale={0.95} />
                <Speakers position={[x, y, 2.3]} scale={0.7} />
                <Speakers position={[0, -0.6, 2.3]} scale={0.7} />
                {/* <Chair position={[0, -1.25, 3.2]} rotation={[0, Math.PI, 0]} scale={0.5} /> */}
            </group>

        </PresentationControls>

        <ContactShadows
            position-y={ - 1.4 }
            opacity={ 0.4 }
            scale={ 5 }
            blur={ 2.4 }
        />

    </>
}