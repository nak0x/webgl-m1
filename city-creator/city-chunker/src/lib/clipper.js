// Sutherland-Hodgman half-plane clipper — zero allocation inside clip loops.

// Cross-product magnitude squared < eps → degenerate (collinear or zero-area) triangle.
// All args are scalars to avoid any object allocation.
function _isDegenerateTriangle(ax, ay, az, bx, by, bz, cx, cy, cz) {
  const e1x = bx - ax, e1y = by - ay, e1z = bz - az
  const e2x = cx - ax, e2y = cy - ay, e2z = cz - az
  const crx = e1y * e2z - e1z * e2y
  const cry = e1z * e2x - e1x * e2z
  const crz = e1x * e2y - e1y * e2x
  return (crx * crx + cry * cry + crz * crz) < 1e-10
}

// Clips a convex polygon (inCount vertices) against one axis-aligned half-plane.
// Writes surviving vertices into `out`. Returns output vertex count.
// Boundary snapping: cut vertices have their clip-axis component hard-set to `edge`.
function clipPolygonHalfPlane(inVerts, inCount, axis, edge, keep_positive, out) {
  let n = 0
  for (let i = 0; i < inCount; i++) {
    const ai = i * 3
    const bi = ((i + 1) % inCount) * 3
    const av = inVerts[ai + axis]
    const bv = inVerts[bi + axis]
    const aIn = keep_positive ? av >= edge : av <= edge
    const bIn = keep_positive ? bv >= edge : bv <= edge
    if (aIn) {
      out[n * 3    ] = inVerts[ai    ]
      out[n * 3 + 1] = inVerts[ai + 1]
      out[n * 3 + 2] = inVerts[ai + 2]
      n++
    }
    if (aIn !== bIn) {
      const t = (edge - av) / (bv - av)
      out[n * 3    ] = inVerts[ai    ] + t * (inVerts[bi    ] - inVerts[ai    ])
      out[n * 3 + 1] = inVerts[ai + 1] + t * (inVerts[bi + 1] - inVerts[ai + 1])
      out[n * 3 + 2] = inVerts[ai + 2] + t * (inVerts[bi + 2] - inVerts[ai + 2])
      out[n * 3 + axis] = edge // boundary snap — exact float, no T-junction cracks
      n++
    }
  }
  return n
}

/**
 * Clip a triangle against one axis-aligned half-plane.
 * Returns vertex count written to `out` (0, 3, or 4). NO allocation.
 * @param {Float32Array} verts - [x,y,z, x,y,z, x,y,z]
 * @param {number} axis - 0=X, 2=Z
 * @param {number} edge - world coordinate of clip plane
 * @param {boolean} keep_positive - true = keep where verts[axis] >= edge
 * @param {Float32Array} out - pre-allocated scratch, min 18 floats
 */
export function clipTriangleHalfPlane(verts, axis, edge, keep_positive, out) {
  return clipPolygonHalfPlane(verts, 3, axis, edge, keep_positive, out)
}

/**
 * Slice a merged position-only geometry into chunk buckets.
 * Returns Map<chunkId, Float32Array[]> of non-indexed position arrays (fan-triangulated).
 * @param {Float32Array} positions - flat xyz, length = vertCount * 3
 * @param {Uint32Array|null} indices
 * @param {number} chunkSize
 * @param {number} originX
 * @param {number} originZ
 * @param {((pct: number) => void)|null} onProgress - called every 100k triangles with [0,1]
 */
export function sliceGeometry(positions, indices, chunkSize, originX, originZ, onProgress) {
  // Pre-allocate scratch buffers outside all loops — zero alloc in inner loop.
  // A triangle clipped by 4 half-planes has at most 3+4=7 vertices.
  const A = new Float32Array(21) // 7 verts × 3 floats
  const B = new Float32Array(21)

  // Growable per-chunk accumulator to avoid millions of tiny allocations.
  const rawBuckets = new Map() // key → { data: Float32Array, count: number }

  const triCount = indices ? indices.length / 3 : positions.length / 9

  for (let t = 0; t < triCount; t++) {
    if (onProgress && t % 100_000 === 0) onProgress(t / triCount)

    let i0, i1, i2
    if (indices) {
      i0 = indices[t * 3    ] * 3
      i1 = indices[t * 3 + 1] * 3
      i2 = indices[t * 3 + 2] * 3
    } else {
      i0 = t * 9
      i1 = t * 9 + 3
      i2 = t * 9 + 6
    }

    const x0 = positions[i0], y0 = positions[i0 + 1], z0 = positions[i0 + 2]
    const x1 = positions[i1], y1 = positions[i1 + 1], z1 = positions[i1 + 2]
    const x2 = positions[i2], y2 = positions[i2 + 1], z2 = positions[i2 + 2]

    // Triangle AABB — used to cull cells cheaply
    const triMinX = x0 < x1 ? (x0 < x2 ? x0 : x2) : (x1 < x2 ? x1 : x2)
    const triMaxX = x0 > x1 ? (x0 > x2 ? x0 : x2) : (x1 > x2 ? x1 : x2)
    const triMinZ = z0 < z1 ? (z0 < z2 ? z0 : z2) : (z1 < z2 ? z1 : z2)
    const triMaxZ = z0 > z1 ? (z0 > z2 ? z0 : z2) : (z1 > z2 ? z1 : z2)

    const minCol = Math.floor((triMinX - originX) / chunkSize)
    const maxCol = Math.ceil((triMaxX - originX) / chunkSize) - 1
    const minRow = Math.floor((triMinZ - originZ) / chunkSize)
    const maxRow = Math.ceil((triMaxZ - originZ) / chunkSize) - 1

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const cellMinX = originX + col * chunkSize
        const cellMaxX = cellMinX + chunkSize
        const cellMinZ = originZ + row * chunkSize
        const cellMaxZ = cellMinZ + chunkSize

        // Load original triangle into A for this cell's clip sequence
        A[0] = x0; A[1] = y0; A[2] = z0
        A[3] = x1; A[4] = y1; A[5] = z1
        A[6] = x2; A[7] = y2; A[8] = z2

        // Sutherland-Hodgman: clip against all 4 cell edges, alternating A↔B
        let nc = clipPolygonHalfPlane(A, 3, 0, cellMinX, true,  B) // X >= minX
        if (nc < 3) continue
        nc     = clipPolygonHalfPlane(B, nc, 0, cellMaxX, false, A) // X <= maxX
        if (nc < 3) continue
        nc     = clipPolygonHalfPlane(A, nc, 2, cellMinZ, true,  B) // Z >= minZ
        if (nc < 3) continue
        nc     = clipPolygonHalfPlane(B, nc, 2, cellMaxZ, false, A) // Z <= maxZ
        if (nc < 3) continue

        // Fan-triangulate surviving polygon → append to bucket, skip degenerate triangles
        const key = `${col}_${row}`
        let bucket = rawBuckets.get(key)
        if (!bucket) {
          bucket = { data: new Float32Array(1024 * 9), count: 0 }
          rawBuckets.set(key, bucket)
        }

        const floatsNeeded = (nc - 2) * 9
        if (bucket.count + floatsNeeded > bucket.data.length) {
          const next = new Float32Array(Math.max(bucket.data.length * 2, bucket.count + floatsNeeded))
          next.set(bucket.data.subarray(0, bucket.count))
          bucket.data = next
        }

        let ti = bucket.count
        for (let v = 1; v < nc - 1; v++) {
          const vi = v * 3
          const wi = (v + 1) * 3
          if (_isDegenerateTriangle(
            A[0], A[1], A[2],
            A[vi], A[vi + 1], A[vi + 2],
            A[wi], A[wi + 1], A[wi + 2]
          )) continue

          // Fan from A[0]: triangle (0, v, v+1)
          bucket.data[ti++] = A[0]; bucket.data[ti++] = A[1]; bucket.data[ti++] = A[2]
          bucket.data[ti++] = A[vi    ]; bucket.data[ti++] = A[vi + 1]; bucket.data[ti++] = A[vi + 2]
          bucket.data[ti++] = A[wi    ]; bucket.data[ti++] = A[wi + 1]; bucket.data[ti++] = A[wi + 2]
        }
        bucket.count = ti
      }
    }
  }

  const result = new Map()
  for (const [key, bucket] of rawBuckets) {
    if (bucket.count > 0) result.set(key, [bucket.data.subarray(0, bucket.count)])
  }
  return result
}
