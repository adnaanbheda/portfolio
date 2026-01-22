import { Loader } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { lazy, Suspense, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import ReactGA from 'react-ga4'
import Controls from './Controls'
import './style.css'
const Experience = lazy(() => import('./Experience.jsx'))

const root = ReactDOM.createRoot(document.querySelector('#root'))

ReactGA.initialize("G-60KGGQ8MXV");

function App() {
    const [iframeSrc, setIframeSrc] = useState('https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1&loop=1&playlist=dQw4w9WgXcQ')

    useEffect(() => {
        ReactGA.send({ hitType: "pageview", page: window.location.pathname });
    }, [])

    return (
        <>
        <Loader
            containerStyles={{ background: '#241a1a' }}
            innerStyles={{ background: 'rgba(255, 255, 255, 0.1)' }}
            barStyles={{ background: '#ffffff', height: '2px' }}
            dataInterpolation={(p) => `Loading ${Math.round(p)}%`}
        />
        <Controls currentSrc={iframeSrc} setCurrentSrc={setIframeSrc} />
        <Canvas
            className="r3f"
            camera={{
                    fov: 45,
                    near: 0.1,
                    far: 2000,
                    position: [-3, 1.5, 4]
                }}
            >
                <Suspense fallback={null}>
                    <Experience iframeSrc={iframeSrc} />
                </Suspense>
            </Canvas>
        </>
    )
}

root.render(<App />)