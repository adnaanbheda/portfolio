import { LINKS } from './commands'

// The terminal without a keyboard, and the way in from the room: a command run
// from here zooms to the monitor first. CV and LinkedIn are real links because
// a new tab opened after the zoom would be caught by the popup blocker.
export default function CommandBar({ isZoomed, onCommand })
{
    const button = (command) => (
        <button type="button" onClick={() => onCommand(command)}>{command}</button>
    )
    const link = (label, href) => (
        <a href={href} target="_blank" rel="noopener noreferrer">{label}</a>
    )

    return (
        <nav className="command-bar" aria-label="Terminal commands">
            {button(isZoomed ? 'exit' : 'whoami')}
            {button('projects')}
            {button('work')}
            {link('cv', LINKS.cv)}
            {link('linkedin', LINKS.linkedin)}
            {button('help')}
        </nav>
    )
}
