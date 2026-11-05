import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { complete } from './commands'

function Line({ line, onCommand })
{
    if (line.kind === 'input') {
        return <p className="term-line term-echo"><span className="term-prompt">$</span> {line.text}</p>
    }

    if (line.kind === 'row') {
        return (
            <p className={`term-line term-row${line.stack ? ' term-stack' : ''}`}>
                {line.run && <button type="button" className="term-name" onClick={() => onCommand(line.run)}>{line.name}</button>}
                {line.href && <a className="term-name" href={line.href} target="_blank" rel="noopener noreferrer">{line.name}</a>}
                {!line.run && !line.href && <span className="term-name">{line.name}</span>}
                <span>{line.text}</span>
            </p>
        )
    }

    return <p className={`term-line${line.tone ? ` term-${line.tone}` : ''}`}>{line.text || ' '}</p>
}

// Rendered inside the monitor's <Html>, which is a separate React root with the
// scene's pointer handling on an ancestor: the double-click stop below is what
// keeps selecting a word from resetting the camera.
export default function Terminal({ lines, onCommand })
{
    const [value, setValue] = useState('')
    const [historyIndex, setHistoryIndex] = useState(null)
    const scrollerRef = useRef(null)
    const inputRef = useRef(null)

    const history = useMemo(
        () => lines.filter((line) => line.kind === 'input').map((line) => line.text),
        [lines]
    )

    // Bring the latest command to the top of the screen, so an answer taller than
    // the monitor opens at its start. When it all fits, the browser clamps this
    // to the bottom, which keeps the prompt in view. scrollTop, not
    // scrollIntoView: that also scrolls every ancestor, and the ancestors here
    // are the 3D-transformed Html wrappers.
    useLayoutEffect(() => {
        const scroller = scrollerRef.current
        const commands = scroller.querySelectorAll('.term-echo')
        const latest = commands[commands.length - 1]
        if (!latest) return
        const belowBand = parseFloat(getComputedStyle(scroller).fontSize) * 0.8
        scroller.scrollTop = latest.offsetTop - belowBand
    }, [lines])

    const focusInput = () => inputRef.current?.focus({ preventScroll: true })

    // Not on touch screens: the on-screen keyboard would cover the monitor, and
    // the command bar already does everything without it.
    useEffect(() => {
        if (window.matchMedia('(hover: hover)').matches) focusInput()
    }, [])

    const submit = (event) => {
        event.preventDefault()
        const command = value.trim()
        setValue('')
        setHistoryIndex(null)
        if (command) onCommand(command)
    }

    const stepHistory = (step) => {
        if (!history.length) return
        const from = historyIndex ?? history.length
        const next = Math.min(Math.max(from + step, 0), history.length)
        setHistoryIndex(next === history.length ? null : next)
        setValue(history[next] ?? '')
    }

    const handleKeyDown = (event) => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault()
            stepHistory(event.key === 'ArrowUp' ? -1 : 1)
        }
        // Empty input lets Tab through, so keyboard users can reach the links.
        if (event.key === 'Tab' && value) {
            event.preventDefault()
            setValue(complete(value))
        }
    }

    const handleClick = () => {
        if (!window.getSelection()?.toString()) focusInput()
    }

    return (
        <div
            className="terminal"
            ref={scrollerRef}
            onClick={handleClick}
            onDoubleClick={(event) => event.stopPropagation()}
        >
            <div role="log" aria-live="polite">
                <p className="term-line term-dim">Type help, or pick a command below.</p>
                {lines.map((line, index) => <Line key={index} line={line} onCommand={onCommand} />)}
            </div>
            <form className="term-input" onSubmit={submit}>
                <label className="term-prompt" htmlFor="terminal-input">$</label>
                <input
                    id="terminal-input"
                    ref={inputRef}
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    onKeyDown={handleKeyDown}
                    aria-label="Command"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="send"
                />
            </form>
        </div>
    )
}
