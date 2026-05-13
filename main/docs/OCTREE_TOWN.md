# Octree in the Town — Approaches, Issues, and Recommendations

> Context: the town uses `CityChunkManager` to stream 64×64 world-unit GLTF chunks in and out based on the player's XZ position. The existing `buildOctree.js` / `FpsController` pair works fine for **static** scenes (Atelier, Hub), but the chunk system makes the geometry fundamentally dynamic. This doc analyses every viable strategy and their cost on the current baseline of ~20 fps.

---

## 1. Why this is hard

Three.js's `Octree` (used by `buildOctree.js`) works by calling `octree.fromGraphNode(root)`:

- It traverses the entire scene graph and bakes every triangle into octree nodes.
- The structure is **immutable after construction** — there is no `addTriangles()` or `removeTriangles()`.
- Rebuilding from scratch is O(n log n) in triangle count and happens synchronously on the main thread.

In a static scene this is fine: you call it once after `resources.ready`, and the octree lives forever. In the town, the geometry underneath the player is swapped **every time a chunk boundary is crossed** — on average every few seconds of walking. A naïve "rebuild the whole octree on every change" approach would freeze the frame for tens of milliseconds each time.

---

## 2. What the chunk system looks like at runtime

At any moment `CityChunkManager._active` holds between 1 and 25 chunks (ring 0–3, Chebyshev distance). Collision only matters for the player's immediate vicinity — roughly ring 0–1 (up to 9 chunks, 192×192 world units). Ring 2–3 chunks are mostly visual; the player will never reach them before they become ring 0.

```
ring 2 2 2 2 2
ring 2 1 1 1 2
ring 2 1 0 1 2   ← player is in chunk (0,0)
ring 2 1 1 1 2
ring 2 2 2 2 2
```

This matters: the octree only needs to cover the **9 chunks in ring 0–1**, not all visible chunks.

---

## 3. Approaches

### A — Per-chunk local octrees (recommended)

**How it works**

Build one `Octree` per chunk when that chunk finishes loading. Store them keyed by chunk ID. In `FpsController.update()`, instead of querying one global octree, iterate over the octrees of the ≤9 chunks within ring 1 and merge the collision response.

```js
// CityChunkManager adds:
_octrees = new Map()  // chunkId → Octree

// After GLTF parse is done (inside _loadChunk):
const oct = new Octree()
oct.fromGraphNode(gltf.scene)
this._octrees.set(chunkId, oct)

// On eviction / scene remove:
this._octrees.delete(chunkId)
```

```js
// FpsController.update() — instead of capsuleIntersect(this._octree):
for (const oct of this._world.chunkManager.nearbyOctrees(playerChunk)) {
  const result = oct.capsuleIntersect(this._capsule)
  if (result) {
    this._capsule.translate(result.normal.multiplyScalar(result.depth))
    // accumulate velocity cancellation as usual
  }
}
```

**Cost per frame**

- `capsuleIntersect` on one chunk's octree: ~0.1–0.3 ms (depends on poly count).
- Querying 9 octrees: ~0.9–2.7 ms worst case. Well within budget.

**Cost on chunk load**

- `fromGraphNode` on a single 64×64 chunk: 5–30 ms depending on geometry density.
- This runs **synchronously on the main thread** during the load callback. That one frame will spike. At 20 fps you have a 50 ms budget; a 30 ms build will hurt visually.

**Mitigation: deferred build (one chunk per frame)**

```js
// In CityWorld.update(delta):
if (this._octreeBuildQueue.length > 0) {
  const { chunkId, scene } = this._octreeBuildQueue.shift()
  const oct = new Octree()
  oct.fromGraphNode(scene)
  this._chunkManager.setOctree(chunkId, oct)
}
```

The player won't collide with the new chunk until its octree is ready, but since chunks at ring 2 start loading before the player reaches ring 0, the octree is usually ready before they get there.

**Pros**
- Isolated builds — small input per chunk.
- No global state to synchronise.
- Octrees are freed with the chunk (no memory leak).
- Queries are still O(log n) per chunk.

**Cons**
- `FpsController` must be aware of multiple octrees (minor refactor).
- Build still blocks the main thread per chunk load.
- Brief gap between chunk appearing visually and being collidable.

---

### B — Global octree rebuilt on every chunk change

**How it works**

Every time a chunk is added or removed from the scene, call `buildOctree(scene)` to rebuild from all active chunks.

**Why this is painful**

- With 9–25 active chunks, rebuilding touches thousands of triangles.
- A single rebuild can take 50–200 ms on a potato machine.
- The player crosses a chunk boundary every few seconds while walking → frame freeze every few seconds.
- At 20 fps baseline, this will make the game feel broken.

**Verdict: not viable without a worker.**

---

### C — Global octree rebuilt in a Worker

**How it works**

Ship geometry data to a Worker thread that builds the octree, then transfers the result back.

**Why this is very hard**

- Three.js `Octree` is not serialisable — the built octree object can't be `postMessage`d.
- You'd need to re-implement octree building and querying in a way that works with `SharedArrayBuffer` or transferable structures.
- Geometry `BufferAttribute` arrays *can* be transferred, but you'd need a full custom spatial index, not the Three.js one.
- This is a significant engineering investment (hundreds of lines of custom spatial partitioning).

**Verdict: overkill unless performance profiling shows nothing else works.**

---

### D — Flat collision floor + trigger zones

**How it works**

Skip mesh collision entirely for the town. Use a flat invisible plane as the floor. Use `TriggerZoneDetector` boxes for buildings (the player can't walk through them).

**Pros**
- Zero octree cost. The 20 fps baseline is untouched.
- Trivial to implement — the trigger zone system already exists.

**Cons**
- No stair climbing or sloped terrain.
- Clipping through buildings is prevented only at the box level, not the mesh level.
- If the town has any terrain height variation, the player floats or sinks.

**Verdict: good fallback for a flat, grid-based town. Not great for organic geometry.**

---

### E — Hybrid: per-chunk octrees + flat floor fallback

**How it works**

Use approach A for vertical collision (floors, ramps) but replace per-chunk wall collision with static box colliders defined in `CityConfig.js`.

- Walls are axis-aligned in most cities → AABB checks are O(1) and perfectly accurate.
- Floors / stairs need the octree for height queries.
- Only build octrees for ring-0 chunks (the 1 chunk the player is currently in).

This reduces octree build frequency to once per chunk transition (not per chunk *load*) and limits queries to a single octree at a time.

---

## 4. Performance table

| Approach | Build cost | Per-frame cost | Main-thread stutter | Accuracy |
|---|---|---|---|---|
| A — per-chunk octrees (deferred) | 5–30 ms, spread 1/frame | 1–3 ms (9 queries) | Minimal | Full mesh |
| B — global rebuild on change | 50–200 ms | ~0.5 ms | Every chunk cross | Full mesh |
| C — worker rebuild | High impl cost | ~0.5 ms | None | Full mesh |
| D — flat floor + trigger boxes | 0 | ~0 | None | Low |
| E — hybrid (ring-0 only + boxes) | 5–30 ms, 1/transition | 0.1–0.3 ms (1 query) | Minimal | Medium |

---

## 5. What the current 20 fps budget looks like

At 20 fps, you have **50 ms per frame**. The budget is roughly:

| Task | Estimated cost |
|---|---|
| Scene render (draw calls, shaders) | 35–40 ms |
| FPS controller physics | 0.5–1 ms |
| Chunk streaming logic | 0.5 ms |
| Interaction (proximity checks) | 0.5 ms |
| Available headroom | ~8–12 ms |

Adding 1–3 ms for 9 octree queries (Approach A) is fine. The danger is the **build spike**: even 15 ms on a build would eat your entire headroom for that frame, dropping to ~15 fps briefly.

The deferred build (one per frame) keeps any single frame spike to ~5–30 ms max — not ideal but rare (only on chunk load transitions) and invisible compared to streaming jank which already exists.

---

## 6. Recommended implementation path

1. **Start with Approach E** (ring-0 octree only + box colliders for walls). It is the least risky for a potato machine.
2. Measure the frame time of the deferred octree build in `#debug` (stats.js already shows frame time).
3. If ring-0 alone is not enough (terrain height variation in ring-1), expand to ring-1 queries (Approach A).
4. Do **not** attempt a global rebuild (Approach B) or a worker rebuild (Approach C) unless step 2 reveals the deferred build is too slow.

---

## 7. Key code changes needed

### `FpsController.js`

Replace the single `_octree` property with an array or iterator:

```js
// Before
setOctree(octree) { this._octree = octree }

// After
setOctrees(iterable) { this._octrees = iterable }

// In _collide():
for (const oct of this._octrees) {
  const result = oct.capsuleIntersect(this._capsule)
  if (result) { /* apply */ }
}
```

### `CityChunkManager.js`

Add octree storage and a build queue hook:

```js
getOctreesForPlayer(playerCol, playerRow) {
  const out = []
  for (const [id, entry] of this._active) {
    const chunk = this._chunkMap.get(id)
    const ring = Math.max(Math.abs(chunk.col - playerCol), Math.abs(chunk.row - playerRow))
    if (ring <= 1 && this._octrees.has(id)) out.push(this._octrees.get(id))
  }
  return out
}
```

### `CityWorld.js`

Wire them together in `update(delta)`:

```js
update(delta) {
  // Drain one octree build per frame
  if (this._octreeBuildQueue.length > 0) {
    const { chunkId, scene } = this._octreeBuildQueue.shift()
    this._chunkManager.buildOctree(chunkId, scene)
  }

  const { col, row } = worldToChunk(playerX, playerZ)
  this._fpsController.setOctrees(this._chunkManager.getOctreesForPlayer(col, row))
  this._fpsController.update(delta)
}
```

---

## 8. Issues to watch for

**Gap between visual load and collidable load**
The chunk mesh appears in the scene before its octree is ready. If the player sprints toward a freshly loaded chunk boundary they may clip through for one or two frames. This is the fundamental tradeoff of deferred builds. It is usually imperceptible at normal walking speed.

**LOD swap invalidates octrees**
When a chunk swaps from LOD 0 to LOD 1, the geometry changes. The octree should be rebuilt for the new LOD. If the player is on ring 0 (which always uses LOD 0) and ring 1 uses LOD 1, you only need octrees for LOD 0 chunks — which simplifies things.

**LRU eviction**
`CityChunkManager` evicts geometry when `_cache` hits 200 entries. Make sure `_octrees.delete(chunkId)` is called in the same place as `geometry.dispose()`. Otherwise octrees outlive their geometry (memory leak).

**`fromGraphNode` and materials**
The octree is built from geometry positions only. Calling it before `computeVertexNormals()` or material assignment is fine — those don't affect collision geometry. Call it immediately after `GLTFLoader.parse()` resolves, before any material swap.

**Multiple collision responses in one frame**
When the player stands at the corner of four chunks, `capsuleIntersect` from four octrees may all return results. Apply all responses additively — do not `break` on the first hit. The Three.js `FpsController` example does this correctly.
