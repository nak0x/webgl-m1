# webgl-m1

An interactive 3D first-person experience built with **Nuxt 4**, **Three.js r183**, and **Vue 3**. Players explore a multi-scene environment, progress through a quest system, and trigger cinematic sequences — all running entirely in the browser with no backend.

Inspired by [Bruno Simon's Three.js Journey](https://threejs-journey.com/) architecture pattern.

---

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Click **Start**, then move with **WASD** and interact with **E**.

### Debug mode

```
http://localhost:3000/#debug
```

Activates lil-gui, stats.js, and the crosshair object inspector. See [Getting Started](docs/GETTING_STARTED.md#debug-mode) for details.

---

## Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | [Nuxt](https://nuxt.com) | 4.4.2 |
| 3D engine | [Three.js](https://threejs.org) | r183 |
| UI | [Vue](https://vuejs.org) | 3.5 |
| State | [Pinia](https://pinia.vuejs.org) | 3 |
| Physics | [Rapier3D](https://rapier.rs) | 0.19 (available) |
| Debug UI | [lil-gui](https://lil-gui.georgealways.com) | 0.21 |

---

## Documentation

| Document | What it covers |
|----------|---------------|
| [Getting Started](docs/GETTING_STARTED.md) | Setup, first run, debug mode, project tour |
| [Architecture](docs/ARCHITECTURE.md) | Design philosophy, data flow, Bruno Simon pattern |
| [Core Systems](docs/SYSTEMS.md) | Experience, Renderer, Time, Camera, Resources, FPS |
| [World System](docs/WORLDS.md) | Scenes, how to create a new World |
| [Interaction, Quest & Dialogue](docs/INTERACTION.md) | InteractionManager, QuestManager, DialogueManager |
| [HUD & Vue Layer](docs/HUD.md) | Vue components, composables, Pinia store |
| [Cinematic Editor](docs/CINEMATIC.md) | Editor page, CinematicPlayer, event types |
| [Code Standards](docs/STANDARDS.md) | Conventions, naming, cleanup policy |

### External tools

| Document | What it covers |
|----------|---------------|
| [City Chunker](docs/external-tools/CITY_CHUNKER.md) | Offline city geometry chunking pipeline (separate tool) |

---

## Scenes

| Name | Entry | Description |
|------|-------|-------------|
| Atelier | `pages/index.vue` | Workshop interior — default starting scene |
| Hub | `SCENES.hub` | Lounge / corridor connecting areas |
| City | `SCENES.city` | Streamed open-world with LOD chunks |

---

## Project status

See [PROGRESS.md](PROGRESS.md) for the current feature checklist and known blockers.

---

## Scripts

```bash
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Production build
npm run generate   # Static site generation
npm run preview    # Preview production build locally
```

---

## Key rules at a glance

- **Three.js r183 only** — no r184+ APIs
- **Never call Three.js from Vue components** — go through composables
- **`#debug` hash** to activate developer tools
- **GLB mesh names** must be discovered via the `#debug` overlay before use
- **Full code style:** [docs/STANDARDS.md](docs/STANDARDS.md)
