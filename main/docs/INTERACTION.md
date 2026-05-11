# Interaction, Quest & Dialogue

This document covers the three runtime systems that make the world interactive: `InteractionManager`, `QuestManager`, and `DialogueManager`.

---

## InteractionManager

**`app/utils/three/interaction/InteractionManager.js`**

The central hub for all player–world interaction. It owns three specialised detectors and normalises their output into a unified event vocabulary.

### Constructor

```js
this.interaction = new InteractionManager(experience)
// experience gives it access to camera, renderer.canvas, scene
```

### Registering objects

```js
// Hover / click (FPS crosshair or free mouse)
interaction.registerHoverable(mesh, 'npc_id')

// Approach-based
interaction.registerProximity(object3D, 'npc_id', 2.5)   // 2.5 m radius

// Zone passage
const box = new THREE.Box3().setFromObject(doorMesh)
interaction.registerTriggerZone(box, 'exit_door')

// Remove from all detectors
interaction.unregister('npc_id')
```

### Events

```js
interaction.on('proximity:enter',  ({ id }) => { … })
interaction.on('proximity:leave',  ({ id }) => { … })
interaction.on('trigger:enter',    ({ id }) => { … })
interaction.on('trigger:leave',    ({ id }) => { … })
interaction.on('hover:enter',      ({ id, object }) => { … })
interaction.on('hover:leave',      ({ id }) => { … })
interaction.on('hover:click',      ({ id, object }) => { … })
interaction.on('interact',         ({ ids }) => { … })   // E key pressed
```

`'interact'` fires when the player presses **E** while inside the proximity radius of one or more registered objects. `ids` is an array of all nearby IDs.

### FPS mode

```js
interaction.setFpsMode(true)   // raycast from screen center (FPS crosshair)
interaction.setFpsMode(false)  // raycast from mouse position
```

---

## ProximityDetector

**`app/utils/three/interaction/ProximityDetector.js`**

Runs every frame in `interaction.update()`. For each registered object, computes the Euclidean distance from the camera position to the object's world position, and emits `proximity:enter` / `proximity:leave` when the player crosses the registered radius.

> Distances are computed in 3D (including Y). If your object is elevated, account for eye height when choosing the radius.

---

## RaycastDetector

**`app/utils/three/interaction/RaycastDetector.js`**

Uses a [`THREE.Raycaster`](https://threejs.org/docs/#api/en/core/Raycaster) to detect hover and click. In FPS mode the ray originates from screen center `(0, 0)` in NDC; in free mode it follows the mouse.

Only the first hit per frame is processed. Objects deeper in the hierarchy are occluded by objects in front.

---

## TriggerZoneDetector

**`app/utils/three/interaction/TriggerZoneDetector.js`**

Accepts either a [`THREE.Box3`](https://threejs.org/docs/#api/en/math/Box3) or [`THREE.Sphere`](https://threejs.org/docs/#api/en/math/Sphere). Each frame it tests `zone.containsPoint(camera.position)` and emits enter/leave events on transitions.

Use this for level gates (e.g. "player reaches the door → transition to next scene").

---

## QuestManager

**`app/utils/three/quest/QuestManager.js`**

A linear step sequencer. There is one active step at any time. When the step's trigger fires, the quest advances.

### Step format

```js
{
  id: 'talk_npc',
  label: 'Speak to the coffee machine',
  hint:  'Press E when nearby',

  trigger: {
    type: 'interact',              // 'interact' | 'proximity:enter' | 'trigger:enter'
    id:   'npc_id',               // must match an id registered with InteractionManager
  },

  dialogue: [                     // optional — blocks advancement until complete
    { speaker: 'Machine', text: 'Hello, new employee.' },
    { speaker: 'Machine', text: 'Your first task is on the PC.' },
  ],

  onComplete: ({ interaction, scene }) => {
    // optional callback after dialogue (if any) completes
    // interaction.unregister('npc_id')
  },
}
```

### Usage

```js
const quest = new QuestManager(experience)
quest.addStep({ id: 'talk_npc', … })
quest.addStep({ id: 'use_pc',   … })
quest.addStep({ id: 'exit',     … })
quest.start()   // activates first step
```

### Events

| Event | Payload |
|-------|---------|
| `'step:active'` | `{ step, index, total }` |
| `'step:complete'` | `{ step, index }` |
| `'quest:complete'` | none |

These are consumed by `useQuestState` to drive the HUD.

### Dialogue integration

If a step has a `dialogue` array, `QuestManager` passes it to `DialogueManager.open()` and waits for the `'complete'` event before calling `onComplete()` and advancing. The FPS controller is paused during dialogue.

---

## DialogueManager

**`app/utils/three/dialogue/DialogueManager.js`**

A pure dialogue sequencer with no Vue dependency. Manages a queue of lines and exposes `next()` to advance.

### API

```js
const dlg = new DialogueManager()

dlg.open([
  { speaker: 'NPC', text: 'Line one.' },
  { speaker: 'NPC', text: 'Line two.' },
])

dlg.next()   // advance to next line (or close if last)
```

### Events

| Event | Payload |
|-------|---------|
| `'open'` | `{ lines }` |
| `'line'` | `{ speaker, text, index, total }` |
| `'complete'` | none |

`useDialogueState` subscribes to these and exposes `next()` to the Vue HUD (via `DialogueHud.vue`).

---

## Full wiring example

The sequence below illustrates how a proximity-triggered interaction flows end-to-end.

```
1. AtelierWorld._setupQuest():
     interaction.registerProximity(npcMesh, 'npc_id', 2.5)
     quest.addStep({
       id: 'talk_npc',
       trigger: { type: 'interact', id: 'npc_id' },
       dialogue: [ … ],
     })
     quest.start()
     experience.setDialogue(this.dialogue)

2. Runtime — player walks toward NPC:
     ProximityDetector → interaction.emit('proximity:enter', { id: 'npc_id' })
     QuestManager (listening for current step's trigger id) → FPS hint "Press E"

3. Player presses E:
     InteractionManager → interaction.emit('interact', { ids: ['npc_id'] })
     QuestManager → finds step with trigger id 'npc_id'
                  → dialogue.open([…])
                  → fpsController.enabled = false

4. dialogue.emit('line', { speaker, text, index, total })
     useDialogueState → updates reactive refs
     DialogueHud.vue → re-renders with new text

5. Player presses Space / Next button:
     DialogueHud.vue emits 'next'
     pages/index.vue → dialogueState.next()
                     → dialogue.next()

6. After last line:
     dialogue.emit('complete')
     QuestManager → step.onComplete(…)
                  → fpsController.enabled = true
                  → advances to next step

7. quest.emit('step:active', { step: next, … })
     useQuestState → updates stepIndex, label, hint refs
     QuestHud.vue → re-renders
```

---

## PointerStyler

**`app/utils/three/interaction/PointerStyler.js`**

Updates `document.body.style.cursor` based on the current hover state:

| State | Cursor |
|-------|--------|
| Not hovering | `'default'` |
| Hovering a hoverable | `'pointer'` |
| FPS mode | `'none'` (hidden, crosshair SVG is shown instead) |
