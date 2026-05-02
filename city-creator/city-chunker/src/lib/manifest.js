/**
 * @param {Array<{id, col, row, aabb, lods}>} chunkMeta
 * @param {number} chunkSize
 * @param {[number, number]} origin
 * @returns {object} manifest JSON object
 */
export function buildManifest(chunkMeta, chunkSize, origin = [0, 0]) {
  return {
    chunkSize,
    origin,
    chunks: chunkMeta
  }
}
