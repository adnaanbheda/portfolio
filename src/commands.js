// Everything the terminal can say lives here. Editing the portfolio's content
// means editing this file; nothing below it knows what the words are.
//
// execute() returns { lines, effect }:
//   lines  - what to print. { kind: 'text', text, tone } or a two-column
//            { kind: 'row', name, text, run | href }, where `run` makes the name
//            a button that runs a command and `href` makes it a link.
//   effect - optional: 'clear', 'exit', { open: src } to put a site on the
//            monitor, { url } to open a new tab, or { night } to set the mood.

export const LINKS = {
    cv: '/cv.pdf',
    linkedin: 'https://linkedin.com/in/adnaanb',
    github: 'https://github.com/adnaanbheda',
}

// Sites that can load on the monitor. `listed` puts one under `projects`.
const APPS = {
    localwrite: {
        src: 'https://localwrite.adnaan.me',
        about: 'a writing app that saves to a folder on your computer',
        listed: true,
    },
    youtube: {
        src: 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1&loop=1&playsinline=1&playlist=dQw4w9WgXcQ',
        about: 'a video',
    },
}

const text = (value, tone) => ({ kind: 'text', text: value, tone })
const run = (name, about, command = name) => ({ kind: 'row', name, text: about, run: command })
const link = (name, about, href) => ({ kind: 'row', name, text: about, href })

const help = () => ({
    lines: [
        run('whoami', 'who this is'),
        run('projects', 'things I have built'),
        run('work', 'where I have worked'),
        run('skills', 'languages and tools'),
        run('contact', 'where to find me'),
        run('cv', 'open my CV as a PDF'),
        run('youtube', APPS.youtube.about, 'open youtube'),
        run('night', 'turn the lamp on'),
        run('day', 'let the sun back in'),
        run('clear', 'clear the screen'),
        run('exit', 'step back from the desk'),
        text(''),
        text('Outside the terminal: drag to look around, scroll to zoom.', 'dim'),
    ],
})

const whoami = () => ({
    lines: [
        text('Adnaan Bheda'),
        text('Backend engineer. I have stopped spam at Atlassian, scaled'),
        text('healthcare APIs at Klinify and run routing at Roado.'),
        text(''),
        run('projects', 'see what I have built'),
        run('work', 'see where I have worked'),
    ],
})

const projects = () => ({
    lines: [
        ...Object.entries(APPS)
            .filter(([, app]) => app.listed)
            .map(([name, app]) => run(name, app.about, `open ${name}`)),
        link('portfolio', 'this room, built with React Three Fiber', `${LINKS.github}/portfolio`),
        link('github', 'everything else', LINKS.github),
    ],
})

const work = () => ({
    lines: [
        { kind: 'row', name: 'atlassian', text: '2022-2025. Spam and abuse detection in Go and Rego, data residency for marketplace apps.' },
        { kind: 'row', name: 'klinify', text: '2020-2022. Async APIs at 10K requests/sec, a FHIR terminology service, Kubernetes on AKS.' },
        { kind: 'row', name: 'roado', text: '2020. OSRM routing on OpenStreetMap, RabbitMQ workers, Kubernetes on AWS.' },
    ],
})

const skills = () => ({
    lines: [
        { kind: 'row', name: 'languages', text: 'Python, Java, Kotlin, Go, TypeScript' },
        { kind: 'row', name: 'backend', text: 'FastAPI, Spring Boot, Node.js, OPA/Rego, RabbitMQ' },
        { kind: 'row', name: 'data', text: 'PostgreSQL, MongoDB, Redis, DynamoDB' },
        { kind: 'row', name: 'infra', text: 'Kubernetes, Docker, Azure AKS, AWS' },
        { kind: 'row', name: 'frontend', text: 'React, React Native, Three.js' },
    ],
})

const contact = () => ({
    lines: [
        link('linkedin', 'linkedin.com/in/adnaanb', LINKS.linkedin),
        link('github', 'github.com/adnaanbheda', LINKS.github),
    ],
})

const opener = (name) => ({
    lines: [link(name, `opening ${name}`, LINKS[name])],
    effect: { url: LINKS[name] },
})

const open = (target) => {
    const app = APPS[target]
    if (app) return { lines: [text(`opening ${target}`, 'dim')], effect: { open: app.src } }
    if (LINKS[target]) return opener(target)
    return {
        lines: [
            text(target ? `open: no project called ${target}` : 'open: name a project, like open localwrite', 'error'),
            run('projects', 'list what can be opened'),
        ],
    }
}

const COMMANDS = {
    help,
    whoami,
    projects,
    work,
    skills,
    contact,
    cv: () => opener('cv'),
    linkedin: () => opener('linkedin'),
    github: () => opener('github'),
    night: () => ({ lines: [text('lamp on', 'dim')], effect: { night: true } }),
    day: () => ({ lines: [text('lamp off', 'dim')], effect: { night: false } }),
    clear: () => ({ lines: [], effect: 'clear' }),
    exit: () => ({ lines: [], effect: 'exit' }),
}

// What people type out of habit. Left out of tab completion on purpose.
const ALIASES = {
    '?': 'help',
    localwrite: 'open localwrite',
    youtube: 'open youtube',
    ls: 'projects',
    'ls projects': 'projects',
    'cat cv': 'cv',
    resume: 'cv',
    experience: 'work',
    about: 'whoami',
    quit: 'exit',
    'cd ..': 'exit',
}

// Only a name from this list ever leaves the browser as an analytics label:
// what visitors type is theirs.
export const commandName = (input) => {
    const first = input.trim().toLowerCase().split(/\s+/)[0]
    return first in COMMANDS || first === 'open' ? first : 'unknown'
}

export function execute(input)
{
    const command = input.trim().replace(/\s+/g, ' ').toLowerCase()
    const name = ALIASES[command] ?? command

    if (COMMANDS[name]) return COMMANDS[name]()
    if (name === 'open' || name.startsWith('open ')) return open(name.slice(5))
    if (name === 'sudo' || name.startsWith('sudo ')) {
        return { lines: [text('sudo: this incident will be reported to Adnaan', 'error')] }
    }

    return {
        lines: [
            text(`${command.split(' ')[0]}: command not found`, 'error'),
            run('help', 'list the commands'),
        ],
    }
}

// Tab completion: fills in a command or project once only one name fits.
export function complete(input)
{
    const value = input.trimStart().toLowerCase()
    if (!value) return input

    const names = [
        ...Object.keys(COMMANDS),
        ...Object.keys(APPS).map((name) => `open ${name}`),
    ]
    const matches = names.filter((name) => name.startsWith(value))
    return matches.length === 1 ? matches[0] : input
}
