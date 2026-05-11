# Web GL — Interactive 3D Experiences

A collection of WebGL projects built with modern web technologies. The repository contains a main production project and several experimental/test projects exploring different 3D rendering techniques and game mechanics.

**Status:** Active development on main scene (Atelier)  
**Tech Stack:** Nuxt 4, Three.js r183, Vue 3, Vite  
**Current Branch:** `data-driven-rendering`

---

## 🏗️ Project Structure

### `/main` — Primary 3D Experience (Production)

A fully interactive 3D scene with **FPS gameplay**, **quest system**, **dialogue mechanics**, and **real-time rendering**.

**Core Features:**
- First-person controller with pointer lock (WASD + mouse)
- Quest manager (linear sequences with triggers and dialogue)
- Dialogue system with NPC interactions
- Interactive object detection (proximity, raycasting, trigger zones)
- Real-time outlines and visual feedback
- Post-processing pipeline (ACES filmic tone mapping, outline pass)

**Stack:**
- Nuxt 4.4.2 (SSR disabled, client-only)
- Three.js 0.183.2 (OutlinePass, EffectComposer, GLTFLoader + DRACOLoader)
- Vue 3.5 + vue-router 5
- lil-gui 0.21 (debug UI, activated via `#debug` URL hash)

**Architecture:**
- `app/utils/three/Experience.js` — Main orchestrator (singleton)
  - Manages `Sizes`, `Time` (RAF loop, delta in ms), `Resources`, `Camera`, `Renderer`, `InteractionManager`, `DialogueManager`
- `app/utils/three/world/` — Scene definitions
  - `AtelierWorld.js` — Current main scene (atelier with NPC, computers, tools)
  - Pattern: Load GLB, set up lights, register quest steps
- `app/composables/` — Vue reactive bridges
  - `useQuestState.js`, `useDialogueState.js` — EventEmitter → reactive refs
  - Never call Three directly from Vue; always go through composables
- `app/components/` — HUD overlays
  - `QuestHud.vue`, `DialogueHud.vue` — Quest and dialogue UI

**Key Rules:**
- **Three.js r183 only** — no r184+ features
- **OutlinePass** (native Three.js), not custom SilhouetteOutline
- **No materials/textures in auto-imports** — import helpers explicitly
- **All modules must expose `destroy()`** for proper cleanup
- **Geometry/materials must be `dispose()`d**

**Quick Start:**
```bash
cd main
npm install
npm run dev  # http://localhost:3000
# Add #debug to URL for debug UI
```

**Documentation:**
See `/main/.claude/rules/` for detailed architecture, stack constraints, code style, cleanup policies, and workflow guidelines.

---

### `/city-creator` — 3D City District Processor

A **browser-based utility** for processing large 3D city meshes. Chunks districts into a grid, applies LOD simplification via meshopt, and exports optimized GLB files.

**Purpose:**
- Split 5×300×300-unit districts into 64×64 chunks
- Auto-clip triangles at chunk boundaries (Sutherland-Hodgman algorithm)
- Generate 3 LOD levels per chunk (1.0, 0.25, 0.06 ratios)
- Export manifest + per-chunk GLB files

**Stack:**
- Vite + Vue 3 (`<script setup>`, Composition API)
- Three.js (preview canvas only)
- meshoptimizer WASM (simplify + vertex optimization)
- Web Workers (all heavy geometry work off main thread)

**Components:**
- `DropZone.vue` — File import (drag-drop GLB)
- `PreviewCanvas.vue` — Three.js preview + grid overlay
- `ChunkConfig.vue` — Chunk size & LOD settings
- `ProgressPanel.vue` — Multi-stage progress tracker

**Worker Protocol:**
```js
// Main → Worker
{ type: 'start', districts: ArrayBuffer[], chunkSize: 64, lodRatios: [1.0, 0.25, 0.06], ... }

// Worker → Main
{ type: 'progress', stage: 'clip'|'simplify'|'export', pct: number }
{ type: 'chunk_done', chunkId: '4_2', lod: 0, buffer: ArrayBuffer }  // transferable
{ type: 'done', manifest: Object }
```

**Output Format:**
```
chunk_4_2_lod0.glb  (full res)
chunk_4_2_lod1.glb  (25% tris)
chunk_4_2_lod2.glb  (6% tris)
manifest.json
```

**Critical Rules:**
- **Zero allocations in clipper inner loop** — pre-allocate scratch buffers
- **Always transfer ArrayBuffers** (never structured clone)
- **Boundary vertex snapping** — hard-set edge coordinates to prevent T-junction cracks
- **One district at a time** — memory safety

**Quick Start:**
```bash
cd city-creator
npm install
npm run dev  # Vite dev server
# Drag a .glb city district into the UI
```

---

### `/test_tech` — Technology Exploration

Multiple independent Nuxt projects experimenting with different 3D techniques and game mechanics.

**Subdirectories:**
- `basic_rpg_game/` — RPG mechanics prototype
- `crm_vehicule_demo/` — Vehicle interaction demo
- `custom_rendering/` — Custom shader explorations
- `mat_test/` — Material testing
- `path-tracer/` — Path tracing experiments
- `procedural_city/` — Procedural city generation
- `test_cam_path/` — Camera path animation
- `vehicule_xray/` — Vehicle X-ray rendering

Each is a standalone Nuxt 4 project. Use for isolated testing; findings may inform main project architecture.

**Quick Start:**
```bash
cd test_tech/<project_name>
npm install
npm run dev
```

---

### `/npc_poc`, `/poc_site`, `/project2`, `/template_nuxt_project`

**Legacy/Template Projects**

- `npc_poc/` — NPC behavior prototype (check `/npc_poc/README.md` for details)
- `poc_site/` — Proof-of-concept website
- `project2/` — Previous iteration (reference only)
- `template_nuxt_project/` — Starter template for new scenes

All follow standard Nuxt 4 minimal starter structure. Not actively developed; preserved for reference.

---

### `/ressources` — 3D Assets

Raw 3D assets for the project.

**Contents:**
- `3D/` — Blender and GLTF files
  - `rigged_caracter.blend` — Rigged character model (with backups)
- `chunks.zip` — Pre-chunked city district data (from city-creator export)
- `Perso_rigged.fbx` — FBX character export

All 3D assets are processed/optimized before being loaded into scenes.

---

## 🚀 Development Workflow

### Running the Main Project

```bash
cd main
npm run dev     # Dev server on http://localhost:3000
npm run build   # Production build
npm run preview # Preview production build
```

### Debug Mode

Append `#debug` to the URL:
```
http://localhost:3000/#debug
```

Enables:
- lil-gui debug UI (scene controls, camera, fog, etc.)
- Crosshair target overlay (shows object names and paths)
- Raycast visualization

### Git Workflow

- **Main branch:** `main` (production)
- **Feature branches:** One per scene/feature (e.g., `1st_scene_atelier`, `data-driven-rendering`)
- **Never force-push to main** — squash/rebase locally first
- **Never commit:**
  - `.nuxt/`, `.output/`, `.nitro/`, node_modules/ (build outputs)
  - `.env*` files (except `.env.example`)
  - `.DS_Store`

### Adding a New Quest Step

1. Open `/main/.claude/rules/` for architectural patterns
2. Use the `add-quest-step` skill or manually edit `AtelierWorld.js`
3. Register with `InteractionManager` (proximity, hover, or trigger zone)
4. Connect to `QuestManager` for sequencing + dialogue
5. Test via `#debug` to verify object names and trigger zones

### Inspecting GLB Objects

1. Load the scene with `#debug` enabled
2. Hover/aim crosshair at objects
3. Read the overlay: `type / name / path`
4. Update config files with correct object names

---

## 📋 Key Technologies

| Tech | Version | Purpose |
|------|---------|---------|
| Nuxt | 4.4.2 | Vue 3 framework, auto-imports, SSR (disabled) |
| Three.js | 0.183.2 | 3D rendering, loaders, post-processing |
| Vue | 3.5 | Reactive UI, composables |
| Vite | (city-creator) | Build tool for browser utilities |
| meshoptimizer | WASM | Geometry LOD simplification |
| lil-gui | 0.21 | Debug UI |
| GLTFLoader + DRACOLoader | Three.js | Asset loading with compression support |

---

## 📁 File Organization

```
/main
  app/
    utils/three/
      Experience.js           # Main orchestrator
      Renderer.js            # WebGL + post-processing
      Camera.js, Time.js, Sizes.js, Resources.js
      interaction/           # Event system
      world/                 # Scene definitions
        AtelierWorld.js, AtelierConfig.js, AtelierSources.js
    composables/
      useQuestState.js       # Quest reactive bridge
      useDialogueState.js    # Dialogue reactive bridge
    components/
      QuestHud.vue, DialogueHud.vue
    assets/css/
      global.css
    pages/
      index.vue              # Main entry point
  nuxt.config.js             # Nuxt config, auto-imports
  .claude/rules/
    architecture.md          # Patterns & core concepts
    stack-constraints.md     # Versions, tech stack
    code-style.md           # Naming, imports, cleanup
    cleanup-policy.md       # Legacy files (do not use)
    workflow.md             # Dev server, git, testing

/city-creator
  src/
    components/             # Vue components (DropZone, PreviewCanvas, etc.)
    workers/                # Web Worker scripts
    lib/                    # Utilities (clipper, meshopt wrapper, manifest)
    composables/            # useChunker, etc.
  vite.config.js
```

---

## 🔧 Common Commands

```bash
# Main project
cd main
npm run dev          # Start dev server (port 3000)
npm run build        # Build for production
npm run preview      # Preview prod build

# City creator
cd city-creator
npm run dev          # Vite dev server

# Any test_tech project
cd test_tech/<name>
npm run dev
```

---

## 📚 Learning Resources

**For the Main Project:**
1. Start with `/main/.claude/rules/architecture.md` — core patterns
2. Read `stack-constraints.md` — tech stack & auto-imports
3. Read `code-style.md` — naming, refactoring, error handling
4. Check `PROGRESS.md` — current state and TODOs

**For City Creator:**
1. See `/city-creator/CLAUDE.md` — full spec (geometry, worker protocol, export format)

---

## 🎯 Current Focus

**Active Development:** `data-driven-rendering` branch  
**Main Scene:** Atelier (1st_scene_atelier)

- Expanding quest system with multiple NPCs
- Adding interactive objects (computers, tools)
- Implementing dialogue sequences
- Optimizing large districts via city-creator chunking

See `/main/PROGRESS.md` for detailed task list and blockers.

---

## ⚙️ Project Notes

- **No unit tests** — verification is visual (live on `localhost:3000`)
- **No SSR** — Three.js scenes are client-only
- **Web Workers everywhere** — city-creator uses workers for all heavy geometry
- **Memory conscious** — chunking, LOD, disposal patterns critical
- **Debug-first** — `#debug` mode is a first-class feature for development

---

## 📝 License & Attribution

Educational project (Ecole by CCI, 2026)

---

**Questions?** Check the detailed documentation in `.claude/rules/` or explore the code with the debug UI enabled.
