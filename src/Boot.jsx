import { useProgress } from '@react-three/drei'
import { useEffect, useState } from 'react'

const MAX_LINES = 8

const fileName = (url) => url.split('/').pop().split('?')[0]

// The loading screen is a real log: each line is a file the scene just finished
// loading. It also covers the first frames, which hitch while the GPU warms up,
// so it stays until `ready` and then fades out over the scene.
export default function Boot({ ready })
{
    const { item, progress } = useProgress()
    const [loaded, setLoaded] = useState([])

    useEffect(() => {
        if (!item) return
        const name = fileName(item)
        setLoaded((names) => names.includes(name) ? names : [...names, name])
    }, [item])

    return (
        <div className={ready ? 'boot ready' : 'boot'} role="status" aria-label="Loading">
            <div className="boot-log">
                <p className="boot-command"><span className="term-prompt">$</span> ./boot desk</p>
                {loaded.slice(-MAX_LINES).map((name) => (
                    <p key={name}><span className="boot-ok">ok</span> {name}</p>
                ))}
                <p className="boot-progress">{progress < 100 ? `loading ${Math.round(progress)}%` : 'starting'}</p>
            </div>
        </div>
    )
}
