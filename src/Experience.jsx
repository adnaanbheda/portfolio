import { ContactShadows, Environment, PresentationControls, Text } from '@react-three/drei'
import Himalayan from './Himalayan450'
import Monitor from './Monitor'
import Speakers from './Speakers'
import StandingDesk from './StandingDesk'

export default function Experience({ iframeSrc })
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
                <Himalayan position={[-0.4, -1.2, -2.5]} rotation={[0, -0.65, 0]} scale={1.2} />
                <Text
                    font="./atkinson-hyperlegible.ttf"
                    fontSize={ 1 }
                    position={ [ 3, 1, 0 ] }
                    rotation-y={ -1.5}
                    maxWidth={ 2 }
                >
                    Adnaan Bheda
                </Text>
            <group>
                <StandingDesk position={[-0.5, -1.2, 1.5]} rotation={[0, -0.75, 0]} scale={1.2} >
                    <Monitor iframeSrc={iframeSrc} position={[0, 0.87, 0]} rotation={[0, Math.PI / 2, 0]} scale={1.5} />
                    <Speakers scale={0.7} />
                </StandingDesk>
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