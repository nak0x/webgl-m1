# City Chunks System

A dynamic, LOD-based streaming architecture for rendering large procedurally-generated cities. This document describes how chunks are generated, loaded, cached, and rendered in real-time.

## Quick Overview

The city is divided into **64×64 world-space blocks** called **chunks**. Each chunk:
- Has 3 LODs (levels of detail) with decreasing geometry complexity
- Is stored as a position-only gltf file (no materials, normals, or data)
- Is loaded on-demand based on player proximity
- Is cached in RAM with LRU eviction to manage memory

### Key Components

| Component | Purpose |
|-----------|---------|
| **city-chunker** | Build tool: converts district GLBs into chunk LODs |
| **CityChunkManager** | Runtime: loads/unloads chunks based on camera position |
| **CityConfig.js** | Constants: chunk size, LOD distances, spawn point |
| **manifest.json** | Metadata: list of all chunks, their LODs, triangle counts |

---

## Architecture

### Coordinate System

The world is divided into a regular grid:

```
         Z (rows)
         ↓
      ┌──────┬─────┬─────┐
      │      │     │     │
→ X   │ -1,0 │ 0,0 │ 1,0 │
(cols)│      │     │     │
      ├──────┼─────┼─────┤
      │      │ 0,-1│     │
      │      │     │     │
      ├──────┼─────┼─────┤
      │      │     │     │
      │      │     │     │
      └──────┴─────┴─────┘
```

- **Chunk size**: 64 units (XZ plane)
- **Origin**: `[0, 0]` (chunk `0_0` spans X: 0-64, Z: 0-64)
- **Chunk ID**: `"{col}_{row}"` (e.g., `"2_-3"` = column 2, row -3)

#### Converting World ↔ Chunk Coordinates

```js
// World position to chunk grid
const { col, row } = worldToChunk(playerX, playerZ)
// col = Math.floor((playerX - 0) / 64)
// row = Math.floor((playerZ - 0) / 64)

// Chunk corner in world space
const { x, z } = chunkCorner(col, row)
// x = 0 + col * 64
// z = 0 + row * 64

// Absolute world position from chunk + local offset
const worldPos = cityPos(col, row, localX, localZ, height)
// (0 + col*64 + localX, height, 0 + row*64 + localZ)
```

---

## Generation Pipeline (city-chunker)

The **city-chunker** is a standalone Vue + Web Worker app that converts raw city geometry (district GLBs) into optimized, chunked LOD files.

### Workflow

```
Input: District GLB files
    ↓
[1] Parse GLB → positions + indices (with scene hierarchy flattening)
    ↓
[2] Apply placement transform (position, rotation per district)
    ↓
[3] Clip geometry to chunk boundaries (Sutherland-Hodgman)
    ↓
[4] Accumulate per-chunk triangles in "buckets"
    ↓
[5] For each chunk → generate LOD0, LOD1, LOD2 via simplification
    ↓
[6] Build manifest.json (metadata for loader)
    ↓
Output: chunks.zip with:
  - chunk_COL_ROW_lodN.gltf files
  - manifest.json
  - collision.bin (optional)
  - collision_debug.bmp (optional)
```

### Chunker Configuration

```js
{
  chunkSize: 64,        // Units per chunk (must match runtime)
  lodRatios: [1.0, 0.25, 0.06],  // Simplification targets (100%, 25%, 6% of LOD0)
  lodErrors: [0, 0.01, 0.05],    // Max error tolerance per LOD
  previewOnly: false,            // Skip GLTF export if true
  collisionMap: {                // Optional collision bitmap
    enabled: false,
    sampleHeight: 0.30,          // Sample Y at this height
    precisionFactor: 0.10        // Pixels per world unit
  }
}
```

### Generation Steps

#### Step 1: GLB Parsing (chunker.worker.js:64–196)

The worker parses each input GLB to extract positions and indices:

- **Scene hierarchy traversal**: respects node transforms (matrix / TRS decomposition)
- **Multi-primitive support**: merges all meshes in the scene
- **World-space transformation**: applies each node's world matrix to vertices
- **Degenerate filtering**: removes zero-area triangles

```js
const { positions, indices } = parseGLB(buffer)
// positions: Float32Array, shape [vertexCount * 3]
// indices: Uint32Array (or null if non-indexed)
```

**Key invariant**: All output is in world space. Node transforms are baked into vertex positions; only position/index data survives.

#### Step 2: Placement Transform (chunker.worker.js:500–528)

Each district can be placed, rotated, and offset:

```js
const offset = { x: 100, z: -50, angle: Math.PI / 4 }
// Rotate around centroid, translate centroid to world position
```

This happens **in-memory** before clipping, so geometry is placed exactly where it should appear at runtime.

#### Step 3: Geometry Clipping (chunker.worker.js:532–542)

**Sutherland-Hodgman half-plane clipping** slices geometry against axis-aligned planes at chunk boundaries:

```js
const districtBuckets = sliceGeometry(
  positions, indices, 
  chunkSize = 64,
  originX = 0, originZ = 0,
  onProgress
)
// Returns Map<chunkId, Float32Array[]>
// Each value is an array of non-indexed triangle arrays
```

**Clipper details** (clipper.js:67–158):

- **Triangle AABB culling**: skips triangles far from the chunk
- **4 half-plane clips**: X min/max, Z min/max per chunk
- **Boundary snapping**: cut vertices have their clip-axis component set to **exactly** the edge coordinate (prevents T-junction cracks)
- **No allocation in loops**: re-uses scratch buffers `A` and `B` (7 verts × 3 floats each)
- **Fan triangulation**: output is non-indexed (3N floats per triangle)

Result: triangles spanning chunk boundaries are split; all output lives in a single chunk.

#### Step 4: Per-Chunk Simplification (chunker.worker.js:586–644)

For each chunk, generate 3 LODs:

```
LOD0: Full geometry (ratio=1.0)
  ↓ (apply meshopt simplify)
LOD1: 25% of LOD0 vertices (ratio=0.25, error=0.01)
  ↓ (apply meshopt simplify)
LOD2: 6% of LOD0 vertices (ratio=0.06, error=0.05)
```

- **Simplification library**: [meshopt](https://github.com/zeux/meshoptimizer) (WebAssembly)
- **Error metric**: bounds maximum vertex displacement
- **Cache optimization**: meshopt also reorders vertices/indices for GPU fetch efficiency

```js
const { positions, indices } = simplifyAndOptimize(
  mergedPositions,
  ratio = 0.25,      // target 25% of vertices
  error = 0.01       // max 0.01 unit displacement
)
```

#### Step 5: gltf Builder (chunker.worker.js:212–282)

Each LOD is saved as a minimal self-contained **position-only glTF**:

```json
{
  "asset": { "version": "2.0" },
  "scene": 0,
  "scenes": [{ "nodes": [0] }],
  "nodes": [{ "mesh": 0 }],
  "meshes": [{
    "primitives": [{
      "attributes": { "POSITION": 0 },
      "indices": 1,
      "mode": 4
    }]
  }],
  "accessors": [
    { "bufferView": 0, "componentType": 5126, "type": "VEC3", ... },
    { "bufferView": 1, "componentType": 5125, "type": "SCALAR", ... }
  ],
  "bufferViews": [
    { "buffer": 0, "byteOffset": 0, "target": 34962 },
    { "buffer": 0, "byteOffset": 12*vertCount, "target": 34963 }
  ],
  "buffers": [{
    "uri": "data:application/octet-stream;base64,..." 
  }]
}
```

**Why position-only?**
- Dramatically smaller file size (~3× smaller than with normals)
- Normals are computed at load-time (`computeVertexNormals`)
- Materials are applied uniformly at runtime

#### Step 6: Manifest Generation (lib/manifest.js)

The **manifest.json** is the loader's guide:

```json
{
  "chunkSize": 64,
  "origin": [0, 0],
  "chunks": [
    {
      "id": "0_0",
      "col": 0,
      "row": 0,
      "aabb": {
        "min": [0, -1.5, 0],
        "max": [64, 8.2, 64]
      },
      "lods": [
        { "file": "chunk_0_0_lod0.gltf", "triCount": 1024 },
        { "file": "chunk_0_0_lod1.gltf", "triCount": 256 },
        { "file": "chunk_0_0_lod2.gltf", "triCount": 64 }
      ]
    },
    ...
  ]
}
```

Each entry:
- Encodes chunk position (`col`, `row`)
- Lists all LOD files and their triangle counts
- Stores axis-aligned bounding box (used for debug visualization)

#### Step 7: Collision Bitmap (Optional)

If enabled, generates an occupancy map at a fixed Y height:

```js
const { bitmap, meta } = generateCollisionBitmap(
  globalBuckets,
  sampleHeight = 0.30,     // Sample at Y=0.30 (chest height)
  precisionFactor = 0.10,  // 10 pixels per world unit
  ...
)
```

**Rasterization** (chunker.worker.js:316–361):
- Triangle mesh is rasterized to a 2D bitmap at the sample height
- Each pixel = solid walkable surface at that XZ position
- Output: `.bin` bitfield + `.bmp` for visual debug

---

## Loading System (CityChunkManager)

**CityChunkManager** lives on the GPU and manages chunk streaming at runtime.

### Initialization

```js
const chunkManager = new CityChunkManager(scene, material)
await chunkManager.init()  // Fetch manifest.json
```

### Update Loop

Called every frame with camera position:

```js
// In CityWorld.update():
const { x, z } = camera.instance.position
chunkManager.update(x, z)  // Triggers load/unload logic
```

### LOD Ring System

Chunks are loaded based on **Chebyshev ring distance** (max of X and Z distance):

```js
const ring = Math.max(
  Math.abs(chunk.col - playerCol),
  Math.abs(chunk.row - playerRow)
)

// LOD assignment:
// Ring 0, 1 → LOD 0 (full detail, closest chunks)
// Ring 2    → LOD 1 (25% geometry)
// Ring 3    → LOD 2 (6% geometry)
// Ring 4+   → Unload
```

**Visual**:
```
         LOD0   LOD0   LOD0
        ┌──────────────────┐
        │  ┌────────────┐  │
LOD0    │  │   LOD0     │  │
        │  │ ┌────────┐ │  │  LOD1
        │  │ │ LOD0   │ │  │
LOD1    │  │ │┌──────┐│ │  │
        │  │ ││ LOD0 ││ │  │
        │  │ │└──────┘│ │  │
        │  │ │   ▲    │ │  │
        │  │ │(player)│ │  │
        │  │ └────────┘ │  │
        │  └────────────┘  │
        └──────────────────┘
             LOD2, LOD2
```

### Load Queueing & Priority

When the player moves to a new chunk:

1. **Visibility update** (CityChunkManager:56–93): Calculate desired LOD for each in-range chunk
2. **Queue sort** (CityChunkManager:88–92): Sort by Chebyshev distance (closest first)
3. **Rate-limited fetch** (CityChunkManager:95–100): Load up to `MAX_CONCURRENT=3` chunks in parallel
4. **Atomic LOD swap** (CityChunkManager:159–164): Once loaded, replace old mesh with new one

```js
// Queue entry
{ chunkId: "2_-3", lod: 1, priority: 2 }
// priority = ring distance (used for sort order)
```

---

## Caching & Memory Management

### Cache Structure

```js
// Cache: chunkId_lodN → { group: THREE.Group, lastUsed: timestamp }
this._cache = new Map()   // In-RAM cache (off-scene geometry)
this._active = new Map()  // Currently visible chunks (in scene)
```

### Loading Flow

When a chunk is requested:

```js
_loadChunk(chunkId, lod) {
  const key = this._cacheKey(chunkId, lod)
  
  // 1. Check if already loading
  if (this._loading.has(key)) return
  
  // 2. Check RAM cache (instant)
  if (this._cache.has(key)) {
    entry.lastUsed = Date.now()
    this._addToScene(chunkId, lod, entry.group)
    return
  }
  
  // 3. Fetch from network
  fetch(CHUNK_DIR + file)
    .then(r => r.arrayBuffer())
    .then(buf => this._loader.parse(buf, CHUNK_DIR, ...))
    .then(gltf => {
      gltf.scene.traverse(child => {
        if (!child.isMesh) return
        child.geometry.computeVertexNormals()  // Required for shading
        child.material = this._material         // Shared material
        child.castShadow = true
        child.receiveShadow = true
        child.frustumCulled = true
      })
      
      this._evictIfNeeded()  // LRU eviction before caching
      this._cache.set(key, { group: gltf.scene, lastUsed: Date.now() })
      
      // Add to scene if still desired
      if (this._isDesired(chunkId, lod)) {
        this._addToScene(chunkId, lod, gltf.scene)
      }
    })
}
```

### LRU Eviction

When the cache exceeds `MAX_CACHE=200` entries:

```js
_evictIfNeeded() {
  if (this._cache.size < MAX_CACHE) return
  
  // Find oldest non-active entry
  const activeKeys = new Set()
  for (const [id, { lod }] of this._active) {
    activeKeys.add(this._cacheKey(id, lod))
  }
  
  let oldest = null, oldestTime = Infinity
  for (const [key, entry] of this._cache) {
    if (activeKeys.has(key)) continue  // Skip active meshes
    if (entry.lastUsed < oldestTime) {
      oldestTime = entry.lastUsed
      oldest = key
    }
  }
  
  if (oldest) {
    // Dispose geometry (dispose indices + vertices)
    const { group } = this._cache.get(oldest)
    group.traverse(c => { if (c.isMesh) c.geometry?.dispose() })
    this._cache.delete(oldest)
  }
}
```

### Atomic LOD Swaps

When a new LOD is ready for a chunk already in the scene:

```js
_addToScene(chunkId, lod, group) {
  const old = this._active.get(chunkId)
  if (old) this._scene.remove(old.group)  // Remove old LOD
  this._scene.add(group)                   // Add new LOD
  this._active.set(chunkId, { group, lod })
}
```

**No flicker** because:
- Old mesh stays visible until new one is ready
- Swap is atomic (one is removed, then the other is added)
- Both are in the same position

---

## Integration with CityWorld

### Initialization (CityWorld:33–40)

```js
async _setup() {
  this._setupLights()
  this._setupFloor()
  this._setupFps()
  this._setupDebug()
  this._loadCitySky()
  this._setupChunks()  // ← Async, fire-and-forget
}

async _setupChunks() {
  this._chunks = new CityChunkManager(this.scene, this.experience.renderProfile.material)
  try {
    await this._chunks.init()  // Load manifest
    this._chunks.update(SPAWN.x, SPAWN.z)  // Initial load around spawn
  } catch (err) {
    console.error('[CityWorld] manifest load failed:', err)
  }
}
```

### Per-Frame Update (CityWorld:246–254)

```js
update() {
  this._fps?.update(this.experience.time.delta)
  this._crosshair?.update()
  
  if (this._chunks) {
    const { x, z } = this.camera.instance.position
    this._chunks.update(x, z)  // ← Every frame, cheap if no movement
  }
}
```

### Material Sharing

All chunk meshes use a **single shared material** (renderProfile.material):

```js
const chunkManager = new CityChunkManager(scene, sharedMaterial)

// At load time:
gltf.scene.traverse(child => {
  if (!child.isMesh) return
  child.material = sharedMaterial  // All chunks → same material
})
```

**Benefit**: material uniforms (color, roughness, etc.) affect all chunks globally.

### Cleanup (CityWorld:258–271)

```js
dispose() {
  // ... other cleanup ...
  this._chunks?.dispose()  // Clears cache, removes active meshes
}

// CityChunkManager.dispose():
dispose() {
  for (const { group } of this._active.values()) {
    this._scene.remove(group)
  }
  for (const { group } of this._cache.values()) {
    group.traverse(c => { if (c.isMesh) c.geometry?.dispose() })
  }
  this._active.clear()
  this._cache.clear()
  this._loading.clear()
  this._queue = []
  this._inFlight = 0
}
```

---

## File Organization

```
WebGL-M1 (main project)
├── app/utils/three/world/city/
│   ├── CityChunkManager.js        ← Runtime loader
│   ├── CityWorld.js               ← Scene orchestrator
│   └── CityConfig.js              ← Constants + coord utilities
│
city-creator/
├── city-chunker/                  ← Standalone Vue app
│   ├── src/
│   │   ├── App.vue                ← UI
│   │   ├── composables/
│   │   │   └── useChunker.js      ← State + orchestration
│   │   ├── components/
│   │   │   ├── DropZone.vue
│   │   │   ├── ChunkConfig.vue
│   │   │   ├── PreviewCanvas.vue
│   │   │   └── ProgressPanel.vue
│   │   ├── lib/
│   │   │   ├── clipper.js         ← Sutherland-Hodgman
│   │   │   ├── meshopt.js         ← Simplification wrapper
│   │   │   └── manifest.js        ← Metadata builder
│   │   └── workers/
│   │       └── chunker.worker.js  ← Main pipeline (Web Worker)
│   └── package.json
│
├── manifest.json                  ← Generated metadata
├── chunks/                        ← Generated gltf files
└── prompts/                       ← Multi-phase generation docs
```

---

## Performance Considerations

### Memory Budget

- **Per chunk LOD**: ~2–20 KB (gltf format) on disk
- **In RAM (cached)**: Depends on triangle count (typically 100 KB – 1 MB per LOD)
- **Cache limit**: 200 entries = ~50–200 MB depending on geometry density
- **Active (scene)**: 9–25 chunks typically (varies with FOV)

### Load Times

| Step | Time | Notes |
|------|------|-------|
| Fetch 64 KB gltf | 5–50 ms | Network-dependent |
| Parse gltf | 1–5 ms | GLTFLoader |
| Compute normals | 5–15 ms | GPU buffer operation |
| Add to scene | <1 ms | Trivial |

**Total**: 15–70 ms per chunk (with 3 concurrent loads, hidden by other rendering)

### Optimization Tips

1. **Reduce LOD ratios** if detail pops are noticeable:
   ```js
   lodRatios: [1.0, 0.35, 0.10]  // More aggressive simplification
   ```

2. **Increase error tolerance** to speed up simplification:
   ```js
   lodErrors: [0, 0.02, 0.10]  // Slightly looser constraints
   ```

3. **Tune cache size** based on available RAM:
   ```js
   const MAX_CACHE = 150  // Reduce if memory-constrained
   ```

4. **Adjust ring distances** to avoid thrashing:
   ```js
   // Current: ring 0,1→LOD0, 2→LOD1, 3→LOD2, 4+→unload
   // Tighter: remove ring 1 at LOD0 to reduce active mesh count
   ```

5. **Profile collision bitmap** if slow (optional feature):
   - Rasterization is O(triangle count) — disable if not needed
   - Sample height and precision factor trade off accuracy vs. speed

---

## Debugging

### Enable visual overlays (add `#debug` to URL)

```
http://localhost:3000/#debug
```

Then open lil-gui and navigate to **City** folder:

- **Sky & Fog**: adjust atmosphere
- **Lights**: tweak sun position, intensity, shadow map resolution
- **Export sky ↓**: download current settings as JSON

### Inspect geometry in browser DevTools

```js
// In console:
const world = (window.__experience)?.world
const chunks = world?._chunks

// Active chunks
chunks._active.forEach((v, k) => console.log(k, v.lod))

// Cache stats
console.log('Cached:', chunks._cache.size, 'Active:', chunks._active.size, 'Loading:', chunks._loading.size)

// Force load a chunk
chunks._loadChunk('0_0', 0)
```

### Manifest validation

```js
// Verify all files exist
fetch('/models/town/chunks/manifest.json')
  .then(r => r.json())
  .then(m => {
    for (const c of m.chunks) {
      for (const lod of c.lods) {
        console.log(`Checking: ${lod.file}`)
      }
    }
  })
```

---

## Common Issues

### Chunks not loading

1. **Missing manifest.json**: Ensure it's at `/models/town/chunks/manifest.json`
2. **CORS error**: Verify chunk files are served from the same origin or have proper headers
3. **Wrong chunk size in config**: Must match manifest value (typically 64)

### LOD pops visible

- Increase LOD error tolerance (less aggressive simplification)
- Increase ring distance before LOD swap (load higher detail earlier)
- Reduce lodRatios (e.g., 0.5 instead of 0.25 for LOD1)

### Memory bloat

- Reduce `MAX_CACHE` size
- Profile which chunks are being kept; adjust visibility range
- Check if geometries are being disposed properly (monitor DevTools Memory tab)

### Load stutters

- Increase `MAX_CONCURRENT` (but monitor frame rate)
- Reduce gltf file sizes (increase simplification / error tolerance)
- Use network throttling in DevTools to identify bottlenecks

---

## Future Improvements

1. **Async geometry compute**: Move `computeVertexNormals()` to Worker
2. **Pre-computed tangents**: For normal mapping (if shaders support it)
3. **Physics integration**: Load collision geometry alongside visual
4. **Streaming updates**: Hot-reload chunks if source geometry changes
5. **Octree queries**: Pre-compute octrees per chunk for fast raycasting
6. **Vertex deduplication**: Weld vertices at chunk boundaries to avoid cracks

