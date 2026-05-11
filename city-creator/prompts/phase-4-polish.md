# Phase 4 — Polish, Edge Cases, Performance

Read CLAUDE.md before writing any code.

## Task
Harden the tool for real production district files. Fix known edge cases, tune performance, improve UX. Only do this phase after Phase 3 produces correct output on real geometry.

## Deliverables

### 1. Clipper edge cases

**Degenerate triangles after clipping**: A clipped triangle can produce near-zero area if two vertices land on the boundary plane. Add a degenerate check before pushing to bucket:
```js
// Cross product of two edges, check magnitude > epsilon
function isDegenerate(v0, v1, v2, eps = 1e-10) {
  // (v1-v0) × (v2-v0) magnitude squared < eps
}
```
Skip degenerate triangles silently — do not push to bucket.

**Very large triangles**: A single triangle spanning multiple chunk cells is valid — the AABB-based cell iteration handles it. Confirm there is no artificial cell-count limit in the inner loop.

**Empty buckets**: Some chunk cells will receive zero triangles (open plazas, water, etc.). These should not appear in the manifest or produce zero-byte GLB files. Filter them out in the worker after clipping is done.

### 2. Memory pressure

For very dense districts (15M poly, ~180MB of float data), the bucket Map can grow large before export begins. Add a flush strategy:

If total bytes across all buckets exceeds a threshold (e.g. 512MB), immediately export all complete chunks (those whose bucket arrays are final — i.e. all districts have been processed... but we're mid-loop). 

Actually: switch to a **streaming export** approach for memory safety:
- After processing EACH district, mark which chunk cells have received data
- After ALL districts are processed, export chunks one at a time, freeing each bucket array after the GLB is built and transferred
- Use `bucket.length = 0` + `bucket = null` after transfer to allow GC

### 3. GLB parser robustness

The minimal GLB parser from Phase 2 must handle:
- Multiple meshes/primitives per GLB — merge all POSITION accessors
- Node transform hierarchy — apply parent transforms when extracting vertex positions
- Both `SCALAR` index accessors (UINT16 and UINT32)
- Meshes with no index buffer (non-indexed)
- Skip any primitive that is not `mode: 4` (TRIANGLES)

If parsing fails on a district, post `{ type: 'error', message, district: i }` and continue with remaining districts rather than aborting.

### 4. Progress accuracy

Current progress reporting uses `pct: 0` and `pct: 1` per stage (binary). Improve:

For the clip stage, report actual triangle progress every 100k triangles:
```js
if (triIndex % 100_000 === 0) {
  postMessage({ type: 'progress', stage: 'clip', district: i, pct: triIndex / totalTris })
}
```

This makes the clip progress bar animate smoothly for large districts.

### 5. UI polish

**District reordering**: Allow drag-to-reorder districts in the DropZone list. Order affects processing order but not output correctness. Use native HTML5 drag API, no library.

**Chunk size validation**: Warn (don't block) if chunk size doesn't divide evenly into the city's detected extent. Show: "City is 312×298 units. At chunk size 64, boundary chunks will be partial."

**Export summary**: After export completes, show a summary panel:
```
Export complete
  48 chunks exported
  LOD0: 47.2MB total
  LOD1: 11.8MB total  
  LOD2: 2.9MB total
  Processing time: 1m 23s
```

**Error display**: If a district fails to parse, show it in the district list with a red indicator and the error message. Don't hide errors in the console.

### 6. Vite config

Ensure the worker bundle is correct:
```js
// vite.config.js
export default {
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['meshoptimizer']  // WASM — don't pre-bundle
  }
}
```

Also set `build.target: 'esnext'` — this tool is internal, no need for legacy browser support.

### 7. README.md

Write a concise README:
- What it does (2 sentences)
- Setup: `npm install` + `npm run dev`
- Usage: import districts → set chunk size → export → run Draco externally
- Draco post-processing command using `gltf-transform`:
  ```bash
  npm install -g @gltf-transform/cli
  gltf-transform draco chunk_4_2_lod0.glb chunk_4_2_lod0.glb --method edgebreaker
  # or batch:
  for f in *.glb; do gltf-transform draco "$f" "$f"; done
  ```
- Manifest format (brief)
- Known limitations: browser memory cap ~2GB, very dense districts may need chunking into sub-batches
