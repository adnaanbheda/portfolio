import { useEffect, useMemo } from 'react'
import { CatmullRomCurve3, LatheGeometry, SphereGeometry, TubeGeometry, Vector2, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// One rose under a glass dome, alone outside the room. Level's local units,
// standing on the plateau. Petals and greenery are each one merged mesh.
const DOME_RADIUS = 0.62
const DOME_HEIGHT = 1.9

const BLOOM_Y = 1.12
const PETAL_RINGS = [
    { count: 3, tilt: 0.28, reach: 0.05, size: 0.11 },
    { count: 5, tilt: 0.62, reach: 0.1, size: 0.13 },
    { count: 7, tilt: 1.02, reach: 0.15, size: 0.145 },
]

function makePetals()
{
    const petals = [new SphereGeometry(0.075, 12, 10).scale(1, 1.25, 1).translate(0, BLOOM_Y, 0)]

    PETAL_RINGS.forEach(({ count, tilt, reach, size }, ring) => {
        for (let i = 0; i < count; i++) {
            const turn = (i / count) * Math.PI * 2 + ring * 0.7
            petals.push(
                new SphereGeometry(size, 10, 8)
                    .scale(1, 1.15, 0.3)
                    .rotateX(-tilt)
                    .translate(0, 0, reach)
                    .rotateY(turn)
                    .translate(0, BLOOM_Y - ring * 0.012, 0)
            )
        }
    })

    return mergeGeometries(petals)
}

function makeGreenery()
{
    const stem = new CatmullRomCurve3([
        new Vector3(0, 0.08, 0),
        new Vector3(0.05, 0.42, 0.02),
        new Vector3(-0.03, 0.8, -0.01),
        new Vector3(0, BLOOM_Y - 0.05, 0),
    ])

    const leaf = (height, turn) => new SphereGeometry(0.14, 8, 6)
        .scale(1, 0.1, 0.42)
        .rotateZ(0.5)
        .translate(0.13, height, 0)
        .rotateY(turn)

    return mergeGeometries([
        new TubeGeometry(stem, 24, 0.012, 6),
        leaf(0.46, 0.6),
        leaf(0.68, 3.5),
    ])
}

function makeDome()
{
    const points = [new Vector2(DOME_RADIUS, 0.05)]
    const shoulder = DOME_HEIGHT - DOME_RADIUS

    points.push(new Vector2(DOME_RADIUS, shoulder))
    for (let i = 1; i <= 20; i++) {
        const angle = (i / 20) * (Math.PI / 2)
        points.push(new Vector2(Math.cos(angle) * DOME_RADIUS, shoulder + Math.sin(angle) * DOME_RADIUS))
    }

    return new LatheGeometry(points, 48)
}

// Glass as edge light only: nearly clear face-on, brightening where the surface
// turns away. Reads as glass in any light with no reflections to render.
const vertexShader = /* glsl */`
    varying vec3 vNormal;
    varying vec3 vView;

    void main() {
        vec4 position4 = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-position4.xyz);
        gl_Position = projectionMatrix * position4;
    }
`

const fragmentShader = /* glsl */`
    varying vec3 vNormal;
    varying vec3 vView;

    void main() {
        float edge = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.6);
        gl_FragColor = vec4(vec3(0.94, 0.97, 0.98), 0.05 + edge * 0.75);
        #include <colorspace_fragment>
    }
`

export default function Rose({ onClick, ...props })
{
    const petals = useMemo(makePetals, [])
    const greenery = useMemo(makeGreenery, [])
    const dome = useMemo(makeDome, [])

    useEffect(() => () => {
        petals.dispose()
        greenery.dispose()
        dome.dispose()
    }, [petals, greenery, dome])

    const setCursor = (cursor) => () => { document.body.style.cursor = cursor }

    return (
        <group
            {...props}
            onClick={(event) => {
                event.stopPropagation()
                onClick()
            }}
            onPointerOver={setCursor('pointer')}
            onPointerOut={setCursor('auto')}
        >
            <mesh position-y={0.04}>
                <cylinderGeometry args={[DOME_RADIUS + 0.08, DOME_RADIUS + 0.12, 0.09, 40]} />
                <meshStandardMaterial color="#3a2a22" roughness={0.6} />
            </mesh>
            <mesh geometry={greenery}>
                <meshStandardMaterial color="#3f5a3c" roughness={0.8} />
            </mesh>
            <mesh geometry={petals}>
                <meshStandardMaterial color="#7d1826" roughness={0.55} />
            </mesh>
            <mesh geometry={dome} renderOrder={5}>
                <shaderMaterial vertexShader={vertexShader} fragmentShader={fragmentShader} transparent depthWrite={false} />
            </mesh>
            <mesh position-y={DOME_HEIGHT + 0.05}>
                <sphereGeometry args={[0.055, 12, 10]} />
                <meshStandardMaterial color="#3a2a22" roughness={0.5} />
            </mesh>
        </group>
    )
}
