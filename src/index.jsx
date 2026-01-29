import { Loader } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { lazy, Suspense, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import Controls from './Controls'
import Help from './Help'
import './style.css'
const Experience = lazy(() => import('./Experience.jsx'))

const root = ReactDOM.createRoot(document.querySelector('#root'))

function App() {
    const [iframeSrc, setIframeSrc] = useState('')
    const [analyticsLoaded, setAnalyticsLoaded] = useState(false)
    const [zoomTrigger, setZoomTrigger] = useState(0)
    const [isZoomed, setIsZoomed] = useState(false)

    useEffect(() => {
        // Defer Google Analytics loading
        const loadAnalytics = async () => {
            const ReactGA = await import('react-ga4')
            ReactGA.default.initialize("G-60KGGQ8MXV")
            ReactGA.default.send({ hitType: "pageview", page: window.location.pathname })
            setAnalyticsLoaded(true)
        }
        
        // Load analytics after a short delay
        const timer = setTimeout(loadAnalytics, 2000)
        return () => clearTimeout(timer)
    }, [])
    
    // Lazy load YouTube iframe only when needed
    useEffect(() => {
        const timer = setTimeout(() => {
            setIframeSrc('https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1&loop=1&playlist=dQw4w9WgXcQ')
        }, 1000)
        return () => clearTimeout(timer)
    }, [])

    const handleControlClick = (src) => {
        setIframeSrc(src)
        setZoomTrigger(prev => prev + 1)
        setIsZoomed(true)
    }
    
    const handleResetZoom = () => {
        setIsZoomed(false)
    }

    return (
        <>
        <Loader
            containerStyles={{ background: '#241a1a' }}
            innerStyles={{ background: 'rgba(255, 255, 255, 0.1)' }}
            barStyles={{ background: '#ffffff', height: '2px' }}
            dataInterpolation={(p) => `Loading ${Math.round(p)}%`}
        />
        <Help />
        <Controls currentSrc={iframeSrc} setCurrentSrc={handleControlClick} />
        
        {/* Back button when zoomed to monitor */}
        {isZoomed && (
            <button 
                className="back-button"
                onClick={handleResetZoom}
            >
                ← Back
            </button>
        )}
        
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
                    <Experience 
                        iframeSrc={iframeSrc} 
                        zoomTrigger={zoomTrigger}
                        onResetZoom={handleResetZoom}
                        isZoomed={isZoomed}
                    />
                </Suspense>
            </Canvas>
        </>
    )
}

root.render(<App />)