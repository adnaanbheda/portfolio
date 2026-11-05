import { invalidate } from '@react-three/fiber'
import { button, Leva, useControls } from 'leva'
import { moodChanged, moods } from './moods'

// Live sliders for moods.json, in dev only: index.jsx never loads this file in a
// production build. Night's sliders only show with the night button on.
const RANGES = {
    day: {
        fillLight: [0, 3, 0.05],
        keyLight: [0, 3, 0.05],
        floorLight: [0, 1, 0.01],
        floorSaturation: [0, 2.5, 0.05],
        beams: [0, 3, 0.05],
        glassGlimmer: [0, 2, 0.05],
        sunGlow: [0, 0.5, 0.01],
    },
    night: {
        fillLight: [0, 3, 0.05],
        keyLight: [0, 2, 0.01],
        glassGlimmer: [0, 1, 0.01],
        lampLight: [0, 4, 0.05],
        lampRoomFill: [0, 1.5, 0.01],
        lampGlow: [0, 1, 0.01],
    },
}

const change = (group, name) => (value) => {
    moods[group][name] = value
    moodChanged()
    invalidate()
}

const sliders = (group) => Object.fromEntries(
    Object.entries(RANGES[group]).map(([name, [min, max, step]]) => [
        name,
        { value: moods[group][name], min, max, step, onChange: change(group, name) },
    ])
)

const swatches = (group) => Object.fromEntries(
    Object.keys(moods[group]).map((name) => [
        name,
        { value: moods[group][name], onChange: change(group, name) },
    ])
)

async function save()
{
    const response = await fetch('/__save-moods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Save-Moods': '1' },
        body: JSON.stringify(moods),
    })
    if (!response.ok) console.error(`Moods not saved: ${response.status} ${await response.text()}`)
}

export default function MoodPanel()
{
    useControls('day', () => sliders('day'))
    useControls('night', () => sliders('night'))
    useControls('light colours', () => swatches('lightColours'))
    useControls('planet', () => swatches('planet'))
    useControls({ 'save to moods.json': button(save) })

    // Below the mood button, and out of the way on a phone.
    return <Leva hidden={window.innerWidth < 768} titleBar={{ position: { x: 0, y: 66 } }} />
}
