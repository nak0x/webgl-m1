/**
 * @param {Array<{id, col, row, aabb, lods, collision?}>} chunkMeta
 * @param {number} chunkSize
 * @param {[number, number]} origin
 * @param {object?} collisionMeta
 * @returns {object} manifest JSON object
 */
export function buildManifest(chunkMeta, chunkSize, origin = [0, 0], collisionMeta = null) {
  const manifest = {
    chunkSize,
    origin,
    chunks: chunkMeta
  }
  if (collisionMeta) {
    manifest.collisionMap = collisionMeta
  }
  return manifest
}
