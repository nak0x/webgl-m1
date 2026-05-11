# Cinematic Editor

The cinematic editor is a separate page (`/editor`) for authoring frame-accurate camera and post-FX sequences that play back at runtime inside a World.

---

## Concepts

A **cinematic** is a JSON document that describes a timeline of **events**. Each event has:
- A `frame` (start time in the timeline)
- A `duration` (how many frames it lasts, for progressive events)
- An `easing` function (for smooth interpolation)
- Type-specific properties (camera name, bloom strength, etc.)

The timeline is authored in the editor UI and exported as JSON. At runtime, `CinematicPlayer` reads the JSON and executes events as the playhead advances.

---

## CinematicPlayer

**`app/utils/three/cinematic/CinematicPlayer.js`**

Reads a GLB (for animations and cameras) and a JSON config. Drives the renderer's post-FX passes frame by frame.

### Usage in a World

```js
this.cinematicPlayer = new CinematicPlayer(experience)
await this.cinematicPlayer.load(gltfModel, timelineJson)
this.cinematicPlayer.play()
```

### Frame loop

```js
// In World.update(delta):
this.cinematicPlayer?.update(delta)
```

`CinematicPlayer` converts delta (ms) to frames using the timeline's FPS setting, advances the playhead, and fires due events.

### Animation playback

All [`THREE.AnimationClip`](https://threejs.org/docs/#api/en/animation/AnimationClip)s found in the GLB are automatically added to a [`THREE.AnimationMixer`](https://threejs.org/docs/#api/en/animation/AnimationMixer) and played. Animation time is driven by the playhead position, not `performance.now()` — scrubbing the timeline seeks the animations.

### Camera switching

`cameraCut` events call:

```js
experience.camera.instance.copy(namedCameraFromGlb)
```

The GLB must contain `PerspectiveCamera` nodes with unique names. These names appear in the editor's camera dropdown (populated via `store.hydrateFromGlb(gltf)`).

---

## CinematicInterpolator

**`app/utils/three/cinematic/CinematicInterpolator.js`**

Pure utility class — no Three.js dependency. Provides:

```js
CinematicInterpolator.lerp(a, b, t)
CinematicInterpolator.ease(t, fn)    // fn: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
CinematicInterpolator.clamp(v, min, max)
```

Used by `CinematicPlayer` for progressive (multi-frame) events.

---

## Event types

### `cameraCut`

Instant camera switch (no duration).

```json
{ "type": "cameraCut", "camera": "cam_intro" }
```

### `sound`

Trigger an audio asset.

```json
{
  "type": "sound",
  "assetId": "uuid-of-audio-asset",
  "volume": 0.8,
  "loop": false
}
```

### `bloom`

```json
{ "type": "bloom", "strength": 1.5, "radius": 0.4, "threshold": 0.85, "duration": 30, "easing": "easeInOut" }
```

### `dof`

```json
{ "type": "dof", "focus": 8.0, "aperture": 0.02, "maxblur": 0.01, "duration": 20, "easing": "easeOut" }
```

### `ssao`

```json
{ "type": "ssao", "radius": 8, "minDistance": 0.005, "maxDistance": 0.1, "duration": 0 }
```

### `vignette`

```json
{ "type": "vignette", "offset": 0.95, "darkness": 1.6, "duration": 10 }
```

### `shake`

Camera shake (procedural).

```json
{ "type": "shake", "intensity": 0.02, "duration": 15 }
```

### `motionBlur`

```json
{ "type": "motionBlur", "damp": 0.96, "duration": 0 }
```

### `chromaticAberration`

```json
{ "type": "chromaticAberration", "amount": 0.005, "duration": 5 }
```

### `filmGrain`

```json
{ "type": "filmGrain", "intensity": 0.35, "grayscale": false, "duration": 0 }
```

### `lut`

Apply a 3D LUT from the asset library.

```json
{ "type": "lut", "assetId": "uuid-of-lut-asset", "intensity": 1.0, "duration": 20 }
```

### `exposure`

```json
{ "type": "exposure", "ev": -1.64, "duration": 30, "easing": "easeInOut" }
```

### `edge`

Sobel edge detection.

```json
{ "type": "edge", "edgeStrength": 0.4, "edgeScale": 2.2, "edgeColor": "#000000", "duration": 0 }
```

### `aoColor`

AO tint color.

```json
{ "type": "aoColor", "color": "#1a1a3a", "strength": 0.5, "duration": 0 }
```

### `custom`

Free-form event for scripting.

```json
{ "type": "custom", "label": "trigger_explosion", "duration": 0 }
```

`CinematicPlayer` emits a `'custom'` event with the full event object; the World listens and handles it.

---

## Editor page

**`app/pages/editor.vue`**

### Toolbar actions

| Button | Action |
|--------|--------|
| Load GLB | Opens file picker, loads model into preview, hydrates camera list |
| Load JSON | Opens file picker, restores timeline from a saved export |
| Export JSON | Downloads current timeline as `.json` |
| Add Event | Opens type picker, inserts new event at current frame |
| Default Camera | Sets the initial camera for the cinematic |

### Panels

- **Viewport (center)** — Three.js preview canvas with `ResizeObserver`
- **Timeline (bottom)** — horizontal scrollable keyframe track; click to seek, drag events to reposition
- **Inspector (right)** — property editor for the selected event; fields adapt to event type
- **Assets (left)** — drag audio (.mp3/.wav/.ogg) or LUT (.cube) files; assigned to events via `assetId`

### Playback

- **Space** — toggle play / pause
- Timeline auto-scrolls with the playhead during playback

---

## Asset management

Assets (audio + LUT files) are managed as object URLs in the Pinia store:

```js
store.addAsset(file, 'audio')   // creates URL.createObjectURL(file)
store.removeAsset(id)           // calls URL.revokeObjectURL + removes from store
```

> Object URLs are revoked on `store.$reset()` and on `onBeforeUnmount` in `editor.vue` to avoid [memory leaks](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static#memory_management).

---

## JSON format (full example)

```json
{
  "fps": 30,
  "totalFrames": 300,
  "defaultCamera": "cam_intro",
  "cameras": ["cam_intro", "cam_wide", "cam_close"],
  "events": [
    {
      "id": "evt_001",
      "type": "cameraCut",
      "frame": 0,
      "camera": "cam_intro"
    },
    {
      "id": "evt_002",
      "type": "bloom",
      "frame": 60,
      "duration": 30,
      "easing": "easeInOut",
      "progressive": true,
      "strength": 1.5,
      "radius": 0.4,
      "threshold": 0.85
    },
    {
      "id": "evt_003",
      "type": "sound",
      "frame": 0,
      "assetId": "asset-uuid-here",
      "volume": 0.7,
      "loop": false
    }
  ],
  "assets": [
    {
      "id": "asset-uuid-here",
      "name": "intro_music.mp3",
      "type": "audio",
      "url": "blob:http://…"
    }
  ]
}
```

> Note: `url` values are `blob:` URLs generated at runtime. They are not persistent — the asset file must be re-loaded when opening a saved JSON.
