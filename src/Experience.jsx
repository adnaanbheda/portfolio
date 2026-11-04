import { CameraControls, CameraControlsImpl, ContactShadows, Sparkles, Svg, Text } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'
import linkedinSvg from '../public/linkedin.svg'
import resumeSvg from '../public/resume.svg'
import Lamp from './Lamplight'
import Level from './Level'
import Monitor from './Monitor'
import SnakePlant from './SnakePlant'
import Speakers from './Speakers'
import StandingDesk from './StandingDesk'

// The monitor's screen content is a drei <Html transform>, which projects
// through a CSS matrix3d built from the object's full world-space scale.
// This scene's original scale chain put that scale around 1e-4 - fine for
// Chromium's matrix3d decomposition, but small enough that Safari/WebKit's
// (which every iOS browser runs on, Chrome included) loses precision and
// collapses the iframe to a ~0px degenerate box, rendering it detached from
// the screen mesh. Blowing up every spatial prop in the scene by the same
// factor gives WebKit a numerically safe matrix to work with. HOME_FRAMES
// below is in these scaled world units.
const SCENE_SCALE_FACTOR = 100

// Yaw of the two groups the room hangs from. The isometric azimuth is derived
// from them, so turning the room keeps the view square to its corner.
const SCENE_YAW = 1
const LEVEL_YAW = Math.PI + 0.5

// True isometric: orthographic (see <Canvas> in index.jsx), looking down the
// diagonal of the room's cube. Azimuth is 45 degrees off the walls, towards the
// open corner; elevation is atan(1/sqrt(2)) = 35.26 degrees, which foreshortens
// all three axes equally and puts the floor edges at 30 degrees on screen.
const ISO_AZIMUTH = SCENE_YAW + LEVEL_YAW + Math.PI / 4 - Math.PI * 2
const ISO_POLAR = Math.PI / 2 - Math.atan(1 / Math.SQRT2)

// Orthographic distance doesn't change the image, it only has to clear the
// scene so nothing lands behind the near plane.
const CAMERA_DISTANCE = 6 * SCENE_SCALE_FACTOR

// What the home view frames: the point at the centre of the screen, and the
// world-unit area that must fit. An orthographic camera's zoom is pixels per
// world unit, so unlike the old perspective fov it doesn't follow the viewport
// by itself - see homeZoom.
const HOME_FRAMES = {
    desktop: { target: [106, -40, 37], width: 640, height: 470 },
    mobile: { target: [0, -20, 0], width: 240, height: 380 },
}

// The intro zooms in from this fraction of the home zoom. Zoom is the only
// thing that moves, so the view is isometric from the first frame.
const INTRO_ZOOM = 0.8

// How close (as a fraction of the home zoom) the intro must get to count as
// arrived: the last of the ease-out tail, which by then is barely moving.
const SETTLED_ZOOM = 0.006

export default function Experience({ iframeSrc, zoomTrigger, onResetZoom, onIntroComplete, isZoomed })
{
    const meshRef = useRef()
    const cameraControlsRef = useRef()
    const { camera, size } = useThree()
    const dpr = useThree((state) => state.viewport.dpr)

    // Parent callbacks are fresh closures every render, but they get called
    // from listeners set up once. Always go through the latest.
    const callbacks = useRef({})
    callbacks.current = { onResetZoom, onIntroComplete }

    // Registered once. This used to be a bare addEventListener in the render
    // body, which stacked one more listener on every re-render (every iframe
    // switch, every resize).
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') resetView()
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [])

    // Responsive logic
    const isMobile = size.width < 768
    const textPosition = isMobile ? [-0.25, 1.5, 0] : [-1.5, 0.5, 0]
    const textScale = isMobile ? 0.6 : 1
    const sceneScale = isMobile ? 0.55 : 1
    const scenePosition = isMobile ? [0, -0.6, 0] : [0, 0, 0]

    // Read through a ref by listeners set up once, like callbacks above.
    const frame = isMobile ? HOME_FRAMES.mobile : HOME_FRAMES.desktop
    const homeZoom = Math.min(size.width / frame.width, size.height / frame.height)
    const home = useRef()
    home.current = { frame, zoom: homeZoom, isZoomed }

    // The one default pose: first load, Esc, Back and double-click all land here.
    const goHome = (enableTransition) => {
        const controls = cameraControlsRef.current
        const { frame, zoom } = home.current
        const target = new Vector3(...frame.target)
        const position = new Vector3()
            .setFromSphericalCoords(CAMERA_DISTANCE, ISO_POLAR, ISO_AZIMUTH)
            .add(target)
        controls.setLookAt(...position.toArray(), ...target.toArray(), enableTransition)
        controls.zoomTo(zoom, enableTransition)
    }

    // Intro: start slightly zoomed out on the isometric pose, then glide in
    // once the scene is on screen.
    //
    // The monitor iframe (a whole YouTube player) is only loaded once this
    // glide has finished - onIntroComplete - so its startup work doesn't
    // stutter the first thing a visitor sees.
    useEffect(() => {
        const controls = cameraControlsRef.current
        if (!controls) return

        let done = false
        const finish = () => {
            if (done) return
            done = true
            controls.smoothTime = defaultSmoothTime
            controls.removeEventListener('update', checkSettled)
            callbacks.current.onIntroComplete?.()
        }

        // Not zoomTo()'s promise: that resolves on camera-controls' 'rest'
        // event, so the camera spends seconds creeping through sub-pixel
        // movement before it counts as resting. Instead, call it done once the
        // camera is visually at its end pose.
        const checkSettled = () => {
            const { zoom } = home.current
            if (Math.abs(camera.zoom - zoom) / zoom < SETTLED_ZOOM) finish()
        }

        // Dolly does nothing visible on an orthographic camera.
        controls.mouseButtons.middle = CameraControlsImpl.ACTION.ZOOM

        const defaultSmoothTime = controls.smoothTime
        goHome(false)
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            finish()
            return
        }

        controls.zoomTo(home.current.zoom * INTRO_ZOOM, false)
        controls.smoothTime = 0.9

        // Give drei's <Loader> fade a moment so the move is actually seen.
        const startTimer = setTimeout(() => {
            controls.addEventListener('update', checkSettled)
            controls.zoomTo(home.current.zoom, true)
        }, 350)
        // Backstop so the iframe always arrives, even if the visitor grabs the
        // camera mid-glide and keeps it moving.
        const fallbackTimer = setTimeout(finish, 6000)

        return () => {
            clearTimeout(startTimer)
            clearTimeout(fallbackTimer)
            controls.removeEventListener('update', checkSettled)
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
    
    // Zoom is in pixels, so a resize has to re-fit whatever is being framed.
    const lastSize = useRef(size)
    useEffect(() => {
        if (lastSize.current === size) return
        lastSize.current = size
        if (home.current.isZoomed) {
            cameraControlsRef.current.fitToBox(meshRef.current, false)
        } else {
            goHome(false)
        }
    }, [size])

    const moveToMonitor = () => {
        cameraControlsRef.current.rotateAzimuthTo(-Math.PI/2, true);
        cameraControlsRef.current.fitToBox(meshRef.current, true);
        cameraControlsRef.current.enabled = false;
    }

    const moveCameraToDefault = () => {
        if (!cameraControlsRef.current) return
        goHome(true);
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

    const openExternal = (url) => window.open(url, '_blank', 'noopener,noreferrer')
    const setPointer = (on) => () => { document.body.style.cursor = on ? 'pointer' : 'auto' }

    return <>

        {/* multisampling defaults to 8x MSAA on half-float targets, which is
            heavy on integrated GPUs. At a high pixel ratio the edges are
            already fine (and Noise hides the rest), so only pay for 4x when
            the PerformanceMonitor in index.jsx has dropped dpr down. */}
        <EffectComposer multisampling={dpr > 1.25 ? 0 : 4}>
            <Bloom luminanceThreshold={0} luminanceSmoothing={0} height={300} />
            <Noise opacity={0.09} />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>

        <CameraControls
            ref={cameraControlsRef}
            minAzimuthAngle={-Math.PI /2}
            maxAzimuthAngle={Math.PI / 8}
            minPolarAngle={0.5}
            maxPolarAngle={isMobile ? 2 : 1.5}
            rotation={ [ 0, 1, 0 ] }
            polar={ [ - 0.3, 0 ] }
            azimuth={ [ -2, 0.75 ] } />

        {/* Everything spatial lives at SCENE_SCALE_FACTOR x the scale the whole
            scene was originally authored/tuned at - see the constant's comment.
            Nothing in here needed its own numbers touched; scaling one shared
            ancestor keeps every relative position/size exactly as it was. */}
        <group scale={SCENE_SCALE_FACTOR}>
            <group
                position={ textPosition }
                rotation={[0, ISO_AZIMUTH, 0]}
                scale={textScale}
            >
                <Sparkles
                    size={0.2}
                />
                <Text
                    font="./jost.ttf"
                    fontSize={ isMobile ? 0.25 : 0.4 }
                    maxWidth={ 1 }
                >
                    Adnaan Bheda
                    Hi.
                </Text>
                <group>
                    <Svg position={isMobile?[-0.5, -0.7, 0]:[-0.35, -0.9, 0]} onClick={() => openExternal('/cv.pdf')} src={resumeSvg} alt="Resume" scale={0.001} onPointerOver={setPointer(true)} onPointerOut={setPointer(false)} />
                    <Svg position={isMobile?[-0.2, -0.7, 0]:[-0.65, -0.9, 0]} onClick={() => openExternal('https://linkedin.com/in/adnaanb')} src={linkedinSvg} alt="LinkedIn" scale={0.001} onPointerOver={setPointer(true)} onPointerOut={setPointer(false)} />
                </group>
            </group>

            <group global rotation={ [ 0, SCENE_YAW, 0 ] }>
                    <group onDoubleClick={resetView} scale={sceneScale} position={scenePosition}>
                        <Level scale={0.3} rotation={[0, LEVEL_YAW, 0]} position={ isMobile ? [0, -1, 0] : [0, -1.4, 2] }>
                            <Lamp position={[0, 5,0]} rotation={[0, -1.5, 0]} scale={2.25} intensity={0.2} />
                            <StandingDesk position={[1, 0.6, -2.4]} rotation={[0, 1.6, 0]} scale={3.5} >
                                <SnakePlant position={[0.1, 1.05, 0.7]} scale={0.4} />
                                <Monitor ref={meshRef} iframeSrc={iframeSrc} position={[0, 0.87, 0]} rotation={[0, Math.PI / 2, 0]} scale={1.5} />
                                <Speakers position={[0, 1.05, -0.45]} rotation={[0,-Math.PI / 2, 0]} />
                            </StandingDesk>
                        </Level>
                    </group>

            </group>

            {/* Everything casting onto this is static (the lamp swing is too
                small to read here), so render the shadow once instead of
                re-rendering the whole scene plus two blur passes every frame. */}
            <ContactShadows
                frames={ 1 }
                position-y={ - 1.4 }
                opacity={ 0.4 }
                scale={ 10 }
                blur={ 2.4 }
            />
        </group>

    </>
}