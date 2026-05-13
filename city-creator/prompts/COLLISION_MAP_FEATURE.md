# Collision Bitmap — Feature Specification for City Chunker
## Prompt for Claude Sonnet (CLI, high-effort)

This document is a self-contained implementation prompt. Read it fully before
writing any code. Every architectural decision is justified. Follow the
constraints in the existing codebase exactly.

---

## 0. Context recap

The City Chunker is a Vite + Vue 3 + Three.js r184 tool. All geometry work
runs in a Web Worker (`chunker.worker.js`). The worker already has every
triangle in world space after `sliceGeometry()` runs. The output is a ZIP
containing `.gltf` chunk files and a `manifest.json`.

The full architecture is described in `CITY_CHUNKER.md` in this repo. Read it
first if it exists. Key points relevant to this feature:

- Worker receives `{ type: 'start', districts, offsets, chunkSize, … }`
- Worker posts `{ type: 'done', manifest }` when finished
- Main thread zips everything with `fflate.zipSync` after `done`
- The existing `globalBuckets` Map holds `{ data: Float32Array, count }` of
  raw 9-float-per-triangle (x0y0z0 x1y1z1 x2y2z2) world-space triangles for
  every chunk cell, **before LOD simplification**. This is the input we reuse.

---

## 1. Architectural decision: CPU rasterisation, not GPU shader

**Rejected approach (original proposal):** add a WebGL render pass with a
top-down orthographic camera, a vertex shader that discards fragments outside
a Y-height slice, and read back pixels via `readPixels`.

**Why it is rejected:**

1. The worker has no WebGL context and cannot create one. Moving the render
   pass to the main thread would require serialising all bucket geometry back
   across the message boundary — contradicting the zero-copy design.
2. A GPU readback (`readPixels`) is slow and synchronous on the GPU timeline;
   for large bitmaps (3000×3000) it stalls the pipeline.
3. The worker already has every triangle in world space. CPU triangle
   rasterisation at a fixed Y slice is ~50 lines of code and produces an
   identical result with no GPU dependency.

**Chosen approach:** after `sliceGeometry()` finishes (all `globalBuckets`
are populated), add a `generateCollisionBitmap()` step inside the worker that:

1. Iterates every bucket.
2. For each triangle whose Y extent straddles `sampleHeight`, computes the
   2-D XZ cross-section polygon and rasterises it onto a single flat
   `Uint8Array` bitmap (1 byte per pixel during computation).
3. Packs the bitmap into a bitfield (`Uint8Array` where each byte holds 8
   pixels) for the `.bin` export.
4. Writes a raw 24-bit `.bmp` file for debug viewing.
5. Returns both buffers to the main thread via transferable `ArrayBuffer`s.

---

## 2. Coordinate system and sizing

```
pixelWidth  = ceil((worldMaxX - worldMinX) * precisionFactor)
pixelHeight = ceil((worldMaxZ - worldMinZ) * precisionFactor)

pixel (px, pz) corresponds to world rect:
  worldX ∈ [worldMinX + px / precisionFactor,
             worldMinX + (px+1) / precisionFactor]
  worldZ ∈ [worldMinZ + pz / precisionFactor,
             worldMinZ + (pz+1) / precisionFactor]
```

`worldMinX/Z` and `worldMaxX/Z` are derived from the chunk grid:

```js
worldMinX = originX                              // always 0 in current tool
worldMinZ = originZ
worldMaxX = originX + (maxCol + 1) * chunkSize
worldMaxZ = originZ + (maxRow + 1) * chunkSize
```

Derive `maxCol` and `maxRow` from the keys of `globalBuckets` (format
`"{col}_{row}"`).

At default `precisionFactor = 0.10` (1 pixel = 10 cm in a 1 unit = 1 m world):
a 300×300 world → 3000×3000 bitmap → 9 M pixels → 1.125 MB packed bitfield.
This is acceptable. Warn in the UI if `pixelWidth * pixelHeight > 16_000_000`.

---

## 3. Triangle → bitmap rasterisation algorithm

For each chunk bucket, iterate 9 floats at a time (one triangle):

```
x0 = data[i+0], y0 = data[i+1], z0 = data[i+2]
x1 = data[i+3], y1 = data[i+4], z1 = data[i+5]
x2 = data[i+6], y2 = data[i+7], z2 = data[i+8]
```

**Height slice test (the key step):**

The triangle intersects the horizontal plane Y = `sampleHeight` if:
```
min(y0, y1, y2) <= sampleHeight AND max(y0, y1, y2) >= sampleHeight
```

If the test passes, project the triangle onto XZ and rasterise it. Do NOT
attempt to compute the exact XZ cross-section polygon — projecting the full
triangle onto XZ is sufficient and produces a conservative (slightly larger)
footprint, which is correct for collision (false positives are safe, false
negatives are not). The difference is negligible at the precision used.

**XZ rasterisation (scanline):**

Convert the three XZ vertices to pixel coordinates:
```js
px0 = Math.floor((x0 - worldMinX) * precisionFactor)
pz0 = Math.floor((z0 - worldMinZ) * precisionFactor)
// … same for px1/pz1, px2/pz2
```

Clamp all pixel coords to `[0, pixelWidth-1]` / `[0, pixelHeight-1]`.

Use a standard 2-D scanline triangle fill. Sort vertices by pz (ascending).
For each scanline row `pz` from `pzMin` to `pzMax`, compute the x-span by
interpolating along the two active edges, then fill pixels
`bitmap[pz * pixelWidth + px] = 1` for `px` in `[xLeft, xRight]`.

**Important:** allocate the bitmap `Uint8Array(pixelWidth * pixelHeight)` once
before iterating any bucket. All buckets write into the same flat array — the
collision map is global, not per-chunk.

**Zero-allocation inner loop:** do not allocate inside the triangle loop. All
scanline state is scalar. The only allocation is the single bitmap array.

---

## 4. Bitfield packing (.bin format)

After rasterisation, pack the bitmap into a bitfield:

```js
const bitfieldSize = Math.ceil((pixelWidth * pixelHeight) / 8)
const bitfield = new Uint8Array(bitfieldSize)
for (let i = 0; i < pixelWidth * pixelHeight; i++) {
  if (bitmap[i]) {
    bitfield[i >> 3] |= (1 << (i & 7))   // LSB-first within each byte
  }
}
```

This is the `.bin` export file: `collision.bin`.

**Runtime usage pattern** (document in manifest, implement in consumer, NOT
in the chunker):

```js
// In the WebGL experience — inside the player movement loop:
function isColliding(worldX, worldZ) {
  const px = Math.floor((worldX - manifest.collisionMap.worldMinX)
                         * manifest.collisionMap.precisionFactor)
  const pz = Math.floor((worldZ - manifest.collisionMap.worldMinZ)
                         * manifest.collisionMap.precisionFactor)
  if (px < 0 || px >= manifest.collisionMap.pixelWidth) return false
  if (pz < 0 || pz >= manifest.collisionMap.pixelHeight) return false
  const idx = pz * manifest.collisionMap.pixelWidth + px
  return (bitfield[idx >> 3] & (1 << (idx & 7))) !== 0
}
```

---

## 5. BMP export (.bmp debug format)

Write a standard 24-bit uncompressed BMP. No external library needed.
BMP stores rows bottom-to-top; each row is padded to a 4-byte boundary.

```js
function buildBMP(bitmap, width, height) {
  const rowStride = (width * 3 + 3) & ~3  // 4-byte aligned row size
  const pixelDataSize = rowStride * height
  const fileSize = 54 + pixelDataSize      // 54 = file header + DIB header

  const buf = new ArrayBuffer(fileSize)
  const view = new DataView(buf)

  // File header (14 bytes)
  view.setUint16(0, 0x4D42, true)   // 'BM'
  view.setUint32(2, fileSize, true)
  view.setUint32(6, 0, true)        // reserved
  view.setUint32(10, 54, true)      // pixel data offset

  // DIB header — BITMAPINFOHEADER (40 bytes)
  view.setUint32(14, 40, true)      // header size
  view.setInt32(18, width, true)
  view.setInt32(22, height, true)   // positive = bottom-up
  view.setUint16(26, 1, true)       // colour planes
  view.setUint16(28, 24, true)      // bits per pixel
  view.setUint32(30, 0, true)       // BI_RGB (no compression)
  view.setUint32(34, pixelDataSize, true)
  view.setInt32(38, 2835, true)     // 72 DPI horizontal
  view.setInt32(42, 2835, true)     // 72 DPI vertical
  view.setUint32(46, 0, true)
  view.setUint32(50, 0, true)

  // Pixel data — BMP is bottom-to-top
  const bytes = new Uint8Array(buf)
  for (let row = 0; row < height; row++) {
    const bmpRow = height - 1 - row         // flip vertically
    const srcBase = row * width
    const dstBase = 54 + bmpRow * rowStride
    for (let col = 0; col < width; col++) {
      const val = bitmap[srcBase + col] ? 255 : 0
      bytes[dstBase + col * 3 + 0] = val    // B
      bytes[dstBase + col * 3 + 1] = val    // G
      bytes[dstBase + col * 3 + 2] = val    // R
    }
  }
  return buf
}
```

Export as `collision_debug.bmp` in the ZIP. For very large bitmaps
(> 8M pixels) this file can be >24 MB uncompressed — that is expected and
acceptable for a debug artifact. ZIP compression will reduce it significantly
(BMP of a sparse city is mostly zeros).

---

## 6. Worker message protocol changes

### New fields on the `start` message (main → worker)

```js
{
  type: 'start',
  // … existing fields unchanged …
  collisionMap: {
    enabled:         boolean,  // false → skip the entire feature
    sampleHeight:    number,   // default 0.30 (world units)
    precisionFactor: number,   // default 0.10 (pixels per world unit)
  }
}
```

### New `collision_done` message (worker → main)

Sent after `done` if `collisionMap.enabled`:

```js
{
  type: 'collision_done',
  bin:     ArrayBuffer,   // transferred — the packed bitfield
  bmp:     ArrayBuffer,   // transferred — the BMP debug image
  meta: {
    worldMinX:       number,
    worldMinZ:       number,
    worldMaxX:       number,
    worldMaxZ:       number,
    pixelWidth:      number,
    pixelHeight:     number,
    sampleHeight:    number,
    precisionFactor: number,
  }
}
```

Both `bin` and `bmp` ArrayBuffers are transferred (zero-copy):

```js
self.postMessage({ type: 'collision_done', bin, bmp, meta }, [bin, bmp])
```

### Progress reporting

During bitmap generation, post a progress message every 100k triangles
processed (reuse the same `onProgress` pattern used in the clip pass):

```js
{ type: 'progress', stage: 'collision', pct: number }  // 0.0–1.0
```

---

## 7. Manifest schema additions

Add a top-level `collisionMap` key to `manifest.json`:

```json
{
  "chunkSize": 64,
  "origin": [0, 0],
  "collisionMap": {
    "bin":            "collision.bin",
    "bmp":            "collision_debug.bmp",
    "worldMinX":      0.0,
    "worldMinZ":      0.0,
    "worldMaxX":      320.0,
    "worldMaxZ":      320.0,
    "pixelWidth":     3200,
    "pixelHeight":    3200,
    "sampleHeight":   0.30,
    "precisionFactor": 0.10
  },
  "chunks": [ … ]
}
```

If `collisionMap.enabled = false`, omit the `collisionMap` key entirely from
the manifest.

---

## 8. ZIP packaging changes (main thread)

In the main thread's `done` handler, the collision files arrive later via
`collision_done`. The zip must be deferred until both messages are received.

**Recommended approach:** collect the zip entries as they arrive, then trigger
`zipSync` only when all expected messages have been received.

```js
// In the Vue component
const pendingZipEntries = {}
let manifestObj = null
let collisionBinBuffer = null
let collisionBmpBuffer = null
let collisionMeta = null

worker.onmessage = (e) => {
  if (e.data.type === 'done') {
    manifestObj = e.data.manifest
    maybeZip()
  }
  if (e.data.type === 'collision_done') {
    collisionBinBuffer = e.data.bin
    collisionBmpBuffer = e.data.bmp
    collisionMeta = e.data.meta
    maybeZip()
  }
}

function maybeZip() {
  const needsCollision = settings.collisionMap.enabled
  if (!manifestObj) return
  if (needsCollision && (!collisionBinBuffer || !collisionBmpBuffer)) return
  // All parts ready — build zip
  // Inject collisionMeta into manifestObj before stringifying
  if (needsCollision) {
    manifestObj.collisionMap = {
      bin: 'collision.bin',
      bmp: 'collision_debug.bmp',
      ...collisionMeta,
    }
  }
  // … existing zipSync logic …
  if (needsCollision) {
    entries['collision.bin'] = new Uint8Array(collisionBinBuffer)
    entries['collision_debug.bmp'] = new Uint8Array(collisionBmpBuffer)
  }
}
```

---

## 9. Vue UI additions (settings panel)

Add a `Collision Map` section to the existing settings panel. Place it after
the LOD settings, before the Process button.

```vue
<!-- Inside the settings panel -->
<div class="settings-section">
  <h3>Collision Map</h3>

  <label class="toggle">
    <input type="checkbox" v-model="settings.collisionMap.enabled" />
    Generate collision map
  </label>

  <template v-if="settings.collisionMap.enabled">
    <label>
      Sample height (m)
      <input
        type="number" step="0.01" min="0" max="50"
        v-model.number="settings.collisionMap.sampleHeight"
      />
      <span class="hint">Default 0.30 — height in world units at which
        collision geometry is sampled.</span>
    </label>

    <label>
      Precision factor (px/m)
      <input
        type="number" step="0.01" min="0.01" max="2"
        v-model.number="settings.collisionMap.precisionFactor"
      />
      <span class="hint">Default 0.10 — pixels per world unit (1 m).
        0.10 = 10 cm/pixel. Higher = finer but larger file.</span>
    </label>

    <!-- Live size estimate -->
    <p class="size-estimate" v-if="collisionMapSizeEstimate">
      Estimated bitmap: {{ collisionMapSizeEstimate.w }} ×
      {{ collisionMapSizeEstimate.h }} px —
      .bin ≈ {{ collisionMapSizeEstimate.binKB }} KB
    </p>

    <p class="warning" v-if="collisionMapTooLarge">
      ⚠ Bitmap exceeds 16 Mpx — consider reducing precision factor.
    </p>
  </template>
</div>
```

**Computed properties needed:**

```js
const collisionMapSizeEstimate = computed(() => {
  // Requires knowing the world extent from loaded districts.
  // Use the bounding box of all district AABBs if available, else null.
  if (!worldBounds.value) return null
  const { minX, minZ, maxX, maxZ } = worldBounds.value
  const f = settings.value.collisionMap.precisionFactor
  const w = Math.ceil((maxX - minX) * f)
  const h = Math.ceil((maxZ - minZ) * f)
  const binKB = Math.ceil((w * h) / 8 / 1024)
  return { w, h, binKB }
})

const collisionMapTooLarge = computed(() => {
  const est = collisionMapSizeEstimate.value
  return est && est.w * est.h > 16_000_000
})
```

**Default settings:**

```js
settings.collisionMap = {
  enabled:         false,
  sampleHeight:    0.30,
  precisionFactor: 0.10,
}
```

---

## 10. Preview in the 3-D viewport (optional but recommended)

After processing, if the collision map was generated, allow toggling a
debug overlay in the viewport. This is a `THREE.Mesh` plane positioned at
`sampleHeight` Y, textured with the bitmap converted to a canvas texture.

Implementation sketch:
1. In the `collision_done` handler, decode the bitfield back to a `Uint8ClampedArray`
   RGBA canvas image (white = collision, transparent = free).
2. Create a `THREE.CanvasTexture` from it.
3. Create a `THREE.PlaneGeometry(worldWidth, worldDepth)` mesh at Y = `sampleHeight`,
   rotated -90° on X to lie flat.
4. Toggle visibility with a checkbox: `Show collision map`.

This plane should be at `renderOrder = 1` with `depthTest = false` so it draws
over existing geometry when enabled. Use a semi-transparent material
(`opacity: 0.5`, `transparent: true`).

Do NOT include this mesh in the exported ZIP. It is preview-only.

---

## 11. Worker implementation: where to insert the code

In `chunker.worker.js`, after the existing export loop completes and before
`postMessage({ type: 'done', manifest })`:

```js
// --- COLLISION MAP ---
if (collisionMapConfig.enabled) {
  postMessage({ type: 'progress', stage: 'collision', pct: 0 })

  const { bitmap, meta } = generateCollisionBitmap(
    globalBuckets,
    collisionMapConfig.sampleHeight,
    collisionMapConfig.precisionFactor,
    originX, originZ,
    maxCol, maxRow, chunkSize,
    (pct) => postMessage({ type: 'progress', stage: 'collision', pct })
  )

  const binBuffer  = packBitfield(bitmap, meta.pixelWidth, meta.pixelHeight)
  const bmpBuffer  = buildBMP(bitmap, meta.pixelWidth, meta.pixelHeight)

  postMessage(
    { type: 'collision_done', bin: binBuffer, bmp: bmpBuffer, meta },
    [binBuffer, bmpBuffer]
  )
}

postMessage({ type: 'done', manifest })
```

Note: `done` is posted AFTER `collision_done` so the main thread receives all
data before attempting to zip. Alternatively, swap the order — `done` first,
`collision_done` second — and use the `maybeZip` gate in section 8.

**The `generateCollisionBitmap` function signature:**

```js
function generateCollisionBitmap(
  globalBuckets,     // Map<string, { data: Float32Array, count: number }>
  sampleHeight,      // number — Y plane in world units
  precisionFactor,   // number — pixels per world unit
  originX, originZ,  // number — world origin
  maxCol, maxRow,    // number — grid extents derived from bucket keys
  chunkSize,         // number — world units per chunk cell
  onProgress,        // (pct: number) => void
) { … }
```

**Inside `generateCollisionBitmap`:**

```js
const worldMinX = originX
const worldMinZ = originZ
const worldMaxX = originX + (maxCol + 1) * chunkSize
const worldMaxZ = originZ + (maxRow + 1) * chunkSize
const pixelWidth  = Math.ceil((worldMaxX - worldMinX) * precisionFactor)
const pixelHeight = Math.ceil((worldMaxZ - worldMinZ) * precisionFactor)

const bitmap = new Uint8Array(pixelWidth * pixelHeight)  // single allocation

let totalTriangles = 0
for (const bucket of globalBuckets.values())
  totalTriangles += bucket.count / 9

let processed = 0

for (const bucket of globalBuckets.values()) {
  const { data, count } = bucket
  for (let i = 0; i < count; i += 9) {
    const y0 = data[i+1], y1 = data[i+4], y2 = data[i+7]
    const yMin = Math.min(y0, y1, y2)
    const yMax = Math.max(y0, y1, y2)

    if (yMin <= sampleHeight && yMax >= sampleHeight) {
      // Project to XZ pixel space and scanline-fill
      rasteriseTriangleXZ(
        data[i],   data[i+2],
        data[i+3], data[i+5],
        data[i+6], data[i+8],
        worldMinX, worldMinZ, precisionFactor,
        pixelWidth, pixelHeight, bitmap
      )
    }

    processed++
    if (processed % 100_000 === 0 && onProgress)
      onProgress(processed / totalTriangles)
  }
}

return {
  bitmap,
  meta: { worldMinX, worldMinZ, worldMaxX, worldMaxZ,
          pixelWidth, pixelHeight, sampleHeight, precisionFactor }
}
```

**Scanline rasteriser (zero allocation):**

```js
function rasteriseTriangleXZ(
  x0, z0, x1, z1, x2, z2,
  worldMinX, worldMinZ, precisionFactor,
  pixelWidth, pixelHeight, bitmap
) {
  // Convert to pixel coordinates
  let px0 = Math.floor((x0 - worldMinX) * precisionFactor)
  let pz0 = Math.floor((z0 - worldMinZ) * precisionFactor)
  let px1 = Math.floor((x1 - worldMinX) * precisionFactor)
  let pz1 = Math.floor((z1 - worldMinZ) * precisionFactor)
  let px2 = Math.floor((x2 - worldMinX) * precisionFactor)
  let pz2 = Math.floor((z2 - worldMinZ) * precisionFactor)

  // Sort by pz ascending (bubble sort — 3 elements)
  if (pz0 > pz1) { let t=px0;px0=px1;px1=t; t=pz0;pz0=pz1;pz1=t }
  if (pz1 > pz2) { let t=px1;px1=px2;px2=t; t=pz1;pz1=pz2;pz2=t }
  if (pz0 > pz1) { let t=px0;px0=px1;px1=t; t=pz0;pz0=pz1;pz1=t }

  const totalHeight = pz2 - pz0
  if (totalHeight === 0) return  // degenerate

  for (let pz = pz0; pz <= pz2; pz++) {
    if (pz < 0 || pz >= pixelHeight) continue

    const secondHalf = pz >= pz1
    const segHeight  = secondHalf ? (pz2 - pz1) : (pz1 - pz0)

    const alpha = (pz - pz0) / totalHeight
    const beta  = segHeight === 0 ? 0
                : secondHalf ? (pz - pz1) / segHeight
                             : (pz - pz0) / segHeight

    let xA = px0 + (px2 - px0) * alpha
    let xB = secondHalf
      ? px1 + (px2 - px1) * beta
      : px0 + (px1 - px0) * beta

    if (xA > xB) { let t = xA; xA = xB; xB = t }

    const xLeft  = Math.max(0, Math.floor(xA))
    const xRight = Math.min(pixelWidth - 1, Math.ceil(xB))

    for (let px = xLeft; px <= xRight; px++) {
      bitmap[pz * pixelWidth + px] = 1
    }
  }
}
```

---

## 12. Memory notes

- `bitmap` (`Uint8Array`, pixelWidth × pixelHeight bytes) is allocated once.
  For a 3000×3000 scene at precision 0.10 this is 9 MB. Acceptable.
- After `packBitfield` and `buildBMP` produce their `ArrayBuffer`s, null the
  intermediate `bitmap` array to allow GC before the zip step:
  ```js
  bitmap = null  // before postMessage
  ```
- Both `bin` and `bmp` buffers are **transferred** to the main thread
  (zero-copy). After transfer they are detached in the worker.

---

## 13. Files to create or modify

| File | Action |
|------|--------|
| `src/workers/chunker.worker.js` | Add `generateCollisionBitmap`, `rasteriseTriangleXZ`, `packBitfield`, `buildBMP` functions; call them after the export loop; handle `collisionMapConfig` from the start message |
| `src/components/CityChunker.vue` (or equivalent) | Add collision map settings UI (section 9); add `maybeZip` logic (section 8); handle `collision_done` message; add 3-D viewport preview plane (section 10); pass `collisionMap` config in the worker `start` message |
| `manifest.json` (generated at runtime) | Add `collisionMap` block (section 7) — no file to change, just update the manifest object construction |

No new npm packages are required.

---

## 14. Testing checklist

After implementation, verify:

- [ ] `collision.bin` is present in the ZIP when enabled, absent when disabled
- [ ] `collision_debug.bmp` opens correctly in an image viewer and shows
      white footprints of buildings
- [ ] `manifest.json` contains the `collisionMap` block with correct extents
- [ ] `precisionFactor` and `sampleHeight` changes produce visibly different
      BMP outputs (higher factor = larger/finer bitmap)
- [ ] Setting `sampleHeight` above all geometry produces an all-black BMP
      (no collision)
- [ ] Setting `sampleHeight` to 0 or below ground produces a BMP with
      ground-plane footprints
- [ ] Very large scenes (> 16 Mpx warning threshold) show the UI warning
- [ ] The viewport preview plane toggles on/off and aligns with the 3-D scene
- [ ] Memory: no OOM for a 5-district full scene at default precision
- [ ] Progress bar advances during the `collision` stage

---

## 15. Runtime consumer reference (for the WebGL experience)

This is documentation for consumers of the export, NOT code to add to the
chunker.

```js
// Load collision map
const manifest = await fetch('chunks/manifest.json').then(r => r.json())
const cm = manifest.collisionMap

const binData = await fetch('chunks/' + cm.bin)
  .then(r => r.arrayBuffer())
const bitfield = new Uint8Array(binData)

// Query at a world position
function hasCollision(worldX, worldZ) {
  const px = Math.floor((worldX - cm.worldMinX) * cm.precisionFactor)
  const pz = Math.floor((worldZ - cm.worldMinZ) * cm.precisionFactor)
  if (px < 0 || px >= cm.pixelWidth || pz < 0 || pz >= cm.pixelHeight)
    return false
  const idx = pz * cm.pixelWidth + px
  return (bitfield[idx >> 3] & (1 << (idx & 7))) !== 0
}

// In the player movement loop (call BEFORE applying transform)
function tryMove(player, dx, dz) {
  const nx = player.worldX + dx
  const nz = player.worldZ + dz
  if (!hasCollision(nx, nz)) {
    player.worldX = nx
    player.worldZ = nz
  }
  // Optional: try axis-separated sliding (try X only, then Z only)
  // to avoid stopping completely at glancing angles
}
```

For smoother collision response (sliding along walls rather than stopping),
try each axis independently before giving up:

```js
function tryMoveWithSlide(player, dx, dz) {
  if (!hasCollision(player.worldX + dx, player.worldZ + dz)) {
    player.worldX += dx; player.worldZ += dz
  } else if (!hasCollision(player.worldX + dx, player.worldZ)) {
    player.worldX += dx
  } else if (!hasCollision(player.worldX, player.worldZ + dz)) {
    player.worldZ += dz
  }
  // else: fully blocked, no movement
}
```
