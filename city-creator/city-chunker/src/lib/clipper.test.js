// Run with: node src/lib/clipper.test.js
// Tests clipTriangleHalfPlane and sliceGeometry with synthetic geometry.

import { clipTriangleHalfPlane, sliceGeometry } from './clipper.js'

let pass = 0, fail = 0
function assert(cond, msg) {
  if (cond) { pass++; return }
  fail++
  console.error(`FAIL: ${msg}`)
}

// -----------------------------------------------------------------------
// clipTriangleHalfPlane unit tests
// -----------------------------------------------------------------------

const scratch = new Float32Array(18)

// All 3 verts inside → 3 out
{
  const tri = new Float32Array([1,0,0, 3,0,0, 2,0,2])
  const n = clipTriangleHalfPlane(tri, 0, 0, true, scratch)
  assert(n === 3, `all inside: expected 3, got ${n}`)
}

// All 3 verts outside → 0 out
{
  const tri = new Float32Array([-1,0,0, -3,0,0, -2,0,2])
  const n = clipTriangleHalfPlane(tri, 0, 0, true, scratch)
  assert(n === 0, `all outside: expected 0, got ${n}`)
}

// 2 inside, 1 outside → 4 out (quad)
{
  const tri = new Float32Array([2,0,0, 2,0,2, -1,0,1])
  const n = clipTriangleHalfPlane(tri, 0, 0, true, scratch)
  assert(n === 4, `2 inside 1 outside: expected 4, got ${n}`)
  // Boundary vertices (those on the edge X=0) must have X exactly 0
  for (let i = 0; i < n; i++) {
    const x = scratch[i * 3]
    if (x < 0) assert(false, `vertex ${i} X=${x} is outside after clip`)
  }
}

// 1 inside, 2 outside → 3 out (triangle)
{
  const tri = new Float32Array([2,0,0, -1,0,0, -1,0,2])
  const n = clipTriangleHalfPlane(tri, 0, 0, true, scratch)
  assert(n === 3, `1 inside 2 outside: expected 3, got ${n}`)
}

// Boundary snapping: cut vertex must have axis component == edge exactly
{
  const tri = new Float32Array([5,0,0, -1,0,0, -1,0,4])
  const edge = 0
  const n = clipTriangleHalfPlane(tri, 0, edge, true, scratch)
  for (let i = 0; i < n; i++) {
    const x = scratch[i * 3]
    if (x < edge - 1e-6) assert(false, `boundary vertex X=${x} not snapped to edge=${edge}`)
  }
  // The two cut verts must have X === edge exactly (float identity)
  let snapped = 0
  for (let i = 0; i < n; i++) {
    if (scratch[i * 3] === edge) snapped++
  }
  assert(snapped === 2, `expected 2 boundary-snapped verts, got ${snapped}`)
}

// -----------------------------------------------------------------------
// sliceGeometry: synthetic 10×10 grid spanning [0,128]×[0,128]
// -----------------------------------------------------------------------

// Build a flat grid of 10×10 quads (2 tris each) in XZ plane, Y=0
// Total: 200 triangles
const GRID_N = 10
const GRID_SIZE = 128
const step = GRID_SIZE / GRID_N // 12.8

const positions = []
for (let r = 0; r < GRID_N; r++) {
  for (let c = 0; c < GRID_N; c++) {
    const x0 = c * step, x1 = x0 + step
    const z0 = r * step, z1 = z0 + step
    // Triangle 1
    positions.push(x0, 0, z0, x1, 0, z0, x1, 0, z1)
    // Triangle 2
    positions.push(x0, 0, z0, x1, 0, z1, x0, 0, z1)
  }
}

const posArr = new Float32Array(positions)
const CHUNK_SIZE = 64

const buckets = sliceGeometry(posArr, null, CHUNK_SIZE, 0, 0)

// With chunkSize=64 and grid [0,128]×[0,128], expect 4 chunks: 0_0, 1_0, 0_1, 1_1
assert(buckets.size === 4, `expected 4 chunks, got ${buckets.size}: [${[...buckets.keys()].join(', ')}]`)

// Count total output triangles — slight increase from clipping boundary triangles is expected
let totalOutTris = 0
for (const [, arrays] of buckets) {
  for (const arr of arrays) {
    assert(arr.length % 9 === 0, `bucket array length ${arr.length} not multiple of 9`)
    totalOutTris += arr.length / 9
  }
}
// Input: 200 triangles. Boundary triangles get clipped and re-triangulated.
// Expected: ≥ 200 (slight increase OK), well below 2× = 400
assert(totalOutTris >= 200, `totalOutTris ${totalOutTris} < 200 (lost triangles!)`)
assert(totalOutTris < 400, `totalOutTris ${totalOutTris} suspiciously high`)

// No vertex outside its chunk's AABB
for (const [key, arrays] of buckets) {
  const [col, row] = key.split('_').map(Number)
  const minX = col * CHUNK_SIZE, maxX = minX + CHUNK_SIZE
  const minZ = row * CHUNK_SIZE, maxZ = minZ + CHUNK_SIZE

  for (const arr of arrays) {
    for (let i = 0; i < arr.length; i += 3) {
      const x = arr[i], z = arr[i + 2]
      const eps = 1e-4
      assert(x >= minX - eps, `chunk ${key}: x=${x} < minX=${minX}`)
      assert(x <= maxX + eps, `chunk ${key}: x=${x} > maxX=${maxX}`)
      assert(z >= minZ - eps, `chunk ${key}: z=${z} < minZ=${minZ}`)
      assert(z <= maxZ + eps, `chunk ${key}: z=${z} > maxZ=${maxZ}`)
    }
  }
}

// Boundary vertices on shared edges: collect all verts on X=64 from both 0_0 and 1_0
// and verify they are identical (exact float match).
{
  const verts0_0 = [], verts1_0 = []
  const EDGE = 64

  for (const arr of buckets.get('0_0') ?? []) {
    for (let i = 0; i < arr.length; i += 3) {
      if (arr[i] === EDGE) verts0_0.push([arr[i], arr[i+1], arr[i+2]])
    }
  }
  for (const arr of buckets.get('1_0') ?? []) {
    for (let i = 0; i < arr.length; i += 3) {
      if (arr[i] === EDGE) verts1_0.push([arr[i], arr[i+1], arr[i+2]])
    }
  }

  // All boundary verts from 0_0 at X=64 should also appear in 1_0
  for (const [x, y, z] of verts0_0) {
    const found = verts1_0.some(([x2, y2, z2]) => x === x2 && y === y2 && z === z2)
    assert(found, `boundary vert (${x},${y},${z}) from 0_0 not found in 1_0`)
  }

  assert(verts0_0.length > 0, 'no boundary verts found on X=64 edge in chunk 0_0')
}

console.log(`\nResults: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
