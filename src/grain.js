// Grain as one small tile repeated by the canvas, not thousands of dots drawn
// one at a time: that was a third of a second of blocking on a slow phone.
const TILE = 256

export function fillGrain(context, width, height, { dark, light, dots = 3000 })
{
    const tile = document.createElement('canvas')
    tile.width = tile.height = TILE
    const paint = tile.getContext('2d')

    for (let i = 0; i < dots; i++) {
        paint.fillStyle = i % 2 ? dark : light
        const size = 1 + Math.random() * 1.5
        paint.fillRect(Math.random() * TILE, Math.random() * TILE, size, size)
    }

    context.fillStyle = context.createPattern(tile, 'repeat')
    context.fillRect(0, 0, width, height)
}
