import { useEffect, useMemo } from 'react'
import { BufferGeometry, CanvasTexture, CatmullRomCurve3, Color, ExtrudeGeometry, Float32BufferAttribute, RepeatWrapping, Shape, SphereGeometry, SRGBColorSpace, TubeGeometry, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { archTop, BAND_HEIGHT, FLOOR_Y, inWindow, WALL_LENGTH, WALL_THICKNESS, wallHeight, wallPoint, WINDOW } from './roomShape'

// The room, after Gaudí: stone wall, trencadís mosaic on the floor and along the
// parapet, and an arched window with bone-like tracery. All built here, in four
// merged meshes, so the whole shell costs four draw calls.
const STONE = new Color('#f1e9d6')
const IRON = '#1f4650'
const GROUT = '#ddd3bd'

// Long drifts of colour through the broken tile, as on the Park Güell bench.
// Colour stays up on the parapet; the floor is quiet stone tones, so the room
// has somewhere to rest.
const PARAPET_TILES = ['#e4d8bd', '#c9a657', '#b9764f', '#e4d8bd', '#5f9184', '#3f6a8f', '#e4d8bd', '#9c4a45']
const FLOOR_TILES = ['#e0d3b6', '#d6c5a2', '#e0d3b6', '#cbb48c', '#e0d3b6', '#c0a57c', '#d6c5a2', '#a9a78a']

const STEPS_ALONG = 150
const STEPS_UP = 44

function drawMosaic(tiles)
{
    const size = 1024
    const cells = 46
    const cell = size / cells
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const context = canvas.getContext('2d')

    context.fillStyle = GROUT
    context.fillRect(0, 0, size, size)

    const jitter = () => (Math.random() - 0.5) * cell * 0.5
    const corners = []
    for (let row = 0; row <= cells; row++) {
        corners.push([])
        for (let column = 0; column <= cells; column++) {
            corners[row].push([column * cell + jitter(), row * cell + jitter()])
        }
    }

    for (let row = 0; row < cells; row++) {
        for (let column = 0; column < cells; column++) {
            const flow = Math.sin(column * 0.16 + Math.sin(row * 0.12) * 2.2) + Math.sin(row * 0.09 + column * 0.05)
            const pick = Math.floor(((flow + 2) / 4) * tiles.length + Math.random() * 1.6)
            context.fillStyle = tiles[Math.min(pick, tiles.length - 1)]

            const shard = [corners[row][column], corners[row][column + 1], corners[row + 1][column + 1], corners[row + 1][column]]
            const middle = shard.reduce(([x, y], [px, py]) => [x + px / 4, y + py / 4], [0, 0])

            context.beginPath()
            for (const [x, y] of shard) context.lineTo(middle[0] + (x - middle[0]) * 0.86, middle[1] + (y - middle[1]) * 0.86)
            context.fill()
        }
    }

    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.wrapS = texture.wrapT = RepeatWrapping
    texture.anisotropy = 8
    return texture
}

// A sheet of quads from a function of its grid position. `skip` leaves a cell out;
// `flip` turns the sheet to face the other way.
function makeSheet(columns, rows, point, { skip, flip, colour, uv } = {})
{
    const positions = []
    const colours = []
    const uvs = []
    const indices = []

    for (let j = 0; j <= rows; j++) {
        for (let i = 0; i <= columns; i++) {
            positions.push(...point(i / columns, j / rows))
            if (colour) colours.push(...colour(i / columns, j / rows))
            uvs.push(...(uv ? uv(i / columns, j / rows) : [0, 0]))
        }
    }

    for (let j = 0; j < rows; j++) {
        for (let i = 0; i < columns; i++) {
            if (skip?.((i + 0.5) / columns, (j + 0.5) / rows)) continue
            const a = j * (columns + 1) + i
            const b = a + 1
            const c = b + columns + 1
            const d = a + columns + 1
            indices.push(...(flip ? [a, c, b, a, d, c] : [a, b, c, a, c, d]))
        }
    }

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
    if (colour) geometry.setAttribute('color', new Float32BufferAttribute(colours, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return geometry
}

const alongWall = (u) => u * WALL_LENGTH
const stoneTop = (s) => wallHeight(s) - BAND_HEIGHT

// Faint bands of tone, following the wall's flow like weathered limestone.
function stoneColour(s, y)
{
    const tone = 1 - 0.05 * (0.5 + 0.5 * Math.sin(y * 2.1 + Math.sin(s * 0.8) * 1.6))
    return [STONE.r * tone, STONE.g * tone, STONE.b * tone]
}

function makeStone()
{
    const face = (depth, flip) => makeSheet(
        STEPS_ALONG,
        STEPS_UP,
        (u, v) => wallPoint(alongWall(u), v * stoneTop(alongWall(u)), depth),
        {
            flip,
            skip: (u, v) => inWindow(alongWall(u), v * stoneTop(alongWall(u))),
            colour: (u, v) => stoneColour(alongWall(u), v * stoneTop(alongWall(u))),
        }
    )

    const end = (s, flip) => makeSheet(
        2,
        STEPS_UP,
        (u, v) => wallPoint(s, v * wallHeight(s), -u * WALL_THICKNESS),
        { flip, colour: (u, v) => stoneColour(s, v * wallHeight(s)) }
    )

    return mergeGeometries([
        face(0, false),
        face(-WALL_THICKNESS, true),
        end(0, true),
        end(WALL_LENGTH, false),
    ])
}

function makeFloor()
{
    const outline = new Shape()
    outline.moveTo(-3.8, 4.3)
    outline.lineTo(-3.8, -2.2)
    outline.quadraticCurveTo(-3.8, -3.8, -2.2, -3.8)
    outline.lineTo(4.3, -3.8)
    // The open edges are scalloped, like the bench at Park Güell.
    outline.bezierCurveTo(5.1, -2.2, 3.7, -1.4, 4.5, 0.1)
    outline.bezierCurveTo(5, 1.6, 3.9, 2.6, 4.1, 3.9)
    outline.bezierCurveTo(2.7, 3.7, 1.8, 4.9, 0.2, 4.5)
    outline.bezierCurveTo(-1.3, 4.1, -2.4, 4.9, -3.8, 4.3)

    const geometry = new ExtrudeGeometry(outline, { depth: FLOOR_Y, bevelEnabled: false, curveSegments: 20 })
    geometry.rotateX(Math.PI / 2)
    geometry.translate(0, FLOOR_Y, 0)

    const uv = geometry.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.14, uv.getY(i) * 0.14)
    return geometry
}

// Mosaic band under the parapet, rolling over the wall top like a bench back.
// The roll eases out at the wall's two free ends, so they finish flush.
const easeAtEnds = (s) => Math.min(1, Math.min(s, WALL_LENGTH - s) / 0.7)

function makeParapet()
{
    const band = makeSheet(
        STEPS_ALONG,
        6,
        (u, v) => {
            const s = alongWall(u)
            return wallPoint(s, stoneTop(s) + v * BAND_HEIGHT, Math.sin(v * Math.PI) * 0.14 * easeAtEnds(s))
        },
        { uv: (u, v) => [u * WALL_LENGTH * 0.14, v * BAND_HEIGHT * 0.14] }
    )

    const cap = makeSheet(
        STEPS_ALONG,
        5,
        (u, v) => {
            const s = alongWall(u)
            return wallPoint(s, wallHeight(s) + Math.sin(v * Math.PI) * 0.12 * easeAtEnds(s), -v * WALL_THICKNESS)
        },
        { uv: (u, v) => [u * WALL_LENGTH * 0.14, 0.2 + v * 0.07] }
    )

    const outer = makeSheet(
        STEPS_ALONG,
        3,
        (u, v) => {
            const s = alongWall(u)
            return wallPoint(s, stoneTop(s) + v * BAND_HEIGHT, -WALL_THICKNESS)
        },
        { flip: true, uv: (u, v) => [u * WALL_LENGTH * 0.14, 0.4 + v * 0.1] }
    )

    return mergeGeometries([band, cap, outer])
}

function tube(points, radius, closed = false)
{
    const curve = new CatmullRomCurve3(points.map((point) => new Vector3(...point)), closed)
    return new TubeGeometry(curve, closed ? 110 : 26, radius, 7, closed)
}

// A point on the window, from -1 to 1 across it and 0 to 1 up to the arch.
function onWindow(t, rise, depth = -0.14)
{
    const s = WINDOW.centre + t * WINDOW.halfWidth
    return wallPoint(s, WINDOW.sill + (archTop(t) - WINDOW.sill) * rise, depth)
}

function makeFrame()
{
    const arch = []
    for (let i = 0; i <= 44; i++) {
        const t = -1 + (i / 44) * 2
        arch.push(wallPoint(WINDOW.centre + t * WINDOW.halfWidth, archTop(t), -0.04))
    }
    for (let i = 1; i < 10; i++) {
        const t = 1 - (i / 10) * 2
        arch.push(wallPoint(WINDOW.centre + t * WINDOW.halfWidth, WINDOW.sill, -0.04))
    }

    // Tracery that grows from the sill and branches, more bone than bar.
    const trunk = [onWindow(0, 0), onWindow(0.03, 0.22), onWindow(-0.02, 0.42), onWindow(0, 0.62)]
    const branch = (side) => [onWindow(0, 0.6), onWindow(side * 0.2, 0.74), onWindow(side * 0.34, 0.88), onWindow(side * 0.46, 1)]
    const rib = (side) => [onWindow(0.01, 0.3), onWindow(side * 0.34, 0.42), onWindow(side * 0.66, 0.5), onWindow(side, 0.5)]
    const crown = [onWindow(0, 0.6), onWindow(0, 0.8), onWindow(0, 1)]

    const joint = (point, radius) => new SphereGeometry(radius, 10, 8).translate(...point)

    return mergeGeometries([
        tube(arch, 0.15, true),
        tube(trunk, 0.075),
        tube(branch(1), 0.055),
        tube(branch(-1), 0.055),
        tube(rib(1), 0.055),
        tube(rib(-1), 0.055),
        tube(crown, 0.055),
        joint(onWindow(0, 0.6), 0.14),
        joint(onWindow(0.01, 0.3), 0.12),
    ].map((geometry) => {
        const flat = geometry.index ? geometry.toNonIndexed() : geometry
        flat.deleteAttribute('uv')
        return flat
    }))
}

export default function Room({ children, ...props })
{
    const stone = useMemo(makeStone, [])
    const frame = useMemo(makeFrame, [])
    const floor = useMemo(makeFloor, [])
    const parapet = useMemo(makeParapet, [])
    const floorTiles = useMemo(() => drawMosaic(FLOOR_TILES), [])
    const parapetTiles = useMemo(() => drawMosaic(PARAPET_TILES), [])

    useEffect(() => () => {
        stone.dispose()
        frame.dispose()
        floor.dispose()
        parapet.dispose()
        floorTiles.dispose()
        parapetTiles.dispose()
    }, [stone, frame, floor, parapet, floorTiles, parapetTiles])

    return (
        <group {...props}>
            <mesh geometry={stone}>
                <meshLambertMaterial vertexColors />
            </mesh>
            <mesh geometry={floor}>
                <meshLambertMaterial map={floorTiles} />
            </mesh>
            <mesh geometry={parapet}>
                <meshLambertMaterial map={parapetTiles} />
            </mesh>
            <mesh geometry={frame}>
                <meshLambertMaterial color={IRON} />
            </mesh>
            {children}
        </group>
    )
}
