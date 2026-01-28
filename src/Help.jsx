import { useState } from 'react'

export default function Help() {
    const [open, setOpen] = useState(false)

    return (
        <>
            <div 
                className="help-button"
                onClick={() => setOpen(!open)}
                title="Help & Instructions"
            >
                ?
            </div>

            {open && (
                <>
                    <div className="help-backdrop" onClick={() => setOpen(false)} />
                    <div className="help-overlay">
                        <h3>Instructions</h3>
                        <div className="help-item">
                            <span className="help-key">Hover Monitor</span>
                            <span>Zoom into Monitor</span>
                        </div>
                        <div className="help-item">
                            <span className="help-key">Double Click</span>
                            <span>Zoom Out / Reset View</span>
                        </div>
                        <div className="help-item">
                            <span className="help-key">Drag</span>
                            <span>Rotate Camera</span>
                        </div>
                        <div className="help-item">
                            <span className="help-key">Scroll</span>
                            <span>Zoom In / Out</span>
                        </div>
                        <div className="help-item">
                            <span className="help-key">Right Click</span>
                            <span>Pan Camera</span>
                        </div>
                    </div>
                </>
            )}
        </>
    )
}
