# City Chunker — Technical Reference

A complete description of every optimisation, architecture decision, and data
contract in this tool. Use this document as context when prompting a model to
extend, debug, or port the codebase.

---

## 1. What the tool does

Accepts up to five raw city-district `.glb` files (position-only, 6–15 M
triangles each, ~300 × 300 world units each). Lets the user arrange them in XZ
space with a 3-D translate/rotate gizmo. When the user clicks **Process**:

1. Parses every GLB in a Web Worker (main thread never touches geometry).
2. Applies each district's XZ translation + Y-axis rotation (around the
   district centroid) so all geometry is in a single world space.
3. Clips every triangle to an axis-aligned chunk grid using the
   Sutherland–Hodgman algorithm.
4. Runs meshoptimizer LOD simplification on each chunk (3 LODs).
5. Exports each chunk as a self-contained `.gltf` (binary embedded as
   base64 data URI).
6. Bundles everything into a `chunks.zip` download alongside a
   `manifest.json`.

---

## 2. Stack

| Concern | Package / API |
|---------|---------------|
| UI | Vue 3 `<script setup>`, Composition API |
| 3-D preview | Three.js r184 |
| Geometry work | Web Worker (`?worker` Vite import) |
| LOD simplification | `meshoptimizer` npm (WASM) |
| ZIP download | `fflate` — `zipSync` |
| Build | Vite 8, `esnext` target |

No SSR. No backend. No Draco in-browser (user runs `gltf-transform draco`
after export).

---

## 3. Web Worker architecture

### Why a dedicated worker

Geometry work (parsing, clipping, simplification) on 15 M-triangle scenes
blocks the main thread for tens of seconds. A Worker runs on a separate OS
thread; the Vue UI remains responsive.

### Vite worker import

```js
import ChunkerWorker from '../workers/chunker.worker.js?worker'
// …
const worker = new ChunkerWorker()
```

The `?worker` suffix tells Vite to bundle the module as an ES-module Worker
entry point. Required config:

```js
// vite.config.js
export default defineConfig({
  worker: { format: 'es' },          // ES modules inside the worker bundle
  optimizeDeps: { exclude: ['meshoptimizer'] },  // WASM — skip pre-bundling
  build: { target: 'esnext' },
})
```

`meshoptimizer` ships a WASM binary. Vite's pre-bundler breaks WASM imports;
excluding it makes the worker load the package directly without transformation.

### Message protocol

```
Main → Worker
{ type: 'start',
  districts:   ArrayBuffer[],        // transferred (zero-copy)
  offsets:     [{x, z, angle}, …],  // structured-cloned (plain objects)
  chunkSize:   number,
  lodRatios:   [1.0, 0.25, 0.06],
  lodErrors:   [0, 0.01, 0.05],
  previewOnly: boolean }

Worker → Main
{ type: 'progress', stage: 'merge'|'clip'|'simplify'|'export',
  district?: number, lod?: number, chunk?: string, pct: number }
{ type: 'chunk_done', chunkId: string, lod: number, gltf: string, triCount: number }
{ type: 'done',  manifest: Object }
{ type: 'error', message: string, district?: number }
```

### Transferable ArrayBuffers

All `ArrayBuffer` district payloads are listed in the `transfer` array of
`postMessage` — they are **moved** (zero-copy), not copied. After transfer the
sender's reference becomes detached (zero byteLength). Plain objects like
offsets are structured-cloned normally.

```js
worker.postMessage({ type: 'start', districts: buffers, … }, buffers)
//                                                            ^^^^^^^ transfer list
```

`chunk_done` responses carry a GLTF string (not an ArrayBuffer) so no transfer
is needed there.

---

## 4. GLB parser (worker-side, no Three.js)

Three.js `GLTFLoader` runs on the main thread and cannot be called from a
Worker. The worker uses a hand-written minimal parser.

### Binary layout assumed

```
Bytes 0–3   magic   0x46546C67 ("glTF")
Bytes 4–7   version 2
Bytes 8–11  total length
Bytes 12–19 JSON chunk header  (length + type 0x4E4F534A)
Bytes 20…   JSON payload
Bytes 20+jsonLen … BIN chunk header (length + type 0x004E4942)
Bytes 20+jsonLen+8 … binary payload
```

### What the parser handles

| Feature | Implementation |
|---------|----------------|
| Multiple meshes / primitives | Walk `scene.nodes` recursively via `visitNode` |
| Node transform hierarchy | Accumulate parent × local matrix; apply to positions if non-identity |
| TRS → matrix | Quaternion → rotation matrix, combined with scale / translation |
| Interleaved vertex buffers | Detected via non-zero / non-12 `byteStride`; extracted with `DataView` per vertex |
| Tightly packed buffers | Single `Float32Array` slice (fast path) |
| UINT16 indices | `componentType 5123` → `Uint16Array` → rebase to merged vertex offset |
| UINT32 indices | `componentType 5125` → `Uint32Array` → rebase |
| UBYTE indices | `componentType 5121` → `Uint8Array` → rebase |
| Non-indexed primitives | Generate sequential indices `[0, 1, 2, …]` |
| Non-TRIANGLES modes | `prim.mode !== 4` → skip silently |
| Draco-compressed input | Throw with clear message — user must re-export uncompressed |
| No POSITION accessor | Skip primitive |
| Sparse accessor | Not supported (throw) |
| GLB with no scene | Fall back to iterating all meshes without transforms |

### Merging multiple primitives

Every parsed primitive contributes a `Float32Array` of positions and a
`Uint32Array` of indices rebased to a running `vertexBase` counter. After all
primitives are collected, both arrays are concatenated once:

```js
const positions = new Float32Array(vertexBase * 3)
// … one set() call per primitive chunk

const indices = new Uint32Array(totalIdx)
// … one set() call per index chunk
```

Single allocation per array type, regardless of primitive count.

### Error handling per district

Parse errors for a single district post `{ type: 'error', district: i,
message }` and `continue` the loop. Remaining districts are still processed.
The main thread marks that district with a visual error indicator but does not
abort.

---

## 5. Placement transform (translation + rotation)

### Data model

Each district has an offset `{ x, z, angle }`:

- `x, z` — world position of the district's **centroid** (not its origin)
- `angle` — Y-axis rotation in radians (Three.js right-hand convention)

The centroid is computed inside the worker from the parsed vertex positions:

```js
let sumX = 0, sumZ = 0
const n = positions.length / 3
for (let j = 0; j < positions.length; j += 3) { sumX += positions[j]; sumZ += positions[j+2] }
const cx = sumX / n, cz = sumZ / n
```

### Transform applied to each vertex

```
centred_x = vertex_x − cx
centred_z = vertex_z − cz

world_x = centred_x · cos(angle) + centred_z · sin(angle) + wx
world_z = −centred_x · sin(angle) + centred_z · cos(angle) + wz
```

This is a Three.js Y-up right-hand rotation:
`x' = x·cos + z·sin`, `z' = −x·sin + z·cos`.

**Default (null offset)**: `wx = cx`, `wz = cz`, `angle = 0` → identity.
The district stays at its original GLB world position without any user
adjustment needed.

---

## 6. Sutherland–Hodgman clipper

### Why clip at all

Triangles routinely straddle chunk boundaries. Without clipping, each triangle
would land in multiple buckets duplicated, causing seam cracks and inflated
geometry. Clipping produces watertight boundaries at the exact chunk edges.

### Zero-allocation inner loop

The single most important rule. For 15 M triangles × N candidate chunk cells
per triangle, the inner loop runs ~60–150 M times per district. Object
allocation inside this loop causes gigabytes of GC pressure.

Mitigation:
- Two scratch `Float32Array(21)` buffers (`A` and `B`, 7 vertices × 3 floats)
  are allocated **once** before the outer loop.
- The four clip planes alternate between A → B → A → B so the result always
  ends in `A` (four clips, even number of swaps).
- No `new THREE.Vector3()`, no array literals, no `.push()` inside the clip.

```js
const A = new Float32Array(21)   // pre-allocated outside all loops
const B = new Float32Array(21)

// inside triangle loop:
A[0]=x0; A[1]=y0; A[2]=z0; …
let nc = clipPolygonHalfPlane(A, 3, 0, cellMinX, true,  B)  // X ≥ minX
if (nc < 3) continue
nc     = clipPolygonHalfPlane(B, nc, 0, cellMaxX, false, A)  // X ≤ maxX
if (nc < 3) continue
nc     = clipPolygonHalfPlane(A, nc, 2, cellMinZ, true,  B)  // Z ≥ minZ
if (nc < 3) continue
nc     = clipPolygonHalfPlane(B, nc, 2, cellMaxZ, false, A)  // Z ≤ maxZ
if (nc < 3) continue
// result in A, nc vertices
```

### Boundary vertex snapping

When two clip planes produce a new vertex on an edge, the interpolated
floating-point value for the clip axis is replaced with the **exact** plane
float:

```js
out[n * 3 + axis] = edge   // hard-set, never interpolated
```

This prevents T-junction cracks across adjacent chunks that share the same
boundary edge. Without it, floating-point drift creates invisible seams
detectable at LOD transitions.

### Degenerate triangle rejection

After fan-triangulating the clipped polygon, each output triangle is checked
before being pushed to the bucket:

```js
function _isDegenerateTriangle(ax,ay,az, bx,by,bz, cx,cy,cz) {
  const e1x = bx-ax, e1y = by-ay, e1z = bz-az
  const e2x = cx-ax, e2y = cy-ay, e2z = cz-az
  const crx = e1y*e2z - e1z*e2y
  const cry = e1z*e2x - e1x*e2z
  const crz = e1x*e2y - e1y*e2x
  return (crx*crx + cry*cry + crz*crz) < 1e-10
}
```

Cross-product magnitude² < ε. Collinear triangles (two vertices on the same
boundary plane) silently discarded. No allocation — six scalar args.

### AABB pre-cull

Before clipping, compute the triangle's own AABB in XZ and translate it to
grid cell coordinates. Only iterate over cells the triangle's AABB overlaps.
Triangles fully within one cell iterate one cell. Triangles spanning N × M
cells iterate N × M cells — still correct for arbitrarily large triangles.
No artificial cell-count limit.

```js
const minCol = Math.floor((triMinX - originX) / chunkSize)
const maxCol = Math.ceil( (triMaxX - originX) / chunkSize) - 1
```

### NaN / Infinity filter

After all districts are merged into a bucket, a second pass rejects any
triangle containing a non-finite float. This catches NaN that can propagate
from interleaved accessor extraction (`DataView.getFloat32` on misaligned
stride) or from degenerate GLB geometry:

```js
function _filterNaNTriangles(src) { … }
```

### Per-triangle progress

Every 100,000 triangles the worker posts a progress message. This drives a
smoothly animating progress bar on the main thread without saturating the
`postMessage` channel:

```js
if (onProgress && t % 100_000 === 0) onProgress(t / triCount)
```

---

## 7. Chunk bucket data structure

Each chunk cell accumulates geometry across all districts as a
`{ data: Float32Array, count: number }` bucket. The `data` array starts at
`1024 * 9` floats and doubles on overflow:

```js
if (bucket.count + floatsNeeded > bucket.data.length) {
  const next = new Float32Array(Math.max(bucket.data.length * 2, bucket.count + floatsNeeded))
  next.set(bucket.data.subarray(0, bucket.count))
  bucket.data = next
}
```

Doubling strategy keeps total allocations O(log N). Empty buckets (zero count)
are filtered at the end of `sliceGeometry` and never added to `globalBuckets`.
This means open plazas and water bodies produce no output files.

---

## 8. Memory management for large scenes

### One district at a time

`parseGLB` + `sliceGeometry` are called in a `for` loop. Each iteration
completes before the next begins. A 180 MB district is parsed, sliced, and
then its `positions` and `indices` are explicitly nulled:

```js
positions = null
indices   = null
```

The garbage collector can reclaim the parsed buffers before the next district
is loaded. If all districts were merged first, peak memory would be 5 × 180 MB
= 900 MB before any clipping began.

### Streaming chunk export

After all districts are clipped, the export loop processes chunks one at a
time and deletes each bucket from `globalBuckets` immediately after building
the GLB:

```js
globalBuckets.delete(chunkId)   // allow GC before the next chunk
```

For a city with 200 chunks × 3 LODs, this caps live memory to roughly
`(1 largest chunk) + (already-built GLTF strings)` instead of all chunks
simultaneously.

### Transferable buffers

District `ArrayBuffer`s are transferred to the worker (not copied). After
transfer the main-thread reference is detached, halving memory use on the
transition.

---

## 9. meshoptimizer LOD pipeline

WASM module; must be awaited before first use:

```js
await MeshoptSimplifier.ready
await MeshoptEncoder.ready
```

### Per-chunk pipeline

For each chunk at each LOD level:

```
1. generatePositionRemap  → deduplicate vertices (position-only hash)
2. compact the remap      → dense [0, uniqueCount-1] index space
3. (LOD 1+) simplify      → reduce index count to targetRatio × original
4. reorderMesh            → optimise vertex cache (ACMR reduction)
                            + vertex fetch (reorder vertex buffer)
```

Step 1 uses `MeshoptSimplifier.generatePositionRemap` which internally
position-hashes every vertex. This turns the non-indexed 9-float-per-triangle
clipper output into a proper indexed mesh, eliminating duplicated boundary
vertices that Sutherland–Hodgman generates when multiple triangles share a
clipped edge.

Step 4 uses `MeshoptEncoder.reorderMesh` which returns a `remap[oldIdx] =
newIdx` array. A manual scatter loop reorders the vertex buffer:

```js
for (let old = 0; old < remap.length; old++) {
  const ni = remap[old]
  if (ni === UNUSED) continue
  finalPos[ni * 3    ] = compactPos[old * 3    ]
  // …
}
```

LOD 0 skips `simplify` entirely (ratio = 1.0). The three LOD levels:

| LOD | ratio | error threshold | typical triangle reduction |
|-----|-------|-----------------|---------------------------|
| 0   | 1.0   | 0               | — (deduplicate + sort only) |
| 1   | 0.25  | 0.01            | ≈ 75% |
| 2   | 0.06  | 0.05            | ≈ 94% |

---

## 10. Minimal GLTF exporter (no Three.js dependency in worker)

Three.js `GLTFExporter` cannot run in a Worker (requires DOM APIs). The worker
uses a 60-line self-contained GLTF builder.

### Structure

```
JSON chunk   — minimal valid glTF 2.0 document
BIN payload  — positions (Float32) + indices (Uint32), 4-byte aligned
```

The binary payload is embedded as a `data:application/octet-stream;base64,…`
URI directly inside the `buffers[0].uri` field. This makes each `.gltf` file
**self-contained** — no separate `.bin` sidecar. The tradeoff is ~33% size
overhead from base64 encoding, which Draco compression later removes.

### Chunked base64 encoding

`btoa(String.fromCharCode(...bytes))` throws a stack overflow for large arrays
due to the spread. Mitigated by processing 32 KB at a time:

```js
const CHUNK = 0x8000
for (let i = 0; i < bytes.length; i += CHUNK) {
  str += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
}
```

### POSITION accessor AABB

glTF spec requires `min`/`max` on every POSITION accessor. The exporter walks
every float and throws on any non-finite value before writing — catches
degenerate geometry that slipped past earlier filters instead of silently
writing a spec-violating file.

### 4-byte alignment

The index buffer must start at a 4-byte-aligned offset inside the binary
buffer. The exporter pads the gap with zeros:

```js
const idxPadded = (idxBytes + 3) & ~3
```

---

## 11. ZIP packaging (fflate)

`fflate.zipSync` compresses all GLTF strings + `manifest.json` synchronously
in the main thread after the worker finishes. Each GLTF string is
`TextEncoder`-encoded before passing to `zipSync`:

```js
const entries = {}
for (const chunk of chunks) {
  entries[chunk.gltfFilename] = new TextEncoder().encode(chunk.gltf)
}
entries['manifest.json'] = new TextEncoder().encode(JSON.stringify(mf, null, 2))
const zipped = zipSync(entries)
```

The ZIP blob is downloaded via a temporary object URL. The object URL is
revoked immediately after `.click()` to avoid memory leaks.

---

## 12. Manifest schema

```json
{
  "chunkSize": 64,
  "origin":    [0, 0],
  "chunks": [
    {
      "id":   "4_2",
      "col":  4,
      "row":  2,
      "aabb": {
        "min": [256.0, 0.0, 128.0],
        "max": [320.0, 48.3, 192.0]
      },
      "lods": [
        { "file": "chunk_4_2_lod0.gltf", "triCount": 48200 },
        { "file": "chunk_4_2_lod1.gltf", "triCount": 12050 },
        { "file": "chunk_4_2_lod2.gltf", "triCount":  2890 }
      ]
    }
  ]
}
```

**Key fields:**

- `chunkSize` — size of each cell in world units (same as the input slider value)
- `origin` — `[originX, originZ]` in world units (currently always `[0, 0]`)
- `id` — `"{col}_{row}"` string, unique key for the chunk
- `col`, `row` — integer grid coordinates; `worldMinX = origin[0] + col * chunkSize`
- `aabb` — computed from the LOD0 merged positions before simplification; covers all districts that contributed geometry to this cell; Y reflects actual geometry height, not the chunk cell height
- `lods[n].file` — relative filename, suitable for `fetch('chunks/' + file)`
- `lods[n].triCount` — index count / 3 after simplification; useful for density-based LOD selection at runtime

**Chunk that received no triangles** (open plaza, water) — absent from
`chunks` array entirely. Do not assume the array is dense.

**Grid bounds** — derive from the manifest, not from hard-coded district
sizes:

```js
const cols = Math.max(...chunks.map(c => c.col)) + 1
const rows = Math.max(...chunks.map(c => c.row)) + 1
```

---

## 13. XZ gizmo — translate and rotate

### Group pivot = centroid

Each district is loaded into a `THREE.Group`. The mesh inside the group is
shifted by `-centroid`:

```js
mesh.position.set(-cx, 0, -cz)
group.position.set(cx, 0, cz)   // or saved offset
```

So the group's **local origin = geometry centroid**. `group.rotation.y`
therefore rotates the district around its own visual center — not an arbitrary
corner.

### Two handle types

| Handle | Shape | Hit area | Cursor |
|--------|-------|----------|--------|
| Translate | inner torus (district colour) | flat disc r ≈ ringR × 1.4 | `grab` |
| Rotate    | outer torus (gold `#f0c040`) | flat annulus r ≈ ringR × 1.7 → 2.9 | `crosshair` |

Both are invisible `THREE.Mesh` children of the group. Raycasting uses
`.userData.dragMode` to distinguish them. A dead zone between the two hit areas
prevents misclicks at the boundary.

### Translate drag

Intersect the mouse ray with a horizontal `THREE.Plane` at the gizmo's Y level.
On `pointerdown`, record `dragOffset = hitPoint − group.position`. On
`pointermove`, `group.position.x/z = hitPoint − dragOffset`.

### Rotate drag

On `pointerdown`, record `startAngle = atan2(hit.z − pivot.z, hit.x − pivot.x)`
and `startRotation = group.rotation.y`.
On `pointermove`, compute `currentAngle` the same way, then:

```js
group.rotation.y = startRotation + (currentAngle − startAngle)
```

Rotating the angle reference around the same pivot removes the need for any
delta clamping or wrap-around handling.

### Pointer capture

```js
dom.setPointerCapture(e.pointerId)   // on pointerdown
dom.releasePointerCapture(e.pointerId)  // on pointerup
```

Keeps `pointermove` firing even when the cursor leaves the canvas mid-drag.
`OrbitControls.enabled = false` during drag; restored on `pointerup`.

---

## 14. Handling extremely large meshes — checklist

| Problem | Applied solution |
|---------|-----------------|
| 15 M tri parse blocks UI | Entire pipeline runs in a Web Worker |
| Parse + clip for 5 districts simultaneously | Process **one district at a time** in a `for` loop |
| 180 MB `Float32Array` lives too long | `positions = null` + `indices = null` immediately after clip pass |
| Bucket Map holds all geometry before export | `globalBuckets.delete(chunkId)` after each chunk is exported |
| Object allocation inside clipper inner loop | Pre-allocate two `Float32Array(21)` scratch buffers before the loop |
| Millions of duplicate boundary vertices | `generatePositionRemap` deduplication before LOD |
| Non-finite positions from interleaved accessors | `_filterNaNTriangles` pass before meshopt |
| Stack overflow in `btoa` for large buffers | 32 KB chunked `String.fromCharCode.apply` |
| ArrayBuffer copy on `postMessage` | List all buffers in the transfer array |
| WASM pre-bundler breakage | `optimizeDeps: { exclude: ['meshoptimizer'] }` |
| District geometry overflows a single GLB | Clip distributes naturally across many small chunk files |
| Progress bar frozen during clip | `onProgress` callback every 100 k triangles → `postMessage` |

---

## 15. Post-processing (outside the tool)

After downloading `chunks.zip`, apply Draco compression with
`@gltf-transform/cli`:

```bash
npm install -g @gltf-transform/cli

# Single file
gltf-transform draco chunk_4_2_lod0.gltf chunk_4_2_lod0.gltf --method edgebreaker

# Batch (bash)
for f in *.gltf; do gltf-transform draco "$f" "$f" --method edgebreaker; done
```

Draco achieves 10–20× additional compression on geometry-only files. The tool
deliberately excludes Draco because Draco encoding in-browser with WASM is
slow and adds ~1 MB of WASM to the bundle.

---

## 16. Extension points / known limits

| Limit | Notes |
|-------|-------|
| Browser memory cap ≈ 2 GB | Single very dense district (> 20 M tris) may OOM; split into sub-batches before importing |
| Base64 adds ~33% to file size | Removed by post-process Draco step |
| No Y-axis clipping | Chunks span the full height of the geometry; vertical LOD is not implemented |
| No materials / textures | Position-only pipeline; colour / normal data ignored on import |
| Vertex centroid ≠ area centroid | Rotation pivot uses average vertex position, which differs from the visual barycentric centre for sparse-but-large meshes |
| `zipSync` is synchronous | For > 500 MB of GLTF strings the main thread stalls briefly; `zip` (async fflate) would fix this |
| Chunk file format is `.gltf` (text + base64) | Change `buildMinimalGLTF` to GLB (binary container) to skip base64 overhead entirely |
