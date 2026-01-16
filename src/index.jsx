import { Loader } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useState } from 'react'
import ReactDOM from 'react-dom/client'
import Controls from './Controls'
import Experience from './Experience.jsx'
import './style.css'

const root = ReactDOM.createRoot(document.querySelector('#root'))

function App() {
    const [iframeSrc, setIframeSrc] = useState('https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1&loop=1&playlist=dQw4w9WgXcQ')

    return (
        <>
            <Loader />
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