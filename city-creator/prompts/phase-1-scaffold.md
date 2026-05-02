# Phase 1 — Scaffold + Preview Canvas

Read CLAUDE.md before writing any code.

## Task
Bootstrap the Vite + Vue 3 project and build the interactive preview canvas. No worker, no clipping yet.

## Deliverables

### 1. Project init
```bash
npm create vite@latest city-chunker -- --template vue
cd city-chunker
npm install three meshoptimizer
```

### 2. App.vue
Two-column layout: left panel (controls), right panel (canvas). Use CSS grid, no UI framework. Dark theme (`#0f0f0f` background). Left panel fixed 320px, canvas fills remainder.

### 3. DropZone.vue
- Accepts multiple `.glb` files via drag-drop or file picker
- Emits `files-added` with `File[]`
- Shows list of loaded district names with a remove button per district
- Visual drag-over state

### 4. ChunkConfig.vue
- Number input: **Chunk size** — default `64`, min `8`, step `8`
- Number inputs for LOD errors: LOD1 error (default `0.01`), LOD2 error (default `0.05`)
- All values emitted via `update:config` with shape `{ chunkSize, lodErrors: [0, n, n] }`

### 5. PreviewCanvas.vue
- Three.js scene, OrbitControls, perspective camera
- On district file load: parse with GLTFLoader, add merged wireframe mesh to scene, fit camera to bounding box
- **Grid overlay**: on chunk size change, draw a flat grid in XZ plane using Three.js `GridHelper` or custom LineSegments matching the chunk size and city extents. Grid lines at every `chunkSize` unit. Grid updates reactively.
- **Chunk AABB wireframes**: for each non-empty chunk cell (computed from loaded geometry bounds), draw a `Box3Helper` wireframe in a distinct color
- Props: `districts: File[]`, `chunkSize: number`

### 6. ProgressPanel.vue
- Accepts `progress` prop (shape defined in CLAUDE.md worker protocol)
- Shows a stacked list: one row per district, each with a stage label and progress bar
- Hidden when no job is running

## Notes
- Use `shallowRef` for Three.js objects (avoid Vue reactivity on 3D objects)
- Canvas resize: use `ResizeObserver` on the canvas container, call `renderer.setSize`
- No export button yet — just the UI shell and live preview
