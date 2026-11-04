import { useEffect, useState } from 'react'

const ITEMS = [
    ['Buttons', 'Load a site onto the monitor and zoom in'],
    ['Drag', 'Rotate camera'],
    ['Right drag', 'Pan camera'],
    ['Scroll', 'Zoom in / out'],
    ['Double click', 'Reset view'],
    ['Esc', 'Reset view'],
]

export default function Help() {
    const [open, setOpen] = useState(false)

    useEffect(() => {
        if (!open) return
        const onKey = (event) => {
            if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [open])

    return (
        <>
            <button
                type="button"
                className="help-button"
                onClick={() => setOpen(!open)}
                title="Help & Instructions"
                aria-label="Help and instructions"
                aria-expanded={open}
            >
                ?
            </button>

            {open && (
                <>
                    <div className="help-backdrop" onClick={() => setOpen(false)} />
                    <div className="help-overlay" role="dialog" aria-label="Instructions">
                        <h3>Instructions</h3>
                        {ITEMS.map(([key, action]) => (
                            <div className="help-item" key={key}>
                                <span className="help-key">{key}</span>
                                <span>{action}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </>
    )
}
