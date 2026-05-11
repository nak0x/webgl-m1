# HUD & Vue Layer

The Vue layer is a thin overlay on top of the Three.js canvas. It never touches the 3D engine directly — all communication goes through composables that bridge `EventEmitter` events into reactive Vue refs.

---

## The Three → Vue bridge

```
Three.js (EventEmitter) ──► Composable (singleton) ──► Vue component
     manager.emit(…)         updates ref(…)              reads ref
```

Each composable is a **singleton**: it holds state across the app's lifetime and is bound to a manager instance once per scene load.

### useQuestState

**`app/composables/useQuestState.js`**

```js
const questState = useQuestState()
questState.bind(questManagerInstance)

// Reactive refs:
questState.currentStep    // Object | null — the active step
questState.stepIndex      // number — 0-based
questState.totalSteps     // number
questState.completed      // boolean
```

**Binding** subscribes to `QuestManager` events and writes to the refs. Call it once after the World is loaded:

```js
// pages/index.vue
const world = new AtelierWorld(experience)
questState.bind(world.quest)
```

### useDialogueState

**`app/composables/useDialogueState.js`**

```js
const dialogueState = useDialogueState()
dialogueState.bind(dialogueManagerInstance)

// Reactive refs / computed:
dialogueState.active    // boolean — is a dialogue open?
dialogueState.current   // { speaker, text } | null
dialogueState.index     // number — current line index (0-based)
dialogueState.total     // number — total lines
dialogueState.isLast    // computed boolean

// Action:
dialogueState.next()    // advance to next line
```

`DialogueHud.vue` calls `dialogueState.next()` when the player clicks Next or presses Space.

---

## Components

### QuestHud.vue

**`app/components/QuestHud.vue`**

Top-right overlay showing the active quest objective.

```vue
<QuestHud
  :current-step="questState.currentStep"
  :step-index="questState.stepIndex"
  :total-steps="questState.totalSteps"
/>
```

Displays:
- `step.label` — main objective text
- `step.hint` — secondary hint (optional)
- Step counter: `X / Y`

Animated with a fade + slide-right CSS transition.

---

### DialogueHud.vue

**`app/components/DialogueHud.vue`**

Bottom overlay for dialogue lines.

```vue
<DialogueHud
  :active="dialogueState.active"
  :current="dialogueState.current"
  :index="dialogueState.index"
  :total="dialogueState.total"
  :is-last="dialogueState.isLast"
  @next="dialogueState.next()"
/>
```

Displays:
- Speaker name (blue label)
- Line text
- "Next" / "Close" button
- Keyboard hint (Space / Enter)

**Keyboard shortcut:** Space or Enter calls `next()` when dialogue is active. The handler is attached with `@keydown` on the component root.

---

### StartHud.vue

**`app/components/StartHud.vue`**

Full-screen start screen shown before the experience begins.

```vue
<StartHud @start="handleStart" />
```

Emits `'start'` when the player clicks the launch button. `pages/index.vue` listens to this to mount the `Experience` and load the first World.

---

### LoadingHud.vue

**`app/components/LoadingHud.vue`**

Bottom-center progress bar shown while assets load.

```vue
<LoadingHud :visible="isLoading" :progress="loadProgress" />
```

`progress` is a `0..1` float. Driven by `resources.on('progress', …)` in `pages/index.vue`.

---

## Cinematic editor components

These live in `app/components/editor/` and are used only by `pages/editor.vue`.

| Component | Purpose |
|-----------|---------|
| `EditorTimeline.vue` | Horizontal keyframe timeline with seek handle |
| `EditorInspector.vue` | Property panel for the selected event (right panel) |
| `EditorAssets.vue` | Asset library panel (audio + LUT files) |
| `AnimParam.vue` | Reusable form row for a single event parameter |

> See [`docs/CINEMATIC.md`](CINEMATIC.md) for editor architecture.

---

## Vue component rules

- **Never call Three.js** from a `.vue` file. Use composables.
- **`onMounted`** for event binding (composable `bind()` calls, DOM refs).
- **`onBeforeUnmount`** for cleanup (composable `unbind()` if exists, listener removal).
- **`<script setup>`** only — no Options API.
- **No CSS in `<style scoped>`** that references global Three.js state.
- **Transitions** use Vue's `<Transition>` component with CSS classes, not JS animations.

---

## Pinia store — cinematicEditor

**`app/stores/cinematicEditor.js`**

Used exclusively by `pages/editor.vue` and its child components. Not involved in the main gameplay flow.

| State | Type | Description |
|-------|------|-------------|
| `fps` | number | Timeline frames per second |
| `totalFrames` | number | Total timeline length |
| `cameras` | string[] | Available camera names from GLB |
| `defaultCamera` | string | Initial camera |
| `events` | Event[] | Keyframe events array |
| `assets` | Asset[] | Audio + LUT file references |
| `currentFrame` | number | Playhead position |
| `isPlaying` | boolean | Playback state |
| `selectedEventId` | string\|null | Currently selected event |

### Actions

```js
store.addEvent(type, frame)          // create a new keyframe event
store.updateEvent(id, patch)         // patch event properties
store.deleteEvent(id)
store.duplicateEvent(id)

store.addAsset(file, type)           // 'audio' | 'lut'
store.removeAsset(id)

store.hydrateFromGlb(gltf)           // read cameras from loaded GLB
store.loadJson(json)                 // load a saved timeline
store.exportJson()                   // return JSON string
store.$reset()                       // clear all state
```

### Event types supported by the editor

`cameraCut`, `sound`, `vignette`, `shake`, `custom`, `bloom`, `dof`, `ssao`, `motionBlur`, `chromaticAberration`, `filmGrain`, `lut`, `exposure`, `edge`, `aoColor`

Each type has its own set of properties rendered by `EditorInspector.vue`.

---

## global.css

**`app/assets/css/global.css`**

Loaded via `css: [...]` in `nuxt.config.js` — applied globally with no scoping.

Key rules:
- Full-viewport `body` with `overflow: hidden`
- `canvas` positioned `fixed`, top-left, 100vw × 100vh, `z-index: 0`
- HUD components use `position: fixed` with appropriate `z-index` values to layer above the canvas
- Font: `system-ui, sans-serif`
