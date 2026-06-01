import * as THREE from '/lib/three.js'

export const CHUNK_SIZE = 64
export const ORIGIN     = [0, 0]

// Chebyshev ring distance → LOD index (-1 not used; absence means unload)
// ring 0 = current chunk, ring 1 = 8 neighbours, etc.
export const RING_LOD = [
  0, // ring 0 — LOD0
  0, // ring 1 — LOD0
  1, // ring 2 — LOD1
  2, // ring 3 — LOD2
]
export const MAX_RING = RING_LOD.length - 1  // 3

// Camera eye height above ground (floor mesh placed so capsule settles here)
export const EYE_HEIGHT = 1.45

// Spawn at center of chunk (0, 0)
export const SPAWN = new THREE.Vector3(
  ORIGIN[0] + CHUNK_SIZE * 0.5,
  EYE_HEIGHT,
  ORIGIN[1] + CHUNK_SIZE * 0.5,
)

// ── Coordinate utilities ──────────────────────────────────────────────────────

/** World XZ → chunk grid (col, row) */
export function worldToChunk(worldX, worldZ) {
  return {
    col: Math.floor((worldX - ORIGIN[0]) / CHUNK_SIZE),
    row: Math.floor((worldZ - ORIGIN[1]) / CHUNK_SIZE),
  }
}

/** Chunk grid corner in world space */
export function chunkCorner(col, row) {
  return {
    x: ORIGIN[0] + col * CHUNK_SIZE,
    z: ORIGIN[1] + row * CHUNK_SIZE,
  }
}

/**
 * City coordinate → THREE.Vector3 world position.
 *
 * col, row    — chunk grid indices
 * localX / localZ — offset within the chunk  [0, CHUNK_SIZE)
 * height      — Y above street level
 *
 * Example: place an NPC at the center of chunk (-2, 3), 0m above ground
 *   cityPos(-2, 3, 32, 32, 0)
 */
export function cityPos(col, row, localX = 0, localZ = 0, height = 0) {
  return new THREE.Vector3(
    ORIGIN[0] + col * CHUNK_SIZE + localX,
    height,
    ORIGIN[1] + row * CHUNK_SIZE + localZ,
  )
}
