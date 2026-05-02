// Run with: node src/lib/meshopt.test.mjs
// End-to-end check: ensure optimizeOnly + simplifyAndOptimize never produce NaN
// in the output positions, and indices stay in range.

import { initMeshopt, optimizeOnly, simplifyAndOptimize } from './meshopt.js'

let pass = 0, fail = 0
function assert(cond, msg) {
  if (cond) { pass++; return }
  fail++
  console.error(`FAIL: ${msg}`)
}

await initMeshopt()

function checkValid(label, { positions, indices }, { allowEmpty = false } = {}) {
  const vertCount = positions.length / 3
  if (!allowEmpty) assert(vertCount > 0, `${label}: empty positions`)
  for (let i = 0; i < positions.length; i++) {
    if (!Number.isFinite(positions[i])) {
      assert(false, `${label}: positions[${i}] not finite (=${positions[i]}) — vertex ${(i/3)|0}`)
      return
    }
  }
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i]
    if (idx >= vertCount) {
      assert(false, `${label}: indices[${i}]=${idx} out of range (vertCount=${vertCount})`)
      return
    }
  }
  assert(indices.length % 3 === 0, `${label}: index count ${indices.length} not multiple of 3`)
}

// Build a 6×6 grid of quads (2 tris each) → 72 triangles, 49 unique vertices
// Each triangle is non-indexed in source (9 floats per triangle).
function buildGridTriangles(N, size) {
  const triangles = []
  const step = size / N
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const x0 = c * step, x1 = x0 + step
      const z0 = r * step, z1 = z0 + step
      triangles.push(x0, 0, z0, x1, 0, z0, x1, 0, z1)
      triangles.push(x0, 0, z0, x1, 0, z1, x0, 0, z1)
    }
  }
  return new Float32Array(triangles)
}

// ---------------------------------------------------------------------------
// optimizeOnly (LOD0)
// ---------------------------------------------------------------------------

{
  const positions = buildGridTriangles(6, 64)
  const result = optimizeOnly(positions)
  checkValid('optimizeOnly grid', result)
  // 6×6 grid = 49 unique verts. After optimize, vertCount should equal unique.
  assert(result.positions.length / 3 === 49, `optimizeOnly: expected 49 verts, got ${result.positions.length / 3}`)
  assert(result.indices.length === 72 * 3, `optimizeOnly: expected 216 indices, got ${result.indices.length}`)
}

// ---------------------------------------------------------------------------
// simplifyAndOptimize (LOD1+) — this is where the NaN bug bit
// ---------------------------------------------------------------------------

{
  const positions = buildGridTriangles(20, 128)  // 800 tris, 441 unique verts
  const result = simplifyAndOptimize(positions, 0.25, 0.01)
  checkValid('simplifyAndOptimize 0.25', result)
  assert(result.positions.length / 3 < 441, `simplify 0.25 should reduce vert count, got ${result.positions.length / 3}`)
}

{
  const positions = buildGridTriangles(20, 128)
  const result = simplifyAndOptimize(positions, 0.06, 0.05)
  checkValid('simplifyAndOptimize 0.06', result)
}

// ---------------------------------------------------------------------------
// Worst-case: random "city-like" geometry with overlapping verts, where
// simplification produces many unused vertices in the remap table.
// ---------------------------------------------------------------------------

{
  const triCount = 5000
  const verts = new Float32Array(triCount * 9)
  // Seeded pseudo-random for reproducibility
  let seed = 0xdeadbeef
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0x100000000
  }
  for (let t = 0; t < triCount; t++) {
    const cx = Math.floor(rand() * 32) * 2  // grid-aligned cluster centers → many shared verts
    const cz = Math.floor(rand() * 32) * 2
    for (let v = 0; v < 3; v++) {
      verts[t * 9 + v * 3    ] = cx + Math.floor(rand() * 4)
      verts[t * 9 + v * 3 + 1] = Math.floor(rand() * 4)
      verts[t * 9 + v * 3 + 2] = cz + Math.floor(rand() * 4)
    }
  }
  const lod0 = optimizeOnly(verts)
  checkValid('random LOD0', lod0)
  const lod1 = simplifyAndOptimize(verts, 0.25, 0.01)
  checkValid('random LOD1', lod1)
  const lod2 = simplifyAndOptimize(verts, 0.06, 0.05)
  checkValid('random LOD2', lod2)
}

// ---------------------------------------------------------------------------
// Empty input
// ---------------------------------------------------------------------------

{
  const empty = new Float32Array(0)
  const lod0 = optimizeOnly(empty)
  checkValid('empty LOD0', lod0, { allowEmpty: true })
  assert(lod0.positions.length === 0 && lod0.indices.length === 0, 'empty LOD0: should produce empty output')

  const lod1 = simplifyAndOptimize(empty, 0.25, 0.01)
  checkValid('empty LOD1', lod1, { allowEmpty: true })
  assert(lod1.positions.length === 0 && lod1.indices.length === 0, 'empty LOD1: should produce empty output')
}

console.log(`\nResults: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
