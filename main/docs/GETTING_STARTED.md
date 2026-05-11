# Getting Started

> This guide is written for a developer joining the project for the first time. It assumes familiarity with JavaScript and basic web development, but not necessarily with Three.js or Nuxt.

---

## Prerequisites

- **Node.js ≥ 20** — [nodejs.org](https://nodejs.org)
- **npm** (bundled with Node)
- A modern browser with WebGL2 support (Chrome, Firefox, Edge, Safari 16+)

---

## Installation

```bash
git clone <repo-url>
cd main
npm install
```

> The `postinstall` script runs `nuxi prepare` automatically, which generates Nuxt types and auto-import stubs.

---

## Running the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should see a black start screen titled **L'Atelier**.

### Debug mode

Append `#debug` to the URL:

```
http://localhost:3000/#debug
```

This activates:
- **lil-gui** panel (top-right) — real-time tweak of lights, post-FX, etc.
- **Stats.js** monitor (top-left) — FPS, render time, memory
- **CrosshairTarget overlay** (bottom-left in FPS) — shows the name, type, and hierarchy path of the object under the crosshair, plus any registered interaction ID

The `#debug` hash is read once at startup by `Debug.js`. You must reload the page to toggle it.

---

## Project structure at a glance

```
app/
├── assets/css/global.css       # Global reset + canvas fill
├── components/                 # Vue HUD overlays
├── composables/                # Reactive bridges Three.js → Vue
├── pages/
│   ├── index.vue               # Main game page
│   └── editor.vue              # Cinematic editor
├── stores/                     # Pinia stores
│   └── cinematicEditor.js
└── utils/three/                # All Three.js code
    ├── Experience.js           # Central orchestrator (start here)
    ├── Renderer.js
    ├── FpsController.js
    ├── interaction/
    ├── dialogue/
    ├── quest/
    ├── cinematic/
    ├── materials/
    ├── textures/
    └── world/
        ├── atelier/
        ├── hub/
        └── city/
docs/                           # You are here
PROGRESS.md                     # Current status + TODO
CLAUDE.md                       # AI assistant rules
```

---

## First steps for a new developer

### 1. Read the architecture overview

[`docs/ARCHITECTURE.md`](ARCHITECTURE.md) explains the overall design. Start there before reading any code.

### 2. Open `Experience.js`

`app/utils/three/Experience.js` is the entry point for the entire 3D side of the app. It constructs every subsystem and owns the render loop. If you want to understand how something fits together, trace it back here.

### 3. Open `pages/index.vue`

This is where the Vue app mounts the Three.js canvas and instantiates the first `World`. It also handles scene transitions and wires up the HUD composables.

### 4. Play through the game once

Click **Start**, walk around with **WASD**, look around with the mouse. Press **E** near the coffee machine to interact. This gives you the full experience before you read any code.

### 5. Explore with `#debug`

Open `http://localhost:3000/#debug`, enter the game, and aim your crosshair at objects. The bottom-left overlay shows the real Three.js object names — you will need these when binding objects to quest steps.

---

## Finding GLB object names

GLB files loaded into the scenes use internal mesh names. You **must** know the exact names to register objects with `InteractionManager` or `QuestManager`. The workflow is:

1. Run the dev server with `#debug`
2. Load the scene containing the object
3. Aim the crosshair at the target mesh — the overlay shows `name: "coffee_machine"` (or whatever the real name is)
4. Update the corresponding `*Config.js` file with the real name

See [`docs/WORLDS.md`](WORLDS.md) for the Config file pattern, and the [`/inspect-glb`](../CLAUDE.md) skill for the automated procedure.

---

## Build for production

```bash
npm run build
npm run preview    # local preview of the production build
```

> Never commit `.nuxt/`, `.output/`, or any build artifact — these are gitignored.

---

## Key rules to know before writing code

- **Three.js is locked at r183.** Do not use any API introduced in r184+. Check the [Three.js migration guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide) if unsure.
- **Never call Three.js code from a Vue component.** All 3D operations go through composables → managers → Three.js. See [`docs/HUD.md`](HUD.md).
- **One class per file.** `utils/three/*.js` each exports a single default class.
- **No opportunistic refactoring.** Fix the thing you were asked to fix; clean up separately with permission.

Full code style is in [`docs/STANDARDS.md`](STANDARDS.md).
