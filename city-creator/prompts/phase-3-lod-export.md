# Phase 3 — LOD Pipeline + Export UI + Manifest

Read CLAUDE.md before writing any code.

## Task
Add the full 3-level LOD pipeline, the export button with live progress UI, and manifest generation. Phase 2 worker must be passing validation before starting this.

## Deliverables

### 1. Update chunker.worker.js — LOD pass

The Phase 2 worker runs LOD0 only. Extend to run all 3 LODs per chunk.

LOD ratios and errors come from the `start` message config:
```js
lodRatios: [1.0, 0.25, 0.06]
lodErrors:  [0,   0.01, 0.05]
```

For LOD0, skip `simplifyMesh` (ratio is 1.0) — only run `optimizeVertexCache` + `optimizeVertexFetch`. This avoids a no-op simplify call on potentially 15M tris.

Progress granularity for the LOD pass:
```js
// Before each LOD per chunk:
postMessage({ type: 'progress', stage: 'simplify', chunk: chunkId, lod: lodIndex, pct: done / total })
// After export of each LOD:
postMessage({ type: 'chunk_done', chunkId, lod: lodIndex, buffer: glbBuffer, triCount })
```

Include `triCount` in `chunk_done` so the manifest can record it without re-parsing the GLB.

### 2. Update src/lib/manifest.js

```js
/**
 * @param {Map<string, { aabb, lods: {file, triCount}[] }>} chunkMeta
 * @param {number} chunkSize
 * @param {[number, number]} origin
 * @returns {Object} manifest object ready for JSON.stringify
 */
export function buildManifest(chunkMeta, chunkSize, origin) {}
```

AABB per chunk: computed from the raw (LOD0) position array — min/max x,y,z across all vertices. Compute during the bucket concatenation step and pass through to manifest builder.

### 3. ProgressPanel.vue — full implementation

Replace the Phase 1 stub with a complete component:

```
┌─────────────────────────────────────┐
│ District 1 — clipping       ███░░ 60% │
│ District 2 — merging        █░░░░ 20% │
│                                       │
│ Chunks exported: 12 / 48              │
│ LOD0 ████████████░░░░ 24/48          │
│ LOD1 ████░░░░░░░░░░░░  8/48          │
│ LOD2 ██░░░░░░░░░░░░░░  4/48          │
└─────────────────────────────────────┘
```

Props:
```js
props: {
  districtProgress: Array,   // [{ name, stage, pct }]
  lodProgress: Array,        // [{ lod, done, total }]
  isRunning: Boolean
}
```

Use CSS transitions on progress bar widths (`transition: width 0.15s linear`). No external animation library.

### 4. Export button + download logic in useChunker.js

On `done` message from worker:

```js
// 1. All chunk Blob URLs already created on chunk_done events
// 2. Trigger manifest download
const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' })
triggerDownload(URL.createObjectURL(manifestBlob), 'manifest.json')

// 3. Trigger all GLB downloads in sequence (avoid browser blocking)
for (const chunk of chunks.value) {
  await sleep(50)
  triggerDownload(chunk.url, chunk.filename)
}

function triggerDownload(url, filename) {
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
}
```

Expose a `cancel()` that calls `worker.terminate()` and revokes all pending Blob URLs.

### 5. ChunkConfig.vue — add LOD controls

Extend the Phase 1 component with collapsible "Advanced" section:
- LOD1 simplification ratio (default `0.25`, range 0.05–0.5, step 0.05)
- LOD2 simplification ratio (default `0.06`, range 0.01–0.2, step 0.01)
- LOD1 error threshold (default `0.01`)
- LOD2 error threshold (default `0.05`)
- Checkbox: "Skip LOD export, preview only" — if checked, worker only runs LOD0 and skips file export (useful for fast iteration)

### 6. PreviewCanvas.vue — chunk density heatmap (optional but high value)

After chunking is complete, color the chunk AABB wireframes by LOD0 tri count:
- Low density → green
- Medium → amber  
- High → red

Use a simple linear interpolation across the min/max tri counts in the manifest. This lets the artist immediately see where geometry is concentrated.

## Testing checklist
- [ ] Export a real district GLB, verify output GLBs open in a viewer (Babylon.js sandbox or gltf.report)
- [ ] Confirm LOD1 file is ~4× smaller than LOD0, LOD2 ~16×
- [ ] manifest.json chunk count matches expected grid cells for the given chunk size
- [ ] No T-junction cracks visible when all LOD0 chunks are assembled side by side in a viewer
- [ ] Cancel button terminates worker and cleans up Blob URLs
