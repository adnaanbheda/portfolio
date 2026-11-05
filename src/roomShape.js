// The room's shape, after Gaudí: one wall that curves round the corner, swells in
// and out, and rises and falls along its top. Everything that has to sit on the
// wall (window frame, view, floor light) reads its position from here, so it
// follows the curve. Room-local units, y up; x runs along the desk wall, z along
// the window wall, and the open sides face +x and +z.

export const FLOOR_Y = 0.56
export const WALL_THICKNESS = 0.5
export const BAND_HEIGHT = 0.7

const INNER = -3.56
const WALL_END = 4.3
const CORNER_RADIUS = 1.6

const STRAIGHT = WALL_END - (INNER + CORNER_RADIUS)
const CORNER_LENGTH = (Math.PI / 2) * CORNER_RADIUS

export const WALL_LENGTH = STRAIGHT * 2 + CORNER_LENGTH

// Catenary-like arch, centred on the window wall.
export const WINDOW = {
    centre: WALL_END - 0.14,
    halfWidth: 2.1,
    sill: 2,
    apex: 6.5,
}

// Where along the wall `s` falls, and which way is into the room.
export function pathAt(s)
{
    if (s <= STRAIGHT) return { x: INNER, z: WALL_END - s, nx: 1, nz: 0 }

    if (s <= STRAIGHT + CORNER_LENGTH) {
        const angle = Math.PI + (s - STRAIGHT) / CORNER_RADIUS
        const middle = INNER + CORNER_RADIUS
        return {
            x: middle + Math.cos(angle) * CORNER_RADIUS,
            z: middle + Math.sin(angle) * CORNER_RADIUS,
            nx: -Math.cos(angle),
            nz: -Math.sin(angle),
        }
    }

    return { x: INNER + CORNER_RADIUS + (s - STRAIGHT - CORNER_LENGTH), z: INNER, nx: 0, nz: 1 }
}

const swell = (s, y) => 0.16 * Math.sin(s * 0.8 + 0.5) * (0.65 + 0.35 * Math.sin(y * 0.55 + s * 0.3))

// A point on the wall. `depth` is measured into the room, so the outer face is
// at -WALL_THICKNESS.
export function wallPoint(s, y, depth = 0)
{
    const { x, z, nx, nz } = pathAt(s)
    const offset = swell(s, y) + depth
    return [x + nx * offset, y, z + nz * offset]
}

// The wave along the top, sinking towards the two free ends.
export function wallHeight(s)
{
    const fromEnd = Math.min(s, WALL_LENGTH - s)
    const wave = 7.7 + 0.45 * Math.sin(s * 0.85 + 0.4) + 0.2 * Math.sin(s * 1.9)
    return wave * (0.62 + 0.38 * (1 - Math.exp(-fromEnd * 0.8)))
}

export const archTop = (t) => WINDOW.sill + (WINDOW.apex - WINDOW.sill) * (1 - t * t)

export function inWindow(s, y)
{
    const t = (s - WINDOW.centre) / WINDOW.halfWidth
    return Math.abs(t) < 1 && y > WINDOW.sill && y < archTop(t)
}

// Muted Park Güell colours, shared by the mosaic and the glass.
export const AMBER = '#d9a441'
export const RUBY = '#a8423f'
export const COBALT = '#2f5f8f'
export const EMERALD = '#3f8a78'
