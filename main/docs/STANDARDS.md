# Code Standards

Conventions, naming rules, and cleanup policy for this codebase. All contributors are expected to follow these. They are enforced by the Claude Code assistant when making changes.

---

## File naming

| Location | Convention | Example |
|----------|-----------|---------|
| `utils/three/*.js` | `PascalCase`, one class per file | `FpsController.js` |
| `utils/three/world/<Scene>/` | `<Scene>World.js`, `<Scene>Sources.js`, `<Scene>Config.js` | `AtelierWorld.js` |
| `components/*.vue` | `PascalCase` | `QuestHud.vue`, `DialogueHud.vue` |
| `composables/*.js` | `use<Name>.js` | `useQuestState.js` |
| `stores/*.js` | `camelCase` | `cinematicEditor.js` |
| `pages/*.vue` | `camelCase` or `kebab-case` | `index.vue`, `editor.vue` |

---

## Class naming

```js
// Good
class AtelierWorld { … }
class QuestManager { … }
class FpsController { … }

// Bad — abbreviations, lowercase
class atelierworld { … }
class QM { … }
```

---

## Instance and method naming

```js
camelCase                  // variables and methods
this.fpsController         // instance properties
_privateMethod()           // leading underscore = internal, not part of public API
```

---

## Event names (EventEmitter)

```
snake_case, short, no noun repeat
  tick
  resize
  ready
  progress
  step:active
  step:complete
  quest:complete
  hover:enter
  hover:leave
  proximity:enter
  trigger:enter
  interact
  open
  line
  complete
```

---

## Quest / interaction IDs

```
snake_case
  talk_npc
  use_pc
  pick_tool
  exit_door
```

---

## Imports

```js
// Named imports from 'three' — do not use * as THREE unless you need a large surface
import { Vector3, Mesh, MeshStandardMaterial } from 'three'

// Three.js addons — always the full path
import { GLTFLoader }   from 'three/examples/jsm/loaders/GLTFLoader.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'

// Project modules — explicit relative paths, no barrel index.js
import Camera from './Camera.js'
import AtelierWorld from './world/atelier/AtelierWorld.js'

// Auto-imported (do NOT import these manually — Nuxt handles them)
// utils/three/materials/*.js
// utils/three/textures/*.js
```

---

## Comments

**Default: no comments.** Well-named variables and methods communicate intent.

Write a comment only when the **why** is non-obvious:

```js
// Exposure in stops: Math.pow(2, ev) converts to linear multiplier
this.acesPass.uniforms['exposure'].value = Math.pow(2, -1.64)

// OutlinePass uses AdditiveBlending — cannot produce black outlines
this.outlinePass.visibleEdgeColor.set('#ffffff')
```

Never:
- Comment what the code does (`// increment i`)
- Reference the task, issue, or caller (`// added for quest step 2`)
- Write multi-line docstrings for simple methods

---

## Error handling

- Validate at system boundaries: file input, GLB loading, fetch calls.
- Do **not** add defensive try/catch for cases that cannot happen in normal usage.
- Trust manager state — `QuestManager`, `DialogueManager`, `InteractionManager` enforce their own invariants.

```js
// OK — validating external input
resources.on('error', (err) => console.error('Asset load failed:', err))

// Not OK — defensive catch around trusted internal code
try {
  this.quest.addStep(step)   // this can't throw unless step is malformed
} catch(e) { … }
```

---

## Destroy / cleanup

Every module that allocates GPU resources or attaches listeners **must** implement `dispose()`:

```js
dispose() {
  this.geometry.dispose()          // Three.js geometry
  this.material.dispose()          // Three.js material
  this.texture?.dispose()          // Three.js texture
  window.removeEventListener(…)    // DOM listeners
  this.debug?.folder?.destroy()    // lil-gui folder
  this.mixer?.stopAllAction()      // AnimationMixer
}
```

The parent always calls the child's `dispose()`. `Experience.dispose()` is the root of this tree.

> See [Three.js guide: How to dispose of objects](https://threejs.org/docs/#manual/en/introduction/How-to-dispose-of-objects).

---

## Vue / Composables

```js
// Composables expose refs/computed only — never raw Three.js objects
export function useQuestState() {
  const currentStep = ref(null)
  // …
  return { currentStep, stepIndex, totalSteps, completed, bind }
}

// Components: bind in onMounted, unbind in onBeforeUnmount
onMounted(() => questState.bind(world.quest))
onBeforeUnmount(() => questState.unbind?.())

// Never:
import { Mesh } from 'three'          // not in .vue files
experience.renderer.outlinePass.selectedObjects.push(mesh)  // not from .vue
```

---

## What not to do

| Anti-pattern | Why |
|-------------|-----|
| Opportunistic refactoring during a bug fix | Scope creep, review noise, risk of regression |
| Premature abstraction | Three similar lines > one over-engineered helper |
| Feature flags without a reason | Just change the code |
| Backwards-compat shims | No multi-version deployment here |
| `console.log` left in committed code | Noise in production |
| `git push --force` on `main` | Never |

---

## Legacy files (do not resurrect)

These files exist in the repo but are dead. Do not import them, copy from them, or add code to them without explicit discussion.

| File | Status | Reason |
|------|--------|--------|
| `app/utils/three/PcScreen.js` | Dead | CSS3DRenderer integration — incomplete |
| `app/utils/three/SilhouetteOutline.js` | Dead | Replaced by OutlinePass |
| `app/utils/three/SceneManager.js` | Dead | Scene transition logic is in `index.vue` |
| `app/utils/three/materials/createBois.js` | Dead | Unused, from legacy project |
| `app/utils/three/materials/createEau.js` | Dead | Unused |
| `app/utils/three/materials/createPlexiglass.js` | Dead | Unused |
| `app/utils/three/materials/createVerre.js` | Dead | Unused |
| `app/utils/three/materials/createXray.js` | Dead | Unused |
| `app/utils/three/textures/makePlexiTexture.js` | Dead | Unused |
| `app/utils/three/textures/makeWoodTexture.js` | Dead | Unused in current scenes |

> Before deleting any of these, verify with `grep -r "from.*FileName"` that no active import references them. Also check Nuxt's auto-import for the `materials/` and `textures/` directories.

### Exception: black outlines

`OutlinePass` cannot produce black outlines (it uses additive blending). If a black outline is genuinely needed, `SilhouetteOutline.js` can be reactivated — but only after discussion.

---

## Three.js version lock

The project is pinned to **Three.js r183** (`three@0.183.2`). Do not use any API, class, or feature introduced in r184 or later. When in doubt, consult the [Three.js migration guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide) and the [r183 changelog](https://github.com/mrdoob/three.js/releases/tag/r183).

Examples of r184+ features to avoid:
- `WebGPURenderer`
- `NodeMaterial` system changes post-r183
- Any import path that changed in r184

---

## Git workflow

- **One branch per feature or scene** — e.g. `1st_scene_atelier`, `fps-collisions`
- **Never force-push `main`**
- **Commit scope prefixes:** `world/`, `quest/`, `fps/`, `interaction/`, `renderer/`, `hud/`
- **PROGRESS.md** must be updated when a TODO is resolved or a blocker is discovered

```
feat(world): add HubWorld scene transition
fix(fps): correct capsule collision with sloped surfaces
docs: update PROGRESS.md — exit_door step complete
```
