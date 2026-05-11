# Phase 2 — Clipper + Web Worker

Read CLAUDE.md before writing any code.

## Task
Implement the geometry clipper and wire the Web Worker. No LODs yet — LOD0 (full res) only. Validate output is correct before Phase 3.

## Deliverables

### 1. src/lib/clipper.js

Pure module, zero imports, zero side effects. Export two functions:

```js
/**
 * Clip a triangle against one axis-aligned half-plane.
 * Writes surviving vertices into `out` scratch Float32Array.
 * Returns vertex count (0, 3, 4, or 6 — triangulated output count is floor(n-2)*3*3 floats).
 * NO object allocation. NO Vector3. Raw index arithmetic only.
 *
 * @param {Float32Array} verts - flat [x,y,z, x,y,z, x,y,z] for one triangle
 * @param {number} axis  - 0=X, 2=Z
 * @param {number} edge  - world coordinate of clip plane
 * @param {boolean} keep_positive - true = keep verts where verts[axis] >= edge
 * @param {Float32Array} out - pre-allocated scratch, min 18 floats
 * @returns {number} vertex count in out (0, 3, or 4)
 */
export function clipTriangleHalfPlane(verts, axis, edge, keep_positive, out) {}

/**
 * Slice a merged position-only BufferGeometry into chunk buckets.
 * Positions array: flat Float32Array [x,y,z,...], indexed or non-indexed.
 * Returns Map<chunkId, Float32Array> of non-indexed position arrays per chunk.
 * chunkId format: `${col}_${row}`.
 *
 * Boundary snapping: after interpolating a cut vertex, hard-set positions[axis] = edge exactly.
 *
 * @param {Float32Array} positions
 * @param {Uint32Array|null} indices
 * @param {number} chunkSize
 * @param {number} originX
 * @param {number} originZ
 * @returns {Map<string, Float32Array[]>} buckets — arrays to concatenate per chunk
 */
export function sliceGeometry(positions, indices, chunkSize, originX, originZ) {}
```

**Inner loop pseudocode for sliceGeometry:**
```
pre-alloc scratch buffers A[18], B[18] outside loop
for each triangle:
  copy 3 verts into A
  for each chunk cell that triangle's AABB touches:
    clip A against cell.minX  → B (keep positive)
    clip B against cell.maxX  → A (keep negative)
    clip A against cell.minZ  → B (keep positive)
    clip B against cell.maxZ  → A (keep negative)
    if surviving verts >= 3: triangulate fan, push to bucket[col_row]
```

Only iterate chunk cells the triangle's AABB overlaps — compute min/max col/row from triangle bounds, not all cells.

### 2. src/lib/meshopt.js

```js
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer'

// Call once at app start. Returns promise.
export async function initMeshopt() {}

/**
 * @param {Float32Array} positions - flat xyz, non-indexed
 * @param {number} targetRatio     - 1.0 = full res
 * @param {number} targetError
 * @returns {{ positions: Float32Array, indices: Uint32Array }}
 */
export function simplifyAndOptimize(positions, targetRatio, targetError) {}
```

Pipeline inside `simplifyAndOptimize`:
1. Build index buffer from non-indexed positions (meshopt `generateVertexRemap`)
2. `simplifyMesh` with targetIndexCount = `floor(indexCount * targetRatio)`
3. `optimizeVertexCache`
4. `optimizeVertexFetch`
5. Return compacted positions + indices

### 3. src/workers/chunker.worker.js

```js
// Vite worker — imported in useChunker.js as:
// import ChunkerWorker from './workers/chunker.worker.js?worker'

import { sliceGeometry } from '../lib/clipper.js'
import { initMeshopt, simplifyAndOptimize } from '../lib/meshopt.js'
```

Worker flow:
```
onmessage({ type: 'start', districts, chunkSize, lodRatios, lodErrors }):
  await initMeshopt()
  buckets = new Map()

  for each district (ArrayBuffer) in districts:
    post progress { stage: 'merge', district: i, pct: 0 }
    parse GLB manually (see note) → Float32Array positions, Uint32Array|null indices
    post progress { stage: 'merge', district: i, pct: 1 }

    post progress { stage: 'clip', district: i, pct: 0 }
    newBuckets = sliceGeometry(positions, indices, chunkSize, originX, originZ)
    merge newBuckets into global buckets (append arrays)
    post progress { stage: 'clip', district: i, pct: 1 }

  totalChunks = buckets.size * lodRatios.length
  done = 0

  for each [chunkId, arrays] of buckets:
    merged = concatenate arrays → single Float32Array
    for each lod (0,1,2):
      post progress { stage: 'simplify', lod, chunk: chunkId, pct: done/totalChunks }
      { positions, indices } = simplifyAndOptimize(merged, lodRatios[lod], lodErrors[lod])
      glbBuffer = buildMinimalGLB(positions, indices)  // see note
      postMessage({ type: 'chunk_done', chunkId, lod, buffer: glbBuffer }, [glbBuffer])
      done++

  postMessage({ type: 'done', manifest: buildManifest(buckets, chunkSize) })
```

**GLB parsing note**: Use a minimal GLB parser — read the 12-byte header, find the JSON chunk, parse accessor/bufferView for POSITION attribute. Do not import Three.js into the worker (bundle size). Write ~60 lines of raw GLB parsing using DataView.

**GLB building note**: Similarly write a minimal GLB builder — binary GLTF with one mesh, one primitive, positions accessor + optional index accessor. No materials. ~80 lines using DataView. Avoids importing GLTFExporter into the worker.

### 4. src/composables/useChunker.js

```js
export function useChunker() {
  const progress = ref([])   // array of progress event objects
  const isRunning = ref(false)
  const chunks = ref([])     // { chunkId, lod, url } — Blob URLs for download

  function start(districts, config) {}   // spins up worker, sends 'start'
  function cancel() {}                   // terminates worker

  return { progress, isRunning, chunks, start, cancel }
}
```

On `chunk_done`: create `URL.createObjectURL(new Blob([buffer]))`, push to `chunks`.
On `done`: also trigger manifest download.
On `error`: set error state, stop worker.

## Validation
After implementation, test with a small synthetic GLB (a 10×10 grid of triangles spanning 0–128 units). Assert:
- All triangles accounted for (total tri count in buckets ≈ input count, slight increase from clipping is expected)
- No chunk contains vertices outside its AABB (check with a test loop)
- Boundary vertices on shared edges have identical float values on both sides
