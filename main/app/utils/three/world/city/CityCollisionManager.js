import { CHUNK_SIZE } from './CityConfig.js'
import { assetPath } from '../../../assetPath.js'
import { reportAssetError } from '../../../assetError.js'

const SAMPLE_COUNT = 16
const CACHE_MAX    = 16      // TTL eviction activates only above this entry count
const CACHE_TTL    = 60_000  // ms — unused entries become evictable after this
const EDGE_MARGIN  = 0.25    // fraction of CHUNK_SIZE that triggers boundary preload

export default class CityCollisionManager {
  constructor(manifest) {
    const meta        = manifest.collisionMap
    this._resolution  = meta?.resolution ?? 1024
    this._pf          = this._resolution / CHUNK_SIZE
    this._chunkMap    = new Map(
      manifest.chunks
        .filter(c => c.collision?.bin)
        .map(c => [c.id, c])
    )
    this._cache    = new Map()  // chunkId → { data: Uint8Array, lastUsed: number }
    this._loading  = new Set()
    this._lastCol  = Infinity
    this._lastRow  = Infinity

    this._cachedCol = Infinity
    this._cachedRow = Infinity
    this._cachedBf  = null

    this.radius = 0.3
  }

  // Preloads ring 0-2 on chunk change; always preloads chunks near boundaries.
  preload(playerCol, playerRow, worldX, worldZ) {
    this._preloadBoundary(playerCol, playerRow, worldX, worldZ)

    if (playerCol === this._lastCol && playerRow === this._lastRow) return
    this._lastCol = playerCol
    this._lastRow = playerRow
    this._cachedCol = Infinity

    for (const [id, chunk] of this._chunkMap) {
      const ring = Math.max(
        Math.abs(chunk.col - playerCol),
        Math.abs(chunk.row - playerRow),
      )
      if (ring <= 2 && !this._cache.has(id) && !this._loading.has(id)) {
        this._fetchBin(id, chunk.collision.bin)
      }
    }

    this._evictStale()
  }

  // Eagerly fetch the adjacent chunks the player is approaching.
  // Runs every preload() call — O(4) checks, no allocation.
  _preloadBoundary(pCol, pRow, worldX, worldZ) {
    const localX = worldX - pCol * CHUNK_SIZE
    const localZ = worldZ - pRow * CHUNK_SIZE
    const margin = CHUNK_SIZE * EDGE_MARGIN

    if (localX < margin)               this._fetchIfMissing(pCol - 1, pRow)
    if (localX > CHUNK_SIZE - margin)  this._fetchIfMissing(pCol + 1, pRow)
    if (localZ < margin)               this._fetchIfMissing(pCol, pRow - 1)
    if (localZ > CHUNK_SIZE - margin)  this._fetchIfMissing(pCol, pRow + 1)
  }

  _fetchIfMissing(col, row) {
    const id    = `${col}_${row}`
    const chunk = this._chunkMap.get(id)
    if (chunk && !this._cache.has(id) && !this._loading.has(id)) {
      this._fetchBin(id, chunk.collision.bin)
    }
  }

  _fetchBin(chunkId, file) {
    this._loading.add(chunkId)
    const url = assetPath('/models/town/chunks/' + file)
    fetch(url)
      .then(r => {
        if (!r.ok) {
          const e = new Error(`HTTP ${r.status} ${r.statusText || ''}`.trim())
          e.status = r.status
          throw e
        }
        return r.arrayBuffer()
      })
      .then(buf => {
        this._cache.set(chunkId, { data: new Uint8Array(buf), lastUsed: Date.now() })
      })
      .catch(err => {
        reportAssetError('CityCollisionManager', {
          name:   file,
          url,
          status: err.status,
          verb:   'collision bin failed',
          error:  err,
          level:  'warn',
        })
      })
      .finally(() => this._loading.delete(chunkId))
  }

  // Evict stale entries — only when cache exceeds CACHE_MAX to avoid frequent cleanup.
  _evictStale() {
    if (this._cache.size <= CACHE_MAX) return
    const cutoff = Date.now() - CACHE_TTL
    for (const [id, entry] of this._cache) {
      if (entry.lastUsed < cutoff) this._cache.delete(id)
    }
  }

  // Returns true if the XZ world point is occupied in the collision bitmap.
  // Hot path — per-call chunk cache avoids string allocation on every perimeter point.
  sampleAt(worldX, worldZ) {
    const col = Math.floor(worldX / CHUNK_SIZE)
    const row = Math.floor(worldZ / CHUNK_SIZE)

    let bf
    if (col === this._cachedCol && row === this._cachedRow) {
      bf = this._cachedBf
    } else {
      const entry = this._cache.get(`${col}_${row}`) ?? null
      bf = entry?.data ?? null
      if (bf) {
        entry.lastUsed  = Date.now()
        this._cachedCol = col
        this._cachedRow = row
        this._cachedBf  = bf
      }
    }

    if (!bf) return false

    const px = Math.floor((worldX - col * CHUNK_SIZE) * this._pf)
    const pz = Math.floor((worldZ - row * CHUNK_SIZE) * this._pf)
    if (px < 0 || px >= this._resolution || pz < 0 || pz >= this._resolution) return false

    const idx = pz * this._resolution + px
    return Boolean((bf[idx >> 3] >> (idx & 7)) & 1)
  }

  _circleBlocked(cx, cz) {
    const r = this.radius
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const a = (i / SAMPLE_COUNT) * Math.PI * 2
      if (this.sampleAt(cx + Math.cos(a) * r, cz + Math.sin(a) * r)) return true
    }
    return false
  }

  resolveMovement(fromX, fromZ, dx, dz) {
    if (!this._circleBlocked(fromX + dx, fromZ + dz)) return { dx, dz }
    if (this._circleBlocked(fromX, fromZ)) return { dx, dz }

    const xOk = !this._circleBlocked(fromX + dx, fromZ)
    const zOk = !this._circleBlocked(fromX, fromZ + dz)

    if (xOk) return { dx, dz: 0 }
    if (zOk) return { dx: 0, dz }
    return { dx: 0, dz: 0 }
  }

  dispose() {
    this._cache.clear()
    this._loading.clear()
  }
}
