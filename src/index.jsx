import { PerformanceMonitor, useGLTF } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import Boot from './Boot'
import CommandBar from './CommandBar'
import { commandName, execute } from './commands'
import Terminal from './Terminal'
import './style.css'

// Most of the GLBs are Draco-compressed. drei defaults the decoder to
// gstatic.com, which puts a third-party DNS + TLS handshake on the critical
// path before any mesh can be parsed. The decoder is copied into public/draco/
// so it comes off our own origin, over the connection that is already open.
useGLTF.setDecoderPath('/draco/')

const Experience = lazy(() => import('./Experience.jsx'))

// Lighting sliders, in dev only: this branch drops out of a production build.
const MoodPanel = import.meta.env.DEV ? lazy(() => import('./MoodPanel.jsx')) : null

const root = ReactDOM.createRoot(document.querySelector('#root'))

// A long session shouldn't grow the terminal's DOM forever.
const MAX_LINES = 200

// How long the sky stays on the sunset before night takes over.
const SUNSET_MS = 5000

function App() {
    // A live third-party iframe is the single worst thing for frame rate here:
    // on a phone it shares the page's main thread, and a running YouTube player
    // cost more than the whole 3D scene. So the monitor idles on a looping
    // terminal GIF, the real terminal only mounts once the camera is parked at
    // the monitor, and an iframe only exists when a command asks for one.
    const [iframeSrc, setIframeSrc] = useState('')
    const [lines, setLines] = useState([])
    const [cameraAtMonitor, setCameraAtMonitor] = useState(false)
    const [sceneReady, setSceneReady] = useState(false)
    const [zoomTrigger, setZoomTrigger] = useState(0)
    const [isZoomed, setIsZoomed] = useState(false)
    // The view between the room and the monitor. Stays on while the camera is
    // at the monitor, so stepping back from there lands here.
    const [atDesk, setAtDesk] = useState(false)
    const [night, setNight] = useState(false)
    // A counter, like zoomTrigger: each increment plays the sunset once.
    const [sunset, setSunset] = useState(0)

    // The page's own text sits on the sky, so it has to follow the mood too.
    useEffect(() => {
        document.documentElement.dataset.mood = night ? 'night' : 'day'
        document.querySelector('meta[name="theme-color"]').content = night ? '#0d1230' : '#8ea6b2'
    }, [night])

    // A command issued from the room, waiting for the camera to arrive.
    const queuedCommand = useRef(null)
    const nightfall = useRef(null)
    const analytics = useRef(null)

    // Pixel ratio is the biggest single GPU lever here: everything scales with
    // it, and a Retina laptop
    // at its native 2x pushes 4x the pixels of 1x. Start at a middle ground
    // and let <PerformanceMonitor> below move it: up to native on machines
    // that hold the refresh rate, down to 1 on ones (e.g. a MacBook Air) that
    // don't.
    const maxDpr = Math.min(window.devicePixelRatio || 1, 2)
    const [dpr, setDpr] = useState(Math.min(maxDpr, 1.5))

    // Analytics waits for the intro glide to finish: parsing its script on a
    // timer used to land right in the middle of it.
    const loadAnalytics = async () => {
        const ReactGA = await import('react-ga4')
        ReactGA.default.initialize("G-60KGGQ8MXV")
        ReactGA.default.send({ hitType: "pageview", page: window.location.pathname })
        analytics.current = ReactGA.default
    }

    // Unloading on the way out, not just hiding: a player left running in the
    // background keeps costing frames for the rest of the visit.
    const leaveMonitor = () => {
        queuedCommand.current = null
        setIsZoomed(false)
        setCameraAtMonitor(false)
        setIframeSrc('')
    }

    // One step back: from a site to the terminal, from the terminal to wherever
    // the visitor came from, from the desk to the room. False when already in
    // the room, with nothing to step back from.
    const stepBack = () => {
        if (iframeSrc) setIframeSrc('')
        else if (isZoomed) leaveMonitor()
        else if (atDesk) setAtDesk(false)
        else return false
        return true
    }

    const runAtMonitor = (input) => {
        const { lines: output, effect } = execute(input, { night })

        analytics.current?.event({ category: 'Terminal', action: 'Command', label: commandName(input) })

        if (effect === 'clear') {
            setLines([])
            return
        }
        if (effect === 'exit') {
            stepBack()
            return
        }

        setLines((previous) => [...previous, { kind: 'input', text: input }, ...output].slice(-MAX_LINES))
        if (effect?.open) setIframeSrc(effect.open)
        if (effect?.night !== undefined) setNight(effect.night)
        // Back out to the room: from the monitor there's no sky to watch.
        if (effect?.sunset) {
            leaveMonitor()
            setAtDesk(false)
            setSunset((previous) => previous + 1)
            clearTimeout(nightfall.current)
            nightfall.current = setTimeout(() => setNight(true), SUNSET_MS)
        }
        if (effect?.url) window.open(effect.url, '_blank', 'noopener,noreferrer')
    }

    const runCommand = (input) => {
        if (cameraAtMonitor) {
            // A command from the bar while a site is on screen brings the
            // terminal back to show its answer.
            setIframeSrc('')
            runAtMonitor(input)
            return
        }

        queuedCommand.current = input
        if (!isZoomed) {
            setIsZoomed(true)
            setZoomTrigger((previous) => previous + 1)
        }
    }

    // The terminal and any iframe wait for this so their startup can't stutter
    // the zoom.
    const handleZoomComplete = () => {
        setCameraAtMonitor(true)
        if (queuedCommand.current) runAtMonitor(queuedCommand.current)
        queuedCommand.current = null
    }

    return (
        <>
        <Boot ready={sceneReady} />
        {MoodPanel && <Suspense fallback={null}><MoodPanel /></Suspense>}
        <header className={isZoomed || atDesk ? 'nameplate hidden' : 'nameplate'}>
            <h1>Adnaan Bheda</h1>
            <p>Software Engineer</p>
        </header>
        {!isZoomed && (
            <button type="button" className="mood-toggle" onClick={() => {
                clearTimeout(nightfall.current)
                setNight(!night)
            }}>
                {night ? 'day' : 'night'}
            </button>
        )}
        {/* Esc can't close a site that holds keyboard focus: its key presses go
            to the iframe. The bar's exit button is the way out then. */}
        <CommandBar
            canExit={isZoomed || atDesk}
            onCommand={(command) => command === 'exit' ? stepBack() : runCommand(command)}
        />

        <Canvas
            className="r3f"
            dpr={dpr}
            // Straight to the screen, no post-processing: the painted sky and
            // the lamp's sprite do what bloom used to, for nothing per frame.
            // `flat` keeps colours as authored, with no tone mapping.
            flat
            gl={{ antialias: true, stencil: false }}
            // Parked at the monitor nothing in the scene needs to move, so
            // stop rendering and leave the whole device to the iframe. Demand
            // rather than never: a resize still has to redraw.
            frameloop={cameraAtMonitor ? 'demand' : 'always'}
            camera={{
                    fov: 45,
                    near: 0.1,
                    far: 2000,
                    // 100x the framing distance the scene was authored at - keep in
                    // sync with SCENE_SCALE_FACTOR in Experience.jsx (see there for why).
                    position: [-300, 150, 400]
                }}
            >
                <Suspense fallback={null}>
                    <Experience
                        iframeSrc={iframeSrc}
                        night={night}
                        sunset={sunset}
                        onRoseClick={() => runCommand('rose')}
                        terminal={cameraAtMonitor && !iframeSrc
                            ? <Terminal lines={lines} onCommand={runCommand} />
                            : null}
                        zoomTrigger={zoomTrigger}
                        onStepBack={stepBack}
                        onDeskClick={() => setAtDesk(true)}
                        onZoomComplete={handleZoomComplete}
                        onPosterClick={() => runCommand('whoami')}
                        onSceneReady={() => setSceneReady(true)}
                        onIntroComplete={loadAnalytics}
                        isZoomed={isZoomed}
                        atDesk={atDesk}
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