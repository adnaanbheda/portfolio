import { useEffect, useRef } from 'react'
import saved from './moods.json'

// Every mood's lighting values, from moods.json. The panel in MoodPanel.jsx, which
// only exists in dev, changes this copy live and saves it back to that file. A
// production build never changes it, so nothing here runs per frame.
export const moods = structuredClone(saved)

const listeners = new Set()

export function moodChanged()
{
    listeners.forEach((listener) => listener())
}

// Runs a component's own update when a value changes. Only for values that aren't
// read fresh already.
export function useMoodChange(callback)
{
    const latest = useRef(callback)
    latest.current = callback

    useEffect(() => {
        const listener = () => latest.current()
        listeners.add(listener)
        return () => listeners.delete(listener)
    }, [])
}

// Editing moods.json by hand shows up straight away too.
if (import.meta.hot) {
    import.meta.hot.accept('./moods.json', (module) => {
        if (!module) return
        Object.assign(moods, structuredClone(module.default))
        moodChanged()
    })
}
