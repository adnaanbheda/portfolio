import { ContactShadows, Environment, PresentationControls, Text } from '@react-three/drei'
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import Level from './Level'
import Monitor from './Monitor'
import SnakePlant from './SnakePlant'
import Speakers from './Speakers'
import StandingDesk from './StandingDesk'

export default function Experience({ iframeSrc })
{   
    return <>

        <color args={ [ '#241a1a' ] } attach="background" />

        <Environment preset="city" />
        <EffectComposer>
            <Bloom luminanceThreshold={0} luminanceSmoothing={0.3} height={300} />
            <Noise opacity={0.05} />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>
        <Text
            font="./jost.ttf"
            fontSize={ 0.4 }
            position={ [-1.5, 0.5, 0 ] }
            rotation={[0,0,0]}
            maxWidth={ 1 }
        >
            Adnaan Bheda
            Hi.
        </Text>
        
        <PresentationControls
            global
            rotation={ [ 0, 1, 0 ] }
            polar={ [ - 0.4, 0.2 ] }
            azimuth={ [ - 1, 0.75 ] }
            damping={ 0.1 }
            snap
        > 
            <group>
                    <Level scale={0.3} rotation={[0, Math.PI+0.5, 0]} position={[0, -1.4, 2]}>
                        <StandingDesk position={[1, 0.6, -2.4]} rotation={[0, 1.6, 0]} scale={3.5} >
                            <SnakePlant position={[0.1, 1.05, 0.7]} scale={0.4} />
                            <Monitor iframeSrc={iframeSrc} position={[0, 0.87, 0]} rotation={[0, Math.PI / 2, 0]} scale={1.5} />
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