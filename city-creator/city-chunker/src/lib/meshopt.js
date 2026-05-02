import { MeshoptSimplifier } from 'meshoptimizer'
import { MeshoptEncoder } from 'meshoptimizer'

export async function initMeshopt() {
  await MeshoptSimplifier.ready
  await MeshoptEncoder.ready
}

const UNUSED = 0xFFFFFFFF

// Deduplicate positions and return a tightly-packed vertex buffer plus an
// index buffer that references it. `generatePositionRemap` returns
// `canonical[i] = first vertex sharing the position of i`, but those canonical
// indices are sparse in [0, vertCount-1]. We compact them to [0, uniqueCount-1]
// so downstream meshopt calls see no zero-filled gaps.
function _dedup(positions) {
  const vertCount = positions.length / 3
  if (vertCount === 0) return { indices: new Uint32Array(0), compactPos: new Float32Array(0) }

  const canonical = MeshoptSimplifier.generatePositionRemap(positions, 3)

  // Map each canonical (sparse) index to a compact (dense) index.
  const canonicalToCompact = new Uint32Array(vertCount).fill(UNUSED)
  let compactCount = 0
  for (let i = 0; i < vertCount; i++) {
    const c = canonical[i]
    if (canonicalToCompact[c] === UNUSED) canonicalToCompact[c] = compactCount++
  }

  const compactPos = new Float32Array(compactCount * 3)
  for (let i = 0; i < vertCount; i++) {
    const dst = canonicalToCompact[canonical[i]] * 3
    const src = i * 3
    compactPos[dst    ] = positions[src    ]
    compactPos[dst + 1] = positions[src + 1]
    compactPos[dst + 2] = positions[src + 2]
  }

  const indices = new Uint32Array(vertCount)
  for (let i = 0; i < vertCount; i++) {
    indices[i] = canonicalToCompact[canonical[i]]
  }

  return { indices, compactPos }
}

// Optimize vertex cache + fetch. `reorderMesh` returns a remap where
// `remap[old] = new` (or `UNUSED` if `old` is not referenced) and mutates
// `indices` in place to use the new ordering.
function _reorder(indices, compactPos) {
  if (indices.length === 0) return { positions: new Float32Array(0), indices }

  const [remap, newVertCount] = MeshoptEncoder.reorderMesh(indices, /* triangles */ true, /* optsize */ false)

  const finalPos = new Float32Array(newVertCount * 3)
  for (let old = 0; old < remap.length; old++) {
    const ni = remap[old]
    if (ni === UNUSED) continue
    finalPos[ni * 3    ] = compactPos[old * 3    ]
    finalPos[ni * 3 + 1] = compactPos[old * 3 + 1]
    finalPos[ni * 3 + 2] = compactPos[old * 3 + 2]
  }
  return { positions: finalPos, indices }
}

/**
 * Deduplicate + optimize vertex cache/fetch with no simplification (LOD0).
 * @param {Float32Array} positions - flat xyz, non-indexed
 * @returns {{ positions: Float32Array, indices: Uint32Array }}
 */
export function optimizeOnly(positions) {
  const { indices, compactPos } = _dedup(positions)
  return _reorder(indices, compactPos)
}

/**
 * Simplify then optimize vertex cache/fetch (LOD1+).
 * @param {Float32Array} positions - flat xyz, non-indexed
 * @param {number} targetRatio - must be < 1.0; use optimizeOnly for ratio 1.0
 * @param {number} targetError
 * @returns {{ positions: Float32Array, indices: Uint32Array }}
 */
export function simplifyAndOptimize(positions, targetRatio, targetError) {
  const { indices, compactPos } = _dedup(positions)
  if (indices.length === 0) return { positions: new Float32Array(0), indices }

  const targetIndexCount = Math.floor((indices.length * targetRatio) / 3) * 3
  const [simpIndices] = MeshoptSimplifier.simplify(indices, compactPos, 3, targetIndexCount, targetError)

  return _reorder(simpIndices, compactPos)
}
