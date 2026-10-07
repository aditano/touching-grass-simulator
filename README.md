# Touching Grass

A small browser meadow. Drag through the field and the grass bends under your hand.

**Play it:** [aditano.github.io/touching-grass-simulator](https://aditano.github.io/touching-grass-simulator/)

## What it is

Touching Grass Simulator is a single-page outdoor scene. A finger or a mouse brushes a late-day lawn. Blades lean away from the pointer, a streak climbs while you keep moving, and a serotonin meter fills as you stay on the page. The site is static. Touch counts, your best streak, and the mute setting stay in this browser.

## Live site

GitHub Pages serves the production build from `main`:

[https://aditano.github.io/touching-grass-simulator/](https://aditano.github.io/touching-grass-simulator/)

Each push to `main` runs [`.github/workflows/pages.yml`](.github/workflows/pages.yml). That workflow installs dependencies, builds `dist/`, and deploys it to GitHub Pages.

## Features

- **Brush the field.** Drag or swipe to bend the grass. A tap pokes one patch. More than one finger can brush at once.
- **Wind and spring-back.** Blades sway on their own, lean away from a touch, warm where you press, and rise again when you let go.
- **Session HUD.** The footer shows touch count, current streak, best streak, serotonin mood (`idle`, `stirring`, `decent`, `glowing`, `lush`, `feral`), and time on the page. Time counts while the tab is visible.
- **Quips.** The first touch, every few taps, a new personal best, and the one, three, and ten minute marks each show a short line.
- **The meadow.** Sunset sky, hills, trees, flowers, butterflies, drifting motes, a bird that crosses now and then, and a small puff of light where you brush.
- **Sound.** A low wind bed and a rustle on each stroke, synthesized in the browser. Mute with the speaker button or the `M` key. The choice is saved.
- **Phone first.** The camera frames a tall screen up close and pulls back on wider layouts. With a mouse, click and drag.
- **Reduced motion.** When the system asks for less motion, wind, camera drift, and the critters slow down.
- **WebGL fallback.** Browsers that cannot start WebGL get a short message in place of the canvas.

Best streak and mute are stored in `localStorage` under `touching-grass-best` and `touching-grass-muted`.

## Run locally

Use Node.js 22 and npm. Node.js 22 is the version the Pages workflow installs.

```bash
npm install
npm run dev
```

Open [http://localhost:5173/touching-grass-simulator/](http://localhost:5173/touching-grass-simulator/). The dev server uses the same `/touching-grass-simulator/` base path as the live site.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on port 5173 |
| `npm run build` | Typecheck, then write `dist/` |
| `npm run preview` | Serve the production build on port 4173 |
| `npm run typecheck` | Typecheck only |

Preview is at [http://localhost:4173/touching-grass-simulator/](http://localhost:4173/touching-grass-simulator/).

## Tech stack

- [Vite](https://vite.dev/) 8 serves the app in development and builds the static site.
- [TypeScript](https://www.typescriptlang.org/) 5.8 is checked with `tsc --noEmit` before each production build.
- [Three.js](https://threejs.org/) draws the scene: instanced grass with a custom shader, a sky shader, and the rest of the meadow.
- The Web Audio API synthesizes wind and rustle. The project ships no audio files.
- GitHub Actions uploads the Vite build to GitHub Pages.

`vite.config.ts` sets `base` to `/touching-grass-simulator/` so asset URLs match the Pages path.
