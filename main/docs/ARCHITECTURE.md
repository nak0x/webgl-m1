# Architecture

---

## Inspiration: Bruno Simon's Experience pattern

This project's Three.js architecture is directly inspired by [Bruno Simon's Three.js Journey](https://threejs-journey.com/) course. The central idea is a single `Experience` class that acts as an **orchestrator**: it instantiates every subsystem, holds references to all of them, and propagates the two global signals — `resize` and `tick` — down through the hierarchy.

Each subsystem (`Sizes`, `Time`, `Camera`, `Renderer`, …) receives the `Experience` instance in its constructor, giving it access to everything it needs without global variables or singletons.

The benefit: **clear ownership**. Every object knows exactly what it needs to do its job. Dependencies are explicit. Cleanup is straightforward because `Experience.dispose()` calls every subsystem's `dispose()` in order.

---

## High-level diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  pages/index.vue  (Vue, DOM)                                    │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Experience                                               │  │
│  │                                                           │  │
│  │  Sizes ──► Time ──► (tick every frame)                    │  │
│  │  Resources (GLTFLoader + Worker)                          │  │
│  │  Camera                                                   │  │
│  │  Renderer  (WebGLRenderer + EffectComposer)               │  │
│  │  InteractionManager                                       │  │
│  │                                                           │  │
│  │  World (AtelierWorld / HubWorld / CityWorld)              │  │
│  │  ├── THREE.Scene content                                  │  │
│  │  ├── FpsController                                        │  │
│  │  ├── QuestManager ──► EventEmitter                        │  │
│  │  └── DialogueManager ──► EventEmitter                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                        │                │                       │
│               useQuestState     useDialogueState                │
│               (reactive refs)   (reactive refs)                 │
│                        │                │                       │
│               QuestHud.vue    DialogueHud.vue                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## The Three.js ↔ Vue boundary

Three.js and Vue live in fundamentally different worlds:
- Three.js runs a tight RAF loop, mutates objects directly, and has no reactivity.
- Vue's reactivity system tracks dependencies and schedules re-renders asynchronously.

**The rule:** Three.js emits events. Vue listens. Vue never drives Three.js directly.

```
Three.js                                  Vue
────────                                  ────
QuestManager.emit('step:active', step) ──► useQuestState.bind() subscribes
                                           → updates reactive refs
                                           → QuestHud.vue re-renders
```

The bridge is the composable. `useQuestState.js` and `useDialogueState.js` are singletons that:
1. Receive a manager instance via `bind(manager)`
2. Subscribe to its `EventEmitter` events
3. Write results into `ref()`s

Vue components read those refs. They never touch the manager directly.

> See [`docs/HUD.md`](HUD.md) for the full composable API.

---

## Subsystem initialisation order

`Experience` constructs subsystems in this specific order, and each constructor can safely reference anything above it:

```
1. Debug         — reads URL hash, creates lil-gui if #debug
2. Sizes         — reads window.innerWidth/Height, sets up ResizeObserver
3. Time          — sets up RAF loop
4. Resources     — creates GLTFLoader + DRACOLoader + Worker
5. Camera        — creates PerspectiveCamera, reads sizes
6. Renderer      — creates WebGLRenderer + EffectComposer, reads sizes + camera
7. InteractionManager — sets up raycaster + keyboard listeners
```

After construction, the caller creates a `World` and calls `experience.setWorld(world)`. The World registers itself as the recipient of `update()` calls each frame.

---

## World lifecycle

A World is a class that:
1. Reads `experience.resources` for its GLB file
2. Populates `experience.scene` with lights, meshes, fog
3. Creates its own `FpsController`, `QuestManager`, `DialogueManager`
4. Calls `experience.setDialogue(this.dialogue)` so the Vue layer can find it
5. Registers interactive objects with `experience.interaction`
6. Exposes `update(delta)` and `dispose()`

The page (`index.vue`) binds composables to managers after the World is instantiated:

```js
const questState = useQuestState()
const dialogueState = useDialogueState()

questState.bind(world.quest)
dialogueState.bind(world.dialogue)
```

Scene transitions work by: disposing the current World, clearing the scene, constructing a new World, and re-binding composables.

> See [`docs/WORLDS.md`](WORLDS.md) for the complete World API.

---

## Frame loop

`Time.js` drives the entire update cycle via [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame). Each frame:

```
Time emits 'tick'
    └► Experience._update()
            ├── camera.update()         (OrbitControls.update if active)
            ├── interaction.update()    (proximity checks, raycasting)
            ├── world.update(delta)     (FPS movement, physics, animations)
            └── renderer.update()       (composer.render())
```

`delta` is in **milliseconds**. All movement code should multiply by `delta / 1000` (seconds) for frame-rate-independent motion.

---

## Asset loading

`Resources.js` manages all asset loading. It accepts a sources array at construction:

```js
[
  { name: 'atelierModel', type: 'gltfModel', path: '/models/atelier_1.4.0.glb' },
  { name: 'someTexture', type: 'texture',   path: '/textures/foo.jpg' },
]
```

Large files (GLBs) are fetched off-thread via `asset-fetcher.worker.js` using zero-copy [Transferable](https://developer.mozilla.org/en-US/docs/Web/API/Transferable) `ArrayBuffer`s. The main thread receives the buffer and passes it to `GLTFLoader.parse()`.

When all assets are loaded, `resources.emit('ready')` fires. Worlds listen:

```js
this.resources.on('ready', () => this._onLoad())
```

> Draco-compressed GLBs are decompressed by the CDN-hosted `DRACOLoader`. No WASM binary is bundled.

---

## Post-processing pipeline

The `Renderer` wraps Three.js's [`EffectComposer`](https://threejs.org/docs/#examples/en/postprocessing/EffectComposer) with a 12-pass pipeline. All non-essential passes start with `enabled = false` and are activated at runtime (e.g., by `CinematicPlayer` events or the debug GUI).

The pipeline order matters:

```
RenderPass          (base scene)
SSAOPass            (ambient occlusion — reads depth, must be before colour ops)
AOColorShader       (tints AO-darkened areas with a chosen hue)
EdgeShader          (Sobel edge detection — inner-line style)
BokehPass           (depth of field — reads depth)
OutlinePass         (object selection outline — additive white)
UnrealBloomPass     (bloom glow)
AfterimagePass      (motion blur via accumulation)
ACESFilmicShader    (tone mapping, EV –1.64)
LUTPass             (3D color grading)
VignetteShader      (edge darkening)
RGBShiftShader      (chromatic aberration)
FilmShader          (film grain + optional grayscale)
OutputPass          (linear → sRGB, always last)
```

> See [`docs/SYSTEMS.md`](SYSTEMS.md) for the full Renderer API.

---

## Interaction architecture

`InteractionManager` is the central hub that owns three detectors:

| Detector | When it fires | Typical use |
|----------|--------------|-------------|
| `ProximityDetector` | Player enters/leaves a radius around an object | Show "press E" hint |
| `RaycastDetector` | Crosshair or mouse hovers an object | Outline + cursor |
| `TriggerZoneDetector` | Player enters/leaves a Box3 or Sphere | Level transition |

All detectors emit normalised events (`proximity:enter`, `hover:enter`, etc.) that `QuestManager` subscribes to for step progression.

> See [`docs/INTERACTION.md`](INTERACTION.md) for the full event reference.

---

## Physics

The FPS capsule collision is handled by a custom Octree approach in `FpsController.js` + `buildOctree.js`. This requires no physics library and is appropriate for static geometry.

`PhysicsWorld.js` wraps [Rapier3D](https://rapier.rs/docs/) for cases that need proper rigid-body simulation (currently available but not active in any World). It is opt-in per World.

---

## Key design principles (summary)

| Principle | How it is applied |
|-----------|------------------|
| Single orchestrator | `Experience` owns everything; no module-level singletons |
| Explicit dependencies | Every class receives what it needs via constructor argument |
| Event-driven Three→Vue bridge | EventEmitter → composable refs → Vue re-render |
| One district at a time | World processing never overlaps; resources freed after use |
| No Three.js in Vue components | All 3D access goes through composable APIs |
| Opt-in post-FX | All effect passes start disabled; activated by cinematic events or debug UI |
