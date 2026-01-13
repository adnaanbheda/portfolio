import { Canvas } from '@react-three/fiber'
import { useState } from 'react'
import ReactDOM from 'react-dom/client'
import Controls from './Controls'
import Experience from './Experience.jsx'
import './style.css'

const root = ReactDOM.createRoot(document.querySelector('#root'))

function App() {
    const [iframeSrc, setIframeSrc] = useState('https://open.spotify.com/embed/playlist/37i9dQZEVXcZb9ak6F5ysH?utm_source=generator')

    return (
        <>
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
                <Experience iframeSrc={iframeSrc} />
            </Canvas>
        </>
    )
}

root.render(<App />)