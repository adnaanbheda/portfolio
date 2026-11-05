# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal 3D portfolio for Adnaan Bheda — a React Three Fiber scene of a desk setup, live at https://portfolio.adnaan.me, served as static files from Nginx on a Raspberry Pi 5.

## Commands

```bash
npm run dev      # Vite dev server (root is src/, opens browser, host exposed on LAN)
npm run build    # Production build -> dist/
```

No test suite. No `lint` script — `.eslintrc` exists in the legacy eslintrc format while `eslint@9` is installed, so `npx eslint` needs `ESLINT_USE_FLAT_CONFIG=false` or a flat-config migration to run at all.

Deploy is automatic: a cron job on the Pi runs [deploy.sh](deploy.sh), which picks up new commits on `main` and, when they touch the site, runs `npm ci` and `npm run build`, `rsync`s `dist/` into `/home/adnaan/sites/provision/portfolio-adnaan/html/`, reloads bare-metal Nginx and purges Cloudflare's cached HTML. [.github/workflows/build-check.yml](.github/workflows/build-check.yml) only builds pull requests. [nginx.conf](nginx.conf) is copied to `/etc/nginx/conf.d/portfolio-adnaan.conf` on each deploy; it listens on `5173`, which Cloudflare Tunnel points `portfolio.adnaan.me` at (no reverse-proxy container in front — Nginx Proxy Manager is being considered for multi-service management but not yet in place). No Docker involved for this site anymore — the old multi-stage Dockerfile / `ghcr.io` publish / cosign pipeline was retired since it was pure overhead for a static site.

## Architecture

### Vite layout is non-standard
`root: 'src/'` and `publicDir: '../public/'`. So [src/index.html](src/index.html) is the entry HTML, `public/` assets are referenced from app code as `/foo.glb` (root-absolute), and build output goes to `../dist`. A change to anything in `public/` restarts the dev server via `vite-plugin-restart`.

`vendor-*` manual chunks in [vite.config.js](vite.config.js) split react / three / r3f / postprocessing / analytics. Adding a heavy dependency usually means adding a chunk there.

### State lives in index.jsx, the scene only reacts
[src/index.jsx](src/index.jsx) is the only stateful component. `Experience` is `lazy()`-loaded inside `<Suspense>` behind drei's `<Loader>`. Everything below the Canvas is driven by these props:

- `iframeSrc` — the site on the 3D monitor, set by `open <project>`
- `terminal` — the `<Terminal>` element for the monitor, present only while the camera is parked there and no site is open
- `zoomTrigger` — a **counter**, not a boolean. Incrementing it fires the camera move in an effect; this is what allows re-zooming to the same target
- `isZoomed` / `atDesk` — where the camera is. `atDesk` stays on while at the monitor, so stepping back lands on the desk
- `onStepBack` — one step back: site, then terminal, then wherever the visitor came from, then the room. Returns false when already in the room

The monitor idles on a looping terminal GIF (`public/monitor-terminal.gif`, with a still `.png` for reduced motion). The screen is only about 75px wide on phones, so keep its text large and short. The terminal and any iframe only exist while the camera is parked at the monitor: they load after the zoom settles, the Canvas switches to `frameloop="demand"` while they run, and they are unloaded on the way back. On a phone a live iframe shares the page's main thread, so don't reintroduce autoplay. Analytics (`react-ga4`) loads after the intro finishes.

### The terminal is the interface
All portfolio content lives in [src/commands.js](src/commands.js): `execute()` maps input to lines to print plus an optional effect. To add a project, add it to `APPS` (loads on the monitor) or to `projects()` as a link. [src/Terminal.jsx](src/Terminal.jsx) renders inside the monitor's `<Html>`, a separate React root, so it gets everything by props. [src/CommandBar.jsx](src/CommandBar.jsx) is the keyboard-free way in: a command run from the room is queued in `index.jsx` until the zoom finishes. CV and LinkedIn are real links there because a tab opened after the zoom would be popup-blocked. [src/Boot.jsx](src/Boot.jsx) is the loading screen, logging real files from `useProgress`, and also hides the GPU warm-up frames. Only command names go to analytics, never what a visitor typed.

The terminal shares the room's look: warm ink, cream text, parapet colours for accents, no glow. Type: Jost for the name and all buttons, IBM Plex Mono only inside the terminal and boot log. Jost is Adnaan's choice, so don't replace it.

### Camera control
[src/Experience.jsx](src/Experience.jsx) owns a drei `CameraControls` ref with clamped azimuth/polar so the user can't orbit behind the room. Three stops: the room (`moveCameraToDefault()`, `reset` + re-enable), the desk (`moveToDesk()`, a padded `fitToBox` then a small turn, reached by clicking the desk) and the monitor (`moveToMonitor()`, a plain `fitToBox`). Controls are disabled at both close stops, so the desk has no drag, only the mouse lean. `fitToBox` snaps to the nearest axis, so `fitMonitor()` turns to face the monitor first. Escape and double-click on the scene group both step back. The desk's click target is one invisible box, because a pointer move raycasts everything under a handler. [src/CameraDrift.jsx](src/CameraDrift.jsx) leans the camera towards the mouse and sways it when idle, through the focal offset, because writing to the orbit mid-drag or mid-move would snap it. Mobile is a `size.width < 768` branch that swaps position/scale constants inline — there is no breakpoint abstraction.

### Monitor is the interactive centerpiece
[src/Monitor.jsx](src/Monitor.jsx) renders the terminal or a real `<iframe>` into the 3D scene via drei `<Html transform>`, plus a screen-dirt overlay. Screen content is opaque DOM over the canvas, so it can't light the scene or bloom. It measures the GLB's `screen` node bounding box at runtime to derive the Html scale and pixel dimensions — including a fallback branch for GLB exports where the screen geometry is flat on the XZ plane (`height < 0.01`) and needs rotating. If you swap `monitor.glb`, that node must still be named `screen` and this math needs rechecking.

### Model components: two kinds
- **Thin `primitive` wrappers** ([StandingDesk](src/StandingDesk.jsx)) — `useGLTF(...).scene` spread with props, passing `children` through so other models nest inside them positionally.
- **gltfjsx-generated** ([SnakePlant](src/SnakePlant.jsx), [Himalayan450](src/Himalayan450.jsx)) — do not hand-edit the mesh trees; regenerate with the `npx gltfjsx` command recorded in each file's header comment. The header also carries the model's Sketchfab source and license, so keep it.

Every model file calls `useGLTF.preload`. Nesting is positional and hand-tuned in `Experience.jsx` (Room → Planet + LampPost + Rose + StandingDesk → SnakePlant/Monitor/Speakers) — moving a parent moves its children.

`Chair.jsx` and `Himalayan.jsx` are unused and reference GLBs that aren't in `public/`.

### Look
Late afternoon by default: the dark screen should stand out as an object in a bright room. `night` (a prop from `index.jsx`, set by the corner button or the `night`/`day` commands) moves the room to a warm lamp-lit evening, never a dark screen-lit one. [src/Lighting.jsx](src/Lighting.jsx) holds both moods' lights; [src/Stars.jsx](src/Stars.jsx) fades stars in behind the room; [src/WindowView.jsx](src/WindowView.jsx) is the painted view through the window, the planet's edge and sun and moon included, one mesh blending two textures because stacked planes z-fight at this scene's scale; the room shell is procedural, after Gaudí ([src/Room.jsx](src/Room.jsx), with its shape in [src/roomShape.js](src/roomShape.js)): curved wall, trencadís mosaic and an arched window, in four merged meshes. Colour stays on the parapet; the floor is deliberately quiet. The floor patch ([src/SunPatch.jsx](src/SunPatch.jsx)) is a texture projected from the window's real coordinates, because the panes are solid and no light gets through. Sunbeams run from the window to that patch as flat slanted sheets. Patch, beams and the window's glass shimmer in their shaders, mostly by day, frozen for reduced motion.

The room stands on a tiny planet ([src/Planet.jsx](src/Planet.jsx)), inspired by The Little Prince: motifs only, no prince figure, book drawings or quotes. Keep it restrained: the planet is cropped to a horizon on purpose, because a whole ball in frame read as a toy. Its soft lavender wash and the three small volcanoes on its horizon take after the book's cover, built as new geometry rather than traced. On the planet's face they looked like spots on a potato. [src/LampPost.jsx](src/LampPost.jsx) is the street lamp beside it, lit at dusk; [src/Rose.jsx](src/Rose.jsx) is the rose under glass, which opens `rose` in the terminal. [src/Backdrop.jsx](src/Backdrop.jsx) is the sky, watercolour washes baked at load and cross-faded, including the `sunset` command's. Lights stay mounted at intensity 0, because adding or removing one recompiles every material. Anything animated here calls `invalidate()`, since the mood can change with the Canvas on `frameloop="demand"` at the monitor.

### Moods
Lighting values for day, sunset and night live in [src/moods.json](src/moods.json), read through [src/moods.js](src/moods.js). `npm run dev` shows a Leva panel ([src/MoodPanel.jsx](src/MoodPanel.jsx)) with live sliders; its save button writes that file through a dev-only Vite middleware restricted to this machine. Neither the panel nor the endpoint reaches production. Sky washes are in the file but have no sliders, because they're painted at load. The window's painted view stays in [src/WindowView.jsx](src/WindowView.jsx).

### Performance
No post-processing: the Canvas renders straight to screen with `flat` colours. The sky and the lamp's sprite stand in for bloom, and dropping the composer was the biggest single GPU win. Keep large surfaces on Lambert, merge small parts into one mesh, and paint grain with `grain.js`, not dot by dot.
