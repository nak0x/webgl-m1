# City Chunker — Project Knowledge Base

## What this is
A standalone Vite + Vue 3 browser tool. Imports 3D city district `.glb` files, slices them into a chunk grid, runs meshopt LOD simplification, exports per-chunk `.glb` files + `manifest.json`. No SSR. No backend. Runs entirely in the browser.

## Stack
- **Vite** + **Vue 3** (`<script setup>`, Composition API)
- **Three.js** — preview canvas only, no game loop needed
- **meshoptimizer** WASM (`meshoptimizer` npm) — simplify + optimize
- **three/examples/jsm/exporters/GLTFExporter** — plain GLB export
- **Web Worker** — all geometry work, never touches main thread

## Project structure
```
src/
  components/
    DropZone.vue        # district file import, drag-drop
    PreviewCanvas.vue   # Three.js canvas + grid overlay + chunk AABBs
    ChunkConfig.vue     # chunk size input (default 64), LOD settings
    ProgressPanel.vue   # per-district + per-stage progress
  workers/
    chunker.worker.js   # ALL heavy geometry — import with ?worker
  lib/
    clipper.js          # Sutherland-Hodgman, pure functions, zero alloc inner loop
    meshopt.js          # meshoptimizer WASM wrapper
    manifest.js         # manifest builder
  composables/
    useChunker.js       # worker lifecycle, reactive progress + chunks refs
  App.vue
```

## Geometry constraints
- 5 districts, ~300×300 units each, 6–15M polys, no materials, no textures, positions only
- Triangles WILL straddle chunk boundaries → clipping is mandatory
- Process one district at a time to stay memory safe

## Clipper rules (critical)
- Sutherland-Hodgman, clip X axis then Z axis per chunk cell
- Inner loop: raw Float32Array index arithmetic, zero Vector3/object allocation
- Scratch buffer pre-allocated outside the loop, reused every triangle
- **Boundary vertex snapping**: when a new vertex is created on a cut edge, hard-set the boundary-axis component to the exact chunk edge float — never use the interpolated value. Prevents T-junction cracks at seams.

## Worker message protocol
```js
// Main → Worker
{ type: 'start', districts: ArrayBuffer[], chunkSize: number, lodRatios: [1.0, 0.25, 0.06], lodErrors: [0, 0.01, 0.05] }

// Worker → Main
{ type: 'progress', stage: 'merge'|'clip'|'simplify'|'export', district?: number, lod?: number, chunk?: string, pct: number }
{ type: 'chunk_done', chunkId: string, lod: number, buffer: ArrayBuffer }  // transfer, not clone
{ type: 'done', manifest: Object }
{ type: 'error', message: string, district?: number }
```
Always postMessage ArrayBuffers as Transferable — never structured clone.

## LOD spec
| LOD | ratio | error threshold |
|-----|-------|-----------------|
| 0   | 1.0   | 0 (full res)    |
| 1   | 0.25  | 0.01            |
| 2   | 0.06  | 0.05            |

meshopt pipeline per chunk per LOD:
1. `simplifyMesh(indices, positions, targetIndexCount, targetError)`
2. `optimizeVertexCache(indices)`
3. `optimizeVertexFetch(vertices, indices)`

## File naming
```
chunk_{col}_{row}_lod{n}.glb
manifest.json
```

## Manifest schema
```json
{
  "chunkSize": 64,
  "origin": [0, 0],
  "chunks": [{
    "id": "4_2",
    "col": 4, "row": 2,
    "aabb": { "min": [x,y,z], "max": [x,y,z] },
    "lods": [
      { "file": "chunk_4_2_lod0.glb", "triCount": 48200 },
      { "file": "chunk_4_2_lod1.glb", "triCount": 12050 },
      { "file": "chunk_4_2_lod2.glb", "triCount": 2890 }
    ]
  }]
}
```

## Do not
- Do not use Nuxt, SSR, or any server-side code
- Do not allocate objects inside the clipper inner loop
- Do not structured-clone ArrayBuffers — always transfer
- Do not merge all districts before clipping — process one at a time
- Do not add materials, textures, or lighting to exports
- Do not use Draco in-app — user runs Draco externally after export
