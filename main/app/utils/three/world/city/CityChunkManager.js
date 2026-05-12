import { GLTFLoader } from '/lib/addons/loaders/GLTFLoader.js'
import { CHUNK_DIR, RING_LOD, MAX_RING, worldToChunk } from './CityConfig.js'

// Chunks are position-only, not Draco-compressed — no DRACOLoader needed.
const MAX_CONCURRENT = 3   // parallel GLTF parses
const MAX_CACHE      = 200 // entries before LRU eviction (RAM → GC)

export default class CityChunkManager {
  constructor(scene, material) {
    this._scene    = scene
    this._material = material
    this._loader   = new GLTFLoader()

    this._manifest = null
    this._chunkMap = new Map()  // id → manifest entry

    // cacheKey → { group: THREE.Group, lastUsed: number }
    // Groups sit off-scene until needed (geometry stays in RAM).
    this._cache  = new Map()

    // chunkId → { group, lod } — currently visible (in scene)
    this._active = new Map()

    // cacheKeys currently being fetched/parsed
    this._loading  = new Set()

    // Sorted load queue [{ chunkId, lod, priority }]
    this._queue    = []
    this._inFlight = 0

    this._currentCol = Infinity
    this._currentRow = Infinity
  }

  async init() {
    const r = await fetch(CHUNK_DIR + 'manifest.json')
    this._manifest = await r.json()
    this._chunkMap = new Map(this._manifest.chunks.map(c => [c.id, c]))
  }

  // Called every frame with camera world XZ.
  update(playerX, playerZ) {
    if (!this._manifest) return
    const { col, row } = worldToChunk(playerX, playerZ)
    if (col === this._currentCol && row === this._currentRow) return
    this._currentCol = col
    this._currentRow = row
    this._updateVisibility(col, row)
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _chunkId(col, row)       { return `${col}_${row}` }
  _cacheKey(id, lod)       { return `${id}_lod${lod}` }

  _updateVisibility(pCol, pRow) {
    const desired = new Map()  // chunkId → targetLod

    for (const chunk of this._manifest.chunks) {
      const ring = Math.max(
        Math.abs(chunk.col - pCol),
        Math.abs(chunk.row - pRow),
      )
      if (ring > MAX_RING) continue
      const targetLod = RING_LOD[ring]
      if (targetLod < chunk.lods.length) desired.set(chunk.id, targetLod)
    }

    // Remove chunks fully out of range (keep the mesh if LOD swap is pending)
    for (const [id, { group }] of this._active) {
      if (!desired.has(id)) {
        this._scene.remove(group)
        this._active.delete(id)
      }
    }

    // Enqueue loads / LOD swaps — old mesh stays until new one is ready
    this._queue = []
    for (const [id, targetLod] of desired) {
      const cur = this._active.get(id)
      if (cur && cur.lod === targetLod) continue  // already showing correct LOD

      const chunk = this._chunkMap.get(id)
      const priority = Math.max(
        Math.abs(chunk.col - pCol),
        Math.abs(chunk.row - pRow),
      )
      this._queue.push({ chunkId: id, lod: targetLod, priority })
    }
    // Closest chunks first
    this._queue.sort((a, b) => a.priority - b.priority)
    this._processQueue()
  }

  _processQueue() {
    while (this._inFlight < MAX_CONCURRENT && this._queue.length > 0) {
      const { chunkId, lod } = this._queue.shift()
      this._loadChunk(chunkId, lod)
    }
  }

  _loadChunk(chunkId, lod) {
    const key = this._cacheKey(chunkId, lod)
    if (this._loading.has(key)) return

    // Serve from in-RAM cache — zero network cost
    if (this._cache.has(key)) {
      const entry = this._cache.get(key)
      entry.lastUsed = Date.now()
      if (this._isDesired(chunkId, lod)) this._addToScene(chunkId, lod, entry.group)
      return
    }

    const chunk = this._chunkMap.get(chunkId)
    if (!chunk || lod >= chunk.lods.length) return

    this._loading.add(key)
    this._inFlight++

    const file = chunk.lods[lod].file

    fetch(CHUNK_DIR + file)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.arrayBuffer()
      })
      .then(buf => new Promise((ok, fail) =>
        this._loader.parse(buf, CHUNK_DIR, ok, fail)
      ))
      .then(gltf => {
        // Compute normals (position-only GLTFs have none) + apply shared material
        gltf.scene.traverse(child => {
          if (!child.isMesh) return
          child.geometry.computeVertexNormals()
          child.material      = this._material
          child.castShadow    = true
          child.receiveShadow = true
          child.frustumCulled = true
        })

        this._evictIfNeeded()
        this._cache.set(key, { group: gltf.scene, lastUsed: Date.now() })

        if (this._isDesired(chunkId, lod)) {
          this._addToScene(chunkId, lod, gltf.scene)
        }
      })
      .catch(err => {
        console.warn(`[CityChunkManager] ${file}:`, err.message)
      })
      .finally(() => {
        this._loading.delete(key)
        this._inFlight--
        this._processQueue()
      })
  }

  // Swap old LOD mesh for the new one atomically.
  _addToScene(chunkId, lod, group) {
    const old = this._active.get(chunkId)
    if (old) this._scene.remove(old.group)
    this._scene.add(group)
    this._active.set(chunkId, { group, lod })
  }

  // Check against current player position (load may have finished after player moved).
  _isDesired(chunkId, lod) {
    const chunk = this._chunkMap.get(chunkId)
    if (!chunk) return false
    const ring = Math.max(
      Math.abs(chunk.col - this._currentCol),
      Math.abs(chunk.row - this._currentRow),
    )
    return ring <= MAX_RING && RING_LOD[ring] === lod
  }

  // LRU eviction: dispose geometry of the least-recently-used non-active entry.
  _evictIfNeeded() {
    if (this._cache.size < MAX_CACHE) return

    const activeKeys = new Set()
    for (const [id, { lod }] of this._active) activeKeys.add(this._cacheKey(id, lod))

    let oldest = null, oldestTime = Infinity
    for (const [key, entry] of this._cache) {
      if (activeKeys.has(key)) continue
      if (entry.lastUsed < oldestTime) { oldestTime = entry.lastUsed; oldest = key }
    }

    if (oldest) {
      const { group } = this._cache.get(oldest)
      group.traverse(c => { if (c.isMesh) c.geometry?.dispose() })
      this._cache.delete(oldest)
    }
  }

  dispose() {
    for (const { group } of this._active.values()) this._scene.remove(group)
    for (const { group } of this._cache.values()) {
      group.traverse(c => { if (c.isMesh) c.geometry?.dispose() })
    }
    this._active.clear()
    this._cache.clear()
    this._loading.clear()
    this._queue    = []
    this._inFlight = 0
  }
}
