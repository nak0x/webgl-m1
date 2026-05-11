# Core Systems Reference

This document covers every class in `app/utils/three/` that is not a World, a detector, or a manager. For those, see [`WORLDS.md`](WORLDS.md) and [`INTERACTION.md`](INTERACTION.md).

---

## EventEmitter

**`app/utils/three/EventEmitter.js`**

A minimal pub/sub bus. All managers and subsystems that need to communicate extend it.

```js
import EventEmitter from './EventEmitter.js'

class MyThing extends EventEmitter {
  doSomething() {
    this.emit('done', { result: 42 })
  }
}

const thing = new MyThing()
thing.on('done', ({ result }) => console.log(result))
thing.off('done', handler)   // unsubscribe
```

Events are identified by `snake_case` strings (e.g. `'step:active'`, `'tick'`, `'ready'`).

> This pattern is analogous to Node.js [`EventEmitter`](https://nodejs.org/api/events.html) or the browser [`EventTarget`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget), but runs synchronously in the RAF loop — no async overhead.

---

## Experience

**`app/utils/three/Experience.js`**

Central orchestrator. Constructs every subsystem in dependency order and propagates `tick` and `resize` signals.

```js
const exp = new Experience(canvasElement, sourcesArray)
const world = new AtelierWorld(exp)
exp.setWorld(world)
// …later:
exp.dispose()
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `canvas` | `HTMLCanvasElement` | The rendering surface |
| `scene` | [`THREE.Scene`](https://threejs.org/docs/#api/en/scenes/Scene) | Root scene graph |
| `debug` | `Debug` | lil-gui + stats (active only with `#debug`) |
| `sizes` | `Sizes` | Viewport dimensions + pixel ratio |
| `time` | `Time` | RAF loop + delta time |
| `resources` | `Resources` | Asset loader |
| `camera` | `Camera` | PerspectiveCamera wrapper |
| `renderer` | `Renderer` | WebGLRenderer + EffectComposer |
| `interaction` | `InteractionManager` | Proximity / raycast / trigger hub |
| `dialogue` | `DialogueManager\|null` | Set by the active World |
| `world` | `World\|null` | Active World instance |

### Methods

| Method | Description |
|--------|-------------|
| `setWorld(world)` | Registers the active World |
| `setDialogue(manager)` | Registers the World's DialogueManager |
| `dispose()` | Stops RAF, removes all listeners, disposes GPU resources |

---

## Sizes

**`app/utils/three/Sizes.js`**

Tracks `window.innerWidth`, `window.innerHeight`, and `devicePixelRatio`. Emits `'resize'` when the window is resized. Caps pixel ratio at 2 to avoid performance issues on high-DPI screens.

```js
sizes.width      // number (CSS pixels)
sizes.height     // number (CSS pixels)
sizes.pixelRatio // number (capped at 2)
```

> See [MDN: Window resize event](https://developer.mozilla.org/en-US/docs/Web/API/Window/resize_event).

---

## Time

**`app/utils/three/Time.js`**

Wraps [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame) and emits `'tick'` every frame with timing data.

```js
time.elapsed   // ms since Experience was created
time.delta     // ms since last frame (use for frame-rate-independent motion)
time.current   // timestamp of the current frame (performance.now())
```

All movement and animation code should use `delta` to be frame-rate-independent:

```js
// In a World's update(delta):
this.fpsController.update(delta)
// fpsController internally: position += velocity * (delta / 1000)
```

---

## Resources

**`app/utils/three/Resources.js`**

Manages asset loading. Accepts a `sources` array at construction; loads all assets concurrently and emits `'ready'` when done.

### Source format

```js
[
  { name: 'atelierModel', type: 'gltfModel', path: '/models/atelier_1.4.0.glb' },
  { name: 'floorTexture', type: 'texture',   path: '/textures/floor.jpg' },
]
```

### Supported types

| type | Loader |
|------|--------|
| `'gltfModel'` | [`GLTFLoader`](https://threejs.org/docs/#examples/en/loaders/GLTFLoader) + [`DRACOLoader`](https://threejs.org/docs/#examples/en/loaders/DRACOLoader) (CDN decoder) |
| `'texture'` | [`TextureLoader`](https://threejs.org/docs/#api/en/loaders/TextureLoader) |

Large GLBs are fetched off-thread via `asset-fetcher.worker.js`. The worker transfers an [`ArrayBuffer`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer) back zero-copy to the main thread, which passes it to `GLTFLoader.parse()`.

### Access

```js
this.resources.items['atelierModel']   // THREE.GLTF result object
this.resources.items['floorTexture']   // THREE.Texture
```

### Events

| Event | Payload |
|-------|---------|
| `'progress'` | `{ loaded, total, progress: 0..1 }` |
| `'ready'` | none |

---

## Camera

**`app/utils/three/Camera.js`**

Creates a [`PerspectiveCamera`](https://threejs.org/docs/#api/en/cameras/PerspectiveCamera) (FOV 60°, near 0.1, far 200) and optional [`OrbitControls`](https://threejs.org/docs/#examples/en/controls/OrbitControls).

```js
camera.instance   // THREE.PerspectiveCamera — use for matrix, position, lookAt
camera.controls   // OrbitControls (disable when FPS mode is active)
```

When `FpsController` is active, it calls `camera.controls.enabled = false` and takes over the camera position/quaternion directly.

`camera.autoUpdate` controls whether `Experience._update()` calls `controls.update()`. Set to `false` when FPS controller takes over.

---

## Renderer

**`app/utils/three/Renderer.js`**

Wraps [`WebGLRenderer`](https://threejs.org/docs/#api/en/renderers/WebGLRenderer) with a 12-pass [`EffectComposer`](https://threejs.org/docs/#examples/en/postprocessing/EffectComposer) pipeline.

### WebGL setup

- `antialias: true` when pixel ratio < 2 (no need for AA on HiDPI screens)
- `powerPreference: 'high-performance'`
- `shadowMap.type = THREE.PCFShadowMap`
- `toneMapping = THREE.NoToneMapping` (ACES is handled by the shader pass in the composer)
- Environment: [`RoomEnvironment`](https://threejs.org/docs/#examples/en/environments/RoomEnvironment) baked via PMREM generator

### Post-processing passes

All passes except `RenderPass` and `OutputPass` start with `enabled = false`.

| Pass | Class / Shader | Key uniforms | Enable method |
|------|---------------|-------------|---------------|
| RenderPass | `RenderPass` | — | always on |
| SSAO | `SSAOPass` | `kernelRadius`, `minDistance`, `maxDistance` | `setSsao({…})` |
| AO color tint | custom `AOColorShader` | `aoColor`, `aoStrength` | `setAoColor({…})` |
| Edge (Sobel) | custom `EdgeShader` | `edgeStrength`, `edgeScale`, `edgeColor` | `setEdge({…})` |
| DOF | `BokehPass` | `focus`, `aperture`, `maxblur` | `setDof({…})` |
| Outline | `OutlinePass` | `selectedObjects`, `edgeStrength`, `edgeGlow` | always on; set `selectedObjects` |
| Bloom | `UnrealBloomPass` | `strength`, `radius`, `threshold` | `setBloom({…})` |
| Motion blur | `AfterimagePass` | `damp` (0–1) | `setMotionBlur({…})` |
| ACES tone map | `ACESFilmicToneMappingShader` | `exposure` | `setExposure({ ev })` |
| LUT | `LUTPass` | `lut` (Data3DTexture), `intensity` | `setLut({…})` |
| Vignette | `VignetteShader` | `offset`, `darkness` | `setVignette({…})` |
| Chromatic aberration | `RGBShiftShader` | `amount` | `setChromaticAberration({…})` |
| Film grain | `FilmShader` | `intensity`, `grayscale` | `setFilmGrain({…})` |
| OutputPass | `OutputPass` | — | always on |

### Disabling effects

```js
renderer.disableEffect('bloom')   // one effect
renderer.disableEffect('all')     // everything except RenderPass + Outline + OutputPass
```

### OutlinePass note

`OutlinePass` uses additive blending — it cannot produce black outlines. The outline is always white. For a black outline you would need to reactivate `SilhouetteOutline.js` (see [`STANDARDS.md`](STANDARDS.md#legacy-files)).

### Exposure

Exposure is expressed in **EV stops** (same scale as a camera's exposure compensation):

```js
renderer.setExposure({ ev: -1.64 })   // default — slightly underexposed for cinematic look
// internally: uniform value = Math.pow(2, ev)
```

---

## Debug

**`app/utils/three/Debug.js`**

Activated only when `window.location.hash === '#debug'`.

```js
debug.active     // boolean
debug.ui         // lil-gui instance (or null)
debug.stats      // stats.js instance (or null)
```

Worlds add their own folders:

```js
if (this.experience.debug.active) {
  const folder = this.experience.debug.ui.addFolder('Atelier')
  folder.add(this.fog, 'near', 0, 100)
}
```

> [lil-gui docs](https://lil-gui.georgealways.com/) — [stats.js](https://github.com/mrdoob/stats.js)

---

## FpsController

**`app/utils/three/FpsController.js`**

First-person player controller.

### Input

- **WASD / Arrow keys** — horizontal movement
- **Left-click** — locks the pointer ([Pointer Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API))
- **Mouse movement** — look direction (only while locked)
- **Escape** — unlocks pointer

### Physics

Uses an Octree built from the scene's static geometry (`buildOctree.js`). A capsule (radius + height) is tested against the octree each frame. Gravity is simulated as a downward velocity that is zeroed when the capsule intersects the floor.

```js
// Typical usage in a World:
this.fpsController = new FpsController(this.experience, capsuleHeight, capsuleRadius)
this.fpsController.setOctree(buildOctree(staticMesh))

// In World.update(delta):
this.fpsController.update(delta)
```

### Pausing

```js
fpsController.enabled = false   // used during dialogue (no movement)
fpsController.enabled = true
```

### Crosshair

A DOM SVG element is created and positioned at the viewport center. It fades in when the pointer is locked and out when unlocked.

---

## CrosshairTarget

**`app/utils/three/CrosshairTarget.js`**

Raycasts from the screen center every frame (in FPS mode). Walks up the hit mesh's parent hierarchy to find the direct child of the scene root, and sets it as the single entry in `renderer.outlinePass.selectedObjects`.

In `#debug` mode, overlays the object's name, type, and path in the bottom-left corner of the screen. This is the primary tool for discovering real GLB mesh names.

---

## PhysicsWorld

**`app/utils/three/PhysicsWorld.js`**

Optional wrapper around [Rapier3D](https://rapier.rs/docs/user_guides/javascript/getting_started_js). Not currently active in any World. Available for future use if dynamic rigid-body simulation is needed.

```js
const physics = new PhysicsWorld()
await physics.init()           // loads WASM
physics.addStaticMesh(mesh)    // trimesh collider
physics.addDynamic(body)       // rigid body
physics.update(delta)          // step world
```

> Rapier3D is already in `package.json` as `@dimforge/rapier3d-compat`.

---

## buildOctree

**`app/utils/three/buildOctree.js`**

Builds a Three.js [`Octree`](https://threejs.org/docs/#examples/en/math/Octree) from a mesh (typically the entire static collision geometry of the scene). Used by `FpsController` for capsule collision.

```js
import buildOctree from '../buildOctree.js'
const octree = buildOctree(staticMesh)
fpsController.setOctree(octree)
```

The static mesh is usually the GLB's non-interactive geometry (walls, floors, ceilings). It should not include objects that move or disappear during gameplay.

---

## SceneManager

**`app/utils/three/SceneManager.js`**

> ⚠️ This class is partially implemented and not currently wired into `index.vue`, which handles transitions inline. It is kept as a reference for a future clean extraction of scene transition logic.

`SceneManager` would own one `Experience` and swap `World` instances. The current approach in `index.vue` is equivalent but co-located with the Vue component.
