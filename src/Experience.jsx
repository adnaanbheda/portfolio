import { CameraControls, ContactShadows } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'
import DeskProps from './DeskProps'
import Lamp from './Lamplight'
import Level from './Level'
import Lighting from './Lighting'
import Monitor from './Monitor'
import SnakePlant from './SnakePlant'
import Speakers from './Speakers'
import StandingDesk from './StandingDesk'
import Stars from './Stars'
import SunPatch from './SunPatch'
import WindowView from './WindowView'

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

// How close (world units) the camera must be to the end of a move to count
// as arrived. The default view sits ~5.2 authored units out, so 0.03 is
// ~0.6% of it: the last of the ease-out tail, which by then is barely moving.
const SETTLED_DISTANCE = 0.03 * SCENE_SCALE_FACTOR

// Calls onSettled once the camera has visually reached the end of its current
// move, or after backstopMs if something keeps it moving. Returns a cancel.
//
// Not the promise from reset()/fitToBox(): those resolve on camera-controls'
// 'rest' event, whose restThreshold (0.01) is in world units - and this scene
// is scaled up 100x, so the camera spends seconds creeping through sub-pixel
// movement before it counts as resting.
function whenSettled(controls, backstopMs, onSettled)
{
    const current = new Vector3()
    const end = new Vector3()
    let done = false

    const cleanUp = () => {
        done = true
        clearTimeout(backstop)
        controls.removeEventListener('update', check)
    }
    const finish = () => {
        if (done) return
        cleanUp()
        onSettled()
    }
    const check = () => {
        controls.getPosition(current, false)
        controls.getPosition(end, true)
        if (current.distanceTo(end) < SETTLED_DISTANCE) finish()
    }

    const backstop = setTimeout(finish, backstopMs)
    controls.addEventListener('update', check)
    return cleanUp
}

// A frame slower than this counts as a hitch, and this many clean frames in a
// row as warmed up. Slow devices may never get there, hence the backstop.
const HITCH_MS = 100
const STABLE_FRAMES = 5
const WARM_UP_BACKSTOP_MS = 2500

// Calls onStable once frames have stopped hitching. Returns a cancel.
function whenFramesStable(onStable)
{
    const deadline = performance.now() + WARM_UP_BACKSTOP_MS
    let last = performance.now()
    let clean = 0
    let frame

    const tick = (now) => {
        clean = now - last < HITCH_MS ? clean + 1 : 0
        last = now
        if (clean >= STABLE_FRAMES || now > deadline) onStable()
        else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
}

export default function Experience({ iframeSrc, terminal, night, zoomTrigger, onResetZoom, onEscape, onZoomComplete, onPosterClick, onSceneReady, onIntroComplete, isZoomed })
{
    const meshRef = useRef()
    const cameraControlsRef = useRef()
    const { camera, size } = useThree()
    const dpr = useThree((state) => state.viewport.dpr)

    // Parent callbacks are fresh closures every render, but they get called
    // from listeners set up once. Always go through the latest.
    const callbacks = useRef({})
    callbacks.current = { onResetZoom, onEscape, onZoomComplete, onSceneReady, onIntroComplete }

    const cancelZoomWatch = useRef(null)

    // Registered once. This used to be a bare addEventListener in the render
    // body, which stacked one more listener on every re-render (every iframe
    // switch, every resize).
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key !== 'Escape') return
            // Closing a site on the monitor comes first; the view only resets
            // when there was nothing to close.
            if (!callbacks.current.onEscape?.()) resetView()
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [])

    // Intro: start pulled back and swung round, then glide into the default
    // framing once the scene is on screen. reset() targets the state
    // camera-controls saved on construction (the Canvas camera position in
    // index.jsx), so the end pose and the Esc/Back pose are the same.
    //
    // The first frames are the worst ones: shaders compile and textures upload
    // as each thing is first drawn, including the reflector and post-processing
    // passes. Those frames render behind the cover in index.jsx, and the glide
    // only starts once they're done, so no one sees them.
    useEffect(() => {
        const controls = cameraControlsRef.current
        if (!controls) return

        const defaultSmoothTime = controls.smoothTime
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

        let startTimer
        let cancelSettled = () => {}

        if (!reducedMotion) {
            controls.rotate(0.55, -0.35, false)
            controls.dolly(-controls.distance * 0.6, false)
            controls.smoothTime = 0.9
        }

        const cancelStable = whenFramesStable(() => {
            callbacks.current.onSceneReady?.()
            if (reducedMotion) {
                callbacks.current.onIntroComplete?.()
                return
            }

            // Give the cover's fade a moment so the move is actually seen.
            startTimer = setTimeout(() => {
                cancelSettled = whenSettled(controls, 6000, () => {
                    controls.smoothTime = defaultSmoothTime
                    callbacks.current.onIntroComplete?.()
                })
                controls.reset(true)
            }, 350)
        })

        return () => {
            cancelStable()
            clearTimeout(startTimer)
            cancelSettled()
            controls.smoothTime = defaultSmoothTime
        }
    }, [])

    useEffect(() => {
        if (zoomTrigger > 0) {
            moveToMonitor()
        }
    }, [zoomTrigger])
    
    // Handle back button click from parent. Skipped on mount: the intro
    // effect above owns the first reset.
    const hasMounted = useRef(false)
    useEffect(() => {
        if (!hasMounted.current) {
            hasMounted.current = true
            return
        }
        if (isZoomed === false && cameraControlsRef.current) {
            moveCameraToDefault()
        }
    }, [isZoomed])
    
    // Responsive logic
    const isMobile = size.width < 768
    const sceneScale = isMobile ? 0.55 : 0.9
    // Centres the room on the point the camera orbits. On a phone it only
    // needs lifting clear of the command bar.
    const roomOffset = isMobile ? [0, 0.5, 0] : [-1.55, 0.3, -1.15]
    const scenePosition = isMobile ? [0, -0.6, 0] : [0, 0, 0]
    
    const moveToMonitor = () => {
        cameraControlsRef.current.rotateAzimuthTo(-Math.PI/2, true);
        cameraControlsRef.current.fitToBox(meshRef.current, true);
        cameraControlsRef.current.enabled = false;

        cancelZoomWatch.current?.()
        cancelZoomWatch.current = whenSettled(cameraControlsRef.current, 2500, () => {
            callbacks.current.onZoomComplete?.()
        })
    }

    const moveCameraToDefault = () => {
        if (!cameraControlsRef.current) return
        cancelZoomWatch.current?.()
        cameraControlsRef.current.reset(true);
        cameraControlsRef.current.enabled = true;
        camera.updateProjectionMatrix()
        camera.updateWorldMatrix(true, true);
    }

    // Esc and double-click both need to clear isZoomed in the parent too,
    // otherwise the camera resets but the DOM "Back" button stays up.
    const resetView = () => {
        moveCameraToDefault()
        callbacks.current.onResetZoom?.()
    }

    return <>

        {/* multisampling defaults to 8x MSAA on half-float targets, which is
            heavy on integrated GPUs. At a high pixel ratio the edges are
            already fine (and Noise hides the rest), so only pay for 4x when
            the PerformanceMonitor in index.jsx has dropped dpr down. */}
        <EffectComposer multisampling={dpr > 1.25 ? 0 : 4}>
            <Bloom luminanceThreshold={0.92} luminanceSmoothing={0.1} intensity={0.5} height={300} />
            <Noise opacity={0.02} />
            <Vignette eskil={false} offset={0.3} darkness={0.35} />
        </EffectComposer>

        <Lighting night={night} />
        <Stars night={night} />

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
            <group position={roomOffset}>
            <group global rotation={ [ 0, 1, 0 ] }>
                    <group onDoubleClick={resetView} scale={sceneScale} position={scenePosition}>
                        <Level scale={0.3} rotation={[0, Math.PI+0.5, 0]} position={ isMobile ? [0, -1, 0] : [0, -1.4, 2] }>
                            <SunPatch night={night} />
                            <WindowView night={night} />
                            <Lamp on={night} position={[0, 3.06, 0]} rotation={[0, -1.5, 0]} scale={1.6} />
                            <StandingDesk position={[1, 0.6, -2.4]} rotation={[0, 1.6, 0]} scale={3.5} >
                                <SnakePlant position={[0.1, 1.05, 0.7]} scale={0.4} />
                                <Monitor ref={meshRef} iframeSrc={iframeSrc} terminal={terminal} onPosterClick={onPosterClick} position={[0, 0.87, 0]} rotation={[0, Math.PI / 2, 0]} scale={1.5} />
                                <Speakers position={[0, 1.05, -0.45]} rotation={[0,-Math.PI / 2, 0]} />
                                <DeskProps />
                            </StandingDesk>
                        </Level>
                    </group>

            </group>

            {/* Everything casting onto this is static (the lamp is out of the
                scene when this renders), so render the shadow once instead of
                re-rendering the whole scene plus two blur passes every frame. */}
            <ContactShadows
                frames={ 1 }
                position-y={ - 1.4 }
                opacity={ 0.3 }
                scale={ 10 }
                blur={ 3.2 }
            />
            </group>
        </group>

    </>
}