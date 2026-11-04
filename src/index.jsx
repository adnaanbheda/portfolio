import { Loader, PerformanceMonitor, useGLTF } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { lazy, Suspense, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import Controls from './Controls'
import Help from './Help'
import './style.css'

// Most of the GLBs are Draco-compressed. drei defaults the decoder to
// gstatic.com, which puts a third-party DNS + TLS handshake on the critical
// path before any mesh can be parsed. The decoder is copied into public/draco/
// so it comes off our own origin, over the connection that is already open.
useGLTF.setDecoderPath('/draco/')

const Experience = lazy(() => import('./Experience.jsx'))

const root = ReactDOM.createRoot(document.querySelector('#root'))

const DEFAULT_SRC = 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1&loop=1&playsinline=1&playlist=dQw4w9WgXcQ'

function App() {
    // Empty until the intro camera glide finishes (see handleIntroComplete).
    const [iframeSrc, setIframeSrc] = useState('')
    const [analyticsLoaded, setAnalyticsLoaded] = useState(false)
    const [zoomTrigger, setZoomTrigger] = useState(0)
    const [isZoomed, setIsZoomed] = useState(false)

    // Pixel ratio is the biggest single GPU lever here: every pass (scene,
    // reflector, bloom, noise, vignette) scales with it, and a Retina laptop
    // at its native 2x pushes 4x the pixels of 1x. Start at a middle ground
    // and let <PerformanceMonitor> below move it: up to native on machines
    // that hold the refresh rate, down to 1 on ones (e.g. a MacBook Air) that
    // don't.
    const maxDpr = Math.min(window.devicePixelRatio || 1, 2)
    const [dpr, setDpr] = useState(Math.min(maxDpr, 1.5))

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
    
    // First-load iframe waits for the intro camera glide to finish, so the
    // YouTube player's startup doesn't stutter it. Keeps whatever a visitor
    // picked if they clicked a button mid-intro.
    const handleIntroComplete = () => {
        setIframeSrc((current) => current || DEFAULT_SRC)
    }

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
        <Controls currentSrc={iframeSrc || DEFAULT_SRC} setCurrentSrc={handleControlClick} />
        
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
            dpr={dpr}
            // Everything goes through EffectComposer's own render targets, so
            // MSAA on the default framebuffer only ever antialiases the final
            // fullscreen quad - pure cost. The composer handles AA instead
            // (see multisampling in Experience.jsx).
            gl={{ antialias: false, stencil: false }}
            // Orthographic for the isometric view. Pose and zoom are set by
            // goHome() in Experience.jsx, which fits them to the viewport.
            orthographic
            camera={{
                    near: 0.1,
                    far: 2000,
                    position: [-300, 300, 300]
                }}
            >
                <Suspense fallback={null}>
                    <Experience
                        iframeSrc={iframeSrc}
                        zoomTrigger={zoomTrigger}
                        onResetZoom={handleResetZoom}
                        onIntroComplete={handleIntroComplete}
                        isZoomed={isZoomed}
                    />
                    {/* Inside the Suspense on purpose: it only starts sampling
                        once the scene is mounted. Outside, it measured the
                        GLB/Draco parse stalls, read them as a slow GPU, and
                        flip-flopped into a permanent dpr 1 even on fast
                        machines. */}
                    <PerformanceMonitor
                        // drei's default upper bound on a 60Hz screen is a
                        // flat 60, which a machine that is genuinely keeping
                        // up (59-60fps with jitter) often misses. 55 / 90
                        // means "holding the refresh rate".
                        bounds={(refreshrate) => (refreshrate > 100 ? [60, 90] : [40, 55])}
                        onIncline={() => setDpr(maxDpr)}
                        onDecline={() => setDpr(1)}
                        // Stop sampling after a few decisions; each dpr change
                        // reallocates every render target. No onFallback on
                        // purpose: drei counts *every* incline/decline as a
                        // flip, so a fast machine inclining repeatedly reaches
                        // it too - it must just freeze the current dpr, not
                        // force it down.
                        flipflops={3}
                    />
                </Suspense>
            </Canvas>
        </>
    )
}

root.render(<App />)