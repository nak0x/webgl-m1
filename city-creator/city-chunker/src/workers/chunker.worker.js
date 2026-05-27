// Vite worker — imported in useChunker.js as:
// import ChunkerWorker from './workers/chunker.worker.js?worker'

import { sliceGeometry } from '../lib/clipper.js'
import { initMeshopt, optimizeOnly, simplifyAndOptimize } from '../lib/meshopt.js'
import { buildManifest } from '../lib/manifest.js'

// ---------------------------------------------------------------------------
// mat4 helpers for node world-transforms (column-major, glTF convention)
// ---------------------------------------------------------------------------

function _mat4Identity() {
  return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
}

function _mat4Mul(a, b) {
  const r = new Float64Array(16)
  for (let col = 0; col < 4; col++)
    for (let row = 0; row < 4; row++)
      for (let k = 0; k < 4; k++)
        r[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k]
  return r
}

function _nodeMatrix(node) {
  if (node.matrix) return new Float64Array(node.matrix)
  const T  = node.translation ?? [0, 0, 0]
  const Q  = node.rotation    ?? [0, 0, 0, 1]
  const S  = node.scale       ?? [1, 1, 1]
  const [qx, qy, qz, qw] = Q
  const x2 = qx*qx, y2 = qy*qy, z2 = qz*qz
  const xy = qx*qy, xz = qx*qz, yz = qy*qz
  const wx = qw*qx, wy = qw*qy, wz = qw*qz
  // column-major
  return new Float64Array([
    (1-2*(y2+z2))*S[0],  2*(xy+wz)*S[0],      2*(xz-wy)*S[0],      0,
    2*(xy-wz)*S[1],      (1-2*(x2+z2))*S[1],  2*(yz+wx)*S[1],      0,
    2*(xz+wy)*S[2],      2*(yz-wx)*S[2],      (1-2*(x2+y2))*S[2],  0,
    T[0], T[1], T[2], 1,
  ])
}

function _isIdentity(m) {
  return m[0]===1 && m[5]===1 && m[10]===1 && m[15]===1 &&
         m[1]===0 && m[2]===0 && m[3]===0  &&
         m[4]===0 && m[6]===0 && m[7]===0  &&
         m[8]===0 && m[9]===0 && m[11]===0 &&
         m[12]===0 && m[13]===0 && m[14]===0
}

function _applyMat4(positions, m) {
  const out = new Float32Array(positions.length)
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i+1], z = positions[i+2]
    out[i  ] = m[0]*x + m[4]*y + m[8]*z  + m[12]
    out[i+1] = m[1]*x + m[5]*y + m[9]*z  + m[13]
    out[i+2] = m[2]*x + m[6]*y + m[10]*z + m[14]
  }
  return out
}

// ---------------------------------------------------------------------------

function parseGLB(buffer) {
  const view = new DataView(buffer)
  if (view.getUint32(0, true) !== 0x46546C67) throw new Error('Not a GLB file')
  if (view.getUint32(4, true) !== 2) throw new Error('Unsupported glTF version')

  const jsonLen = view.getUint32(12, true)
  if (view.getUint32(16, true) !== 0x4E4F534A) throw new Error('Expected JSON chunk first')
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLen)))

  const binChunkOffset = 20 + jsonLen
  if (binChunkOffset >= view.getUint32(8, true)) throw new Error('No binary chunk in GLB')
  if (view.getUint32(binChunkOffset + 4, true) !== 0x004E4942) throw new Error('Expected BIN chunk')
  const binLen = view.getUint32(binChunkOffset, true)
  const binAb  = buffer.slice(binChunkOffset + 8, binChunkOffset + 8 + binLen)

  const posChunks = []  // Float32Array[]  — world-space positions per primitive
  const idxChunks = []  // Uint32Array[]   — indices offset to the merged vertex array
  let vertexBase  = 0

  // Walk the scene hierarchy so node world-transforms are applied correctly
  const rootNodes = json.scenes?.[json.scene ?? 0]?.nodes ?? json.scenes?.[0]?.nodes ?? []
  // Fall back to iterating every mesh directly if there is no scene
  const hasScene  = rootNodes.length > 0

  function visitNode(nodeIdx, parentMat) {
    const node  = json.nodes[nodeIdx]
    const local = _nodeMatrix(node)
    const world = _isIdentity(parentMat) ? local : _mat4Mul(parentMat, local)

    if (node.mesh !== undefined) {
      for (const prim of (json.meshes[node.mesh]?.primitives ?? [])) {
        collectPrim(prim, world)
      }
    }
    for (const child of (node.children ?? [])) visitNode(child, world)
  }

  function collectPrim(prim, worldMat) {
    if (prim.mode !== undefined && prim.mode !== 4) return  // skip non-TRIANGLES
    if (prim.extensions?.KHR_draco_mesh_compression) {
      throw new Error('Draco-compressed input is not supported. Re-export as an uncompressed GLB.')
    }

    const posIdx = prim.attributes?.POSITION
    if (posIdx === undefined) return

    const posAcc = json.accessors?.[posIdx]
    if (!posAcc) return
    if (posAcc.bufferView === undefined) {
      throw new Error('POSITION accessor has no bufferView. Re-export as an uncompressed GLB.')
    }

    const posBV   = json.bufferViews[posAcc.bufferView]
    const bvStart = posBV.byteOffset ?? 0
    const accOff  = posAcc.byteOffset ?? 0
    const stride  = posBV.byteStride ?? 0   // 0 means tightly packed
    const count   = posAcc.count

    let positions
    if (stride === 0 || stride === 12) {
      // Tightly packed float32 VEC3 — single slice, guaranteed alignment
      const start = bvStart + accOff
      positions = new Float32Array(binAb.slice(start, start + count * 12))
    } else {
      // Interleaved (e.g. POSITION+NORMAL in one buffer view) — extract with stride
      const dv = new DataView(binAb)
      positions = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) {
        const off = bvStart + accOff + i * stride
        positions[i * 3    ] = dv.getFloat32(off,     true)
        positions[i * 3 + 1] = dv.getFloat32(off + 4, true)
        positions[i * 3 + 2] = dv.getFloat32(off + 8, true)
      }
    }

    if (!_isIdentity(worldMat)) positions = _applyMat4(positions, worldMat)
    posChunks.push(positions)

    // Collect indices, rebasing to merged vertex array
    if (prim.indices !== undefined) {
      const idxAcc  = json.accessors[prim.indices]
      const idxBV   = json.bufferViews[idxAcc.bufferView]
      const idxStart = (idxBV.byteOffset ?? 0) + (idxAcc.byteOffset ?? 0)
      const count    = idxAcc.count
      const ct       = idxAcc.componentType
      const out      = new Uint32Array(count)
      if (ct === 5125) {
        const raw = new Uint32Array(binAb.slice(idxStart, idxStart + count * 4))
        for (let i = 0; i < count; i++) out[i] = raw[i] + vertexBase
      } else if (ct === 5123) {
        const raw = new Uint16Array(binAb.slice(idxStart, idxStart + count * 2))
        for (let i = 0; i < count; i++) out[i] = raw[i] + vertexBase
      } else if (ct === 5121) {
        const raw = new Uint8Array(binAb, idxStart, count)
        for (let i = 0; i < count; i++) out[i] = raw[i] + vertexBase
      }
      idxChunks.push(out)
    } else {
      // Non-indexed primitive — generate sequential indices
      const out = new Uint32Array(posAcc.count)
      for (let i = 0; i < posAcc.count; i++) out[i] = vertexBase + i
      idxChunks.push(out)
    }

    vertexBase += posAcc.count
  }

  if (hasScene) {
    const identity = _mat4Identity()
    for (const idx of rootNodes) visitNode(idx, identity)
  } else {
    // No scene — collect all meshes without transforms
    const identity = _mat4Identity()
    for (const mesh of (json.meshes ?? []))
      for (const prim of (mesh.primitives ?? [])) collectPrim(prim, identity)
  }

  if (vertexBase === 0) throw new Error('No geometry found in GLB')

  // Merge all position chunks into one flat array
  const positions = new Float32Array(vertexBase * 3)
  let pOff = 0
  for (const chunk of posChunks) { positions.set(chunk, pOff); pOff += chunk.length }

  // Merge all index chunks
  let totalIdx = 0
  for (const chunk of idxChunks) totalIdx += chunk.length
  const indices = new Uint32Array(totalIdx)
  let iOff = 0
  for (const chunk of idxChunks) { indices.set(chunk, iOff); iOff += chunk.length }

  return { positions, indices }
}

// ---------------------------------------------------------------------------
// Minimal glTF builder — self-contained, binary embedded as base64 data URI
// ---------------------------------------------------------------------------

function _toBase64(ab) {
  const bytes = new Uint8Array(ab)
  let str = ''
  const CHUNK = 0x8000  // 32 KB at a time — avoids stack overflow from large spread
  for (let i = 0; i < bytes.length; i += CHUNK) {
    str += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  return btoa(str)
}

function buildMinimalGLTF(positions, indices) {
  const vertCount  = positions.length / 3
  const indexCount = indices ? indices.length : 0

  // Compute AABB for the POSITION accessor (required by glTF spec).
  // Walk every float; if any non-finite slips through the upstream pipeline,
  // fail loudly here instead of writing a spec-violating accessor.
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2]
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      throw new Error(`buildMinimalGLTF: non-finite position at vertex ${i / 3}`)
    }
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (z < minZ) minZ = z
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
    if (z > maxZ) maxZ = z
  }

  const posBytes  = positions.byteLength
  const idxBytes  = indices ? indices.byteLength : 0
  const idxPadded = (idxBytes + 3) & ~3   // 4-byte align the index region
  const binLength = posBytes + idxPadded

  const accessors   = [{
    bufferView: 0, byteOffset: 0,
    componentType: 5126, count: vertCount,
    type: 'VEC3', min: [minX, minY, minZ], max: [maxX, maxY, maxZ]
  }]
  const bufferViews = [{
    buffer: 0, byteOffset: 0, byteLength: posBytes, target: 34962 // ARRAY_BUFFER
  }]
  const primitive   = { attributes: { POSITION: 0 }, mode: 4 } // TRIANGLES

  if (indices) {
    accessors.push({
      bufferView: 1, byteOffset: 0,
      componentType: 5125, count: indexCount, type: 'SCALAR'
    })
    bufferViews.push({
      buffer: 0, byteOffset: posBytes, byteLength: idxBytes, target: 34963 // ELEMENT_ARRAY_BUFFER
    })
    primitive.indices = 1
  }

  // Build the binary buffer then embed it as a data URI so the .gltf is self-contained
  const bin = new ArrayBuffer(binLength)
  const u8  = new Uint8Array(bin)
  u8.set(new Uint8Array(positions.buffer, positions.byteOffset, posBytes), 0)
  if (indices) {
    u8.set(new Uint8Array(indices.buffer, indices.byteOffset, idxBytes), posBytes)
    u8.fill(0, posBytes + idxBytes, posBytes + idxPadded)
  }

  const dataUri = 'data:application/octet-stream;base64,' + _toBase64(bin)

  const gltf = JSON.stringify({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes:  [{ mesh: 0 }],
    meshes: [{ primitives: [primitive] }],
    accessors, bufferViews,
    buffers: [{ uri: dataUri, byteLength: binLength }]
  }, null, 2)

  return { gltf }
}

// ---------------------------------------------------------------------------
// NaN / Infinity triangle filter — clipper outputs non-indexed 9-float triangles
// ---------------------------------------------------------------------------

function _filterNaNTriangles(src) {
  const triCount = src.length / 9
  let goodCount  = 0
  for (let t = 0; t < triCount; t++) {
    let ok = true
    for (let f = t * 9; f < t * 9 + 9; f++) {
      if (!isFinite(src[f])) { ok = false; break }
    }
    if (ok) goodCount++
  }
  if (goodCount === triCount) return src  // nothing to filter

  const out = new Float32Array(goodCount * 9)
  let wi = 0
  for (let t = 0; t < triCount; t++) {
    let ok = true
    for (let f = t * 9; f < t * 9 + 9; f++) {
      if (!isFinite(src[f])) { ok = false; break }
    }
    if (ok) { out.set(src.subarray(t * 9, t * 9 + 9), wi); wi += 9 }
  }
  return out
}

// ---------------------------------------------------------------------------
// Collision bitmap — rasterisation, packing, BMP export
// ---------------------------------------------------------------------------

function rasteriseTriangleXZ(
  x0, z0, x1, z1, x2, z2,
  worldMinX, worldMinZ, pfX, pfZ,
  pixelWidth, pixelHeight, bitmap
) {
  let px0 = Math.floor((x0 - worldMinX) * pfX)
  let pz0 = Math.floor((z0 - worldMinZ) * pfZ)
  let px1 = Math.floor((x1 - worldMinX) * pfX)
  let pz1 = Math.floor((z1 - worldMinZ) * pfZ)
  let px2 = Math.floor((x2 - worldMinX) * pfX)
  let pz2 = Math.floor((z2 - worldMinZ) * pfZ)

  // Sort vertices by pz ascending (bubble sort — 3 elements)
  if (pz0 > pz1) { let t=px0;px0=px1;px1=t; t=pz0;pz0=pz1;pz1=t }
  if (pz1 > pz2) { let t=px1;px1=px2;px2=t; t=pz1;pz1=pz2;pz2=t }
  if (pz0 > pz1) { let t=px0;px0=px1;px1=t; t=pz0;pz0=pz1;pz1=t }

  const totalHeight = pz2 - pz0
  if (totalHeight === 0) return

  for (let pz = pz0; pz <= pz2; pz++) {
    if (pz < 0 || pz >= pixelHeight) continue

    const secondHalf = pz >= pz1
    const segHeight  = secondHalf ? (pz2 - pz1) : (pz1 - pz0)

    const alpha = (pz - pz0) / totalHeight
    const beta  = segHeight === 0 ? 0
                : secondHalf ? (pz - pz1) / segHeight
                             : (pz - pz0) / segHeight

    let xA = px0 + (px2 - px0) * alpha
    let xB = secondHalf
      ? px1 + (px2 - px1) * beta
      : px0 + (px1 - px0) * beta

    if (xA > xB) { let t = xA; xA = xB; xB = t }

    const xLeft  = Math.max(0, Math.floor(xA))
    const xRight = Math.min(pixelWidth - 1, Math.ceil(xB))

    for (let px = xLeft; px <= xRight; px++) {
      bitmap[pz * pixelWidth + px] = 1
    }
  }
}

// BMP export threshold — at resolutions above this, the 24-bit BMP would be
// hundreds of MB per chunk and cause OOM; skip it and only export the .bin.
const BMP_MAX_RESOLUTION = 2048

function packBitfield(bitmap, pixelWidth, pixelHeight) {
  const bitfieldSize = Math.ceil((pixelWidth * pixelHeight) / 8)
  const bitfield = new Uint8Array(bitfieldSize)
  for (let i = 0; i < pixelWidth * pixelHeight; i++) {
    if (bitmap[i]) bitfield[i >> 3] |= (1 << (i & 7))
  }
  return bitfield.buffer
}

function buildBMP(bitmap, width, height) {
  const rowStride    = (width * 3 + 3) & ~3
  const pixelDataSize = rowStride * height
  const fileSize     = 54 + pixelDataSize

  const buf  = new ArrayBuffer(fileSize)
  const view = new DataView(buf)

  // File header (14 bytes)
  view.setUint16(0, 0x4D42, true)
  view.setUint32(2, fileSize, true)
  view.setUint32(6, 0, true)
  view.setUint32(10, 54, true)

  // DIB header — BITMAPINFOHEADER (40 bytes)
  view.setUint32(14, 40, true)
  view.setInt32(18, width, true)
  view.setInt32(22, height, true)
  view.setUint16(26, 1, true)
  view.setUint16(28, 24, true)
  view.setUint32(30, 0, true)
  view.setUint32(34, pixelDataSize, true)
  view.setInt32(38, 2835, true)
  view.setInt32(42, 2835, true)
  view.setUint32(46, 0, true)
  view.setUint32(50, 0, true)

  // Pixel data — BMP is bottom-to-top
  const bytes = new Uint8Array(buf)
  for (let row = 0; row < height; row++) {
    const bmpRow = height - 1 - row
    const srcBase = row * width
    const dstBase = 54 + bmpRow * rowStride
    for (let col = 0; col < width; col++) {
      const val = bitmap[srcBase + col] ? 255 : 0
      bytes[dstBase + col * 3    ] = val
      bytes[dstBase + col * 3 + 1] = val
      bytes[dstBase + col * 3 + 2] = val
    }
  }
  return buf
}

// ---------------------------------------------------------------------------
// Worker entry point
// ---------------------------------------------------------------------------

self.onmessage = async function ({ data }) {
  if (data.type !== 'start') return

  const {
    districts, offsets = [], chunkSize, lodRatios, lodErrors, previewOnly = false,
    collisionMap: collisionMapConfig = { enabled: false },
  } = data

  try {
    await initMeshopt()

    // --- Merge + clip pass — one district at a time for memory safety ---
    const globalBuckets = new Map() // chunkId → Float32Array[] (to concatenate)

    for (let i = 0; i < districts.length; i++) {
      self.postMessage({ type: 'progress', stage: 'merge', district: i, pct: 0 })

      let positions, indices
      try {
        ;({ positions, indices } = parseGLB(districts[i]))
      } catch (err) {
        self.postMessage({ type: 'error', message: `District ${i}: ${err.message}`, district: i })
        continue  // skip failed district, continue with remaining
      }

      self.postMessage({ type: 'progress', stage: 'merge', district: i, pct: 1 })

      // Bounding-box centre — matches the pivot PreviewCanvas uses (Box3.getCenter).
      // Using vertex average instead would drift from the visual preview for
      // any geometry that isn't perfectly symmetric.
      let bbMinX = Infinity, bbMaxX = -Infinity, bbMinZ = Infinity, bbMaxZ = -Infinity
      for (let j = 0; j < positions.length; j += 3) {
        const x = positions[j], z = positions[j + 2]
        if (x < bbMinX) bbMinX = x; if (x > bbMaxX) bbMaxX = x
        if (z < bbMinZ) bbMinZ = z; if (z > bbMaxZ) bbMaxZ = z
      }
      const cx = (bbMinX + bbMaxX) / 2
      const cz = (bbMinZ + bbMaxZ) / 2

      // Apply placement transform: rotate around centroid, then translate centroid to world position.
      // Default (no offset): wx=cx, wz=cz, angle=0 → identity (district stays at original GLB position).
      const off   = offsets[i]
      const wx    = off?.x     ?? cx
      const wz    = off?.z     ?? cz
      const angle = off?.angle ?? 0

      if (wx !== cx || wz !== cz || angle !== 0) {
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        for (let j = 0; j < positions.length; j += 3) {
          const lx = positions[j    ] - cx   // centred local X
          const lz = positions[j + 2] - cz   // centred local Z
          // Three.js Y-up right-hand rotation: x' = x·cos + z·sin, z' = -x·sin + z·cos
          positions[j    ] = lx * cos + lz * sin + wx
          positions[j + 2] = -lx * sin + lz * cos + wz
        }
      }

      self.postMessage({ type: 'progress', stage: 'clip',  district: i, pct: 0 })

      const districtBuckets = sliceGeometry(positions, indices, chunkSize, 0, 0,
        (pct) => self.postMessage({ type: 'progress', stage: 'clip', district: i, pct })
      )

      for (const [key, arrays] of districtBuckets) {
        if (!globalBuckets.has(key)) globalBuckets.set(key, [])
        for (const arr of arrays) globalBuckets.get(key).push(arr)
      }

      self.postMessage({ type: 'progress', stage: 'clip', district: i, pct: 1 })

      // Hint to the engine that the parsed geometry can be collected now
      positions = null
      indices   = null
    }

    // --- Per-chunk collision bitmaps (generated while globalBuckets is fully intact) ---
    // Each chunk is transferred immediately after rasterisation to avoid accumulating
    // all bitmaps in memory simultaneously (192 MB/chunk at 8192 px would OOM quickly).
    if (collisionMapConfig.enabled && globalBuckets.size > 0) {
      self.postMessage({ type: 'progress', stage: 'collision', pct: 0 })

      const resolution  = collisionMapConfig.resolution  ?? 1024
      const minY        = collisionMapConfig.minY        ?? 0
      const maxY        = collisionMapConfig.maxY        ?? 2
      const sliceCount  = collisionMapConfig.sliceCount  ?? 10
      const pf          = resolution / chunkSize
      const wantBmp     = resolution <= BMP_MAX_RESOLUTION

      const slices = new Float64Array(sliceCount)
      if (sliceCount === 1) {
        slices[0] = (minY + maxY) / 2
      } else {
        const step = (maxY - minY) / (sliceCount - 1)
        for (let s = 0; s < sliceCount; s++) slices[s] = minY + s * step
      }

      let totalTriangles = 0
      for (const arrays of globalBuckets.values())
        for (const arr of arrays) totalTriangles += arr.length / 9
      let processed = 0

      for (const [chunkId, arrays] of globalBuckets) {
        const [col, row] = chunkId.split('_').map(Number)
        const worldMinX  = col * chunkSize
        const worldMinZ  = row * chunkSize

        let bitmap = new Uint8Array(resolution * resolution)

        for (const arr of arrays) {
          const count = arr.length
          for (let i = 0; i < count; i += 9) {
            const y0 = arr[i+1], y1 = arr[i+4], y2 = arr[i+7]
            const yMin = Math.min(y0, y1, y2)
            const yMax = Math.max(y0, y1, y2)

            if (yMax >= minY && yMin <= maxY) {
              for (let s = 0; s < sliceCount; s++) {
                if (yMin <= slices[s] && yMax >= slices[s]) {
                  rasteriseTriangleXZ(
                    arr[i],   arr[i+2],
                    arr[i+3], arr[i+5],
                    arr[i+6], arr[i+8],
                    worldMinX, worldMinZ, pf, pf,
                    resolution, resolution, bitmap
                  )
                  break
                }
              }
            }

            processed++
            if (processed % 100_000 === 0)
              self.postMessage({ type: 'progress', stage: 'collision', pct: processed / totalTriangles })
          }
        }

        const binBuffer = packBitfield(bitmap, resolution, resolution)
        const bmpBuffer = wantBmp ? buildBMP(bitmap, resolution, resolution) : null
        bitmap = null  // allow GC before transfer

        const transferList = [binBuffer]
        if (bmpBuffer) transferList.push(bmpBuffer)

        self.postMessage(
          { type: 'collision_chunk_done', chunkId, bin: binBuffer, bmp: bmpBuffer },
          transferList
        )
      }

      self.postMessage({ type: 'collision_done', meta: { resolution, chunkSize, pf, minY, maxY, sliceCount } })
    }

    // --- Simplify + export pass ---
    const activeLods = previewOnly ? 1 : lodRatios.length
    const totalOps   = globalBuckets.size * activeLods
    let done         = 0
    const manifestChunks = []

    for (const [chunkId, arrays] of globalBuckets) {
      // Concatenate all position arrays for this chunk
      let totalFloats = 0
      for (const arr of arrays) totalFloats += arr.length
      let merged = new Float32Array(totalFloats)
      let offset   = 0
      for (const arr of arrays) {
        merged.set(arr, offset)
        offset += arr.length
      }

      // Drop any triangle that contains a non-finite coordinate.
      // The clipper outputs non-indexed triangles (9 floats each); NaN can slip in
      // when source accessors are interleaved or contain degenerate geometry.
      merged = _filterNaNTriangles(merged)

      if (merged.length === 0) {
        done += activeLods
        continue
      }

      // Compute AABB from merged (LOD0) positions
      let minX = Infinity, minY = Infinity, minZ = Infinity
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
      for (let j = 0; j < merged.length; j += 3) {
        if (merged[j    ] < minX) minX = merged[j    ]
        if (merged[j + 1] < minY) minY = merged[j + 1]
        if (merged[j + 2] < minZ) minZ = merged[j + 2]
        if (merged[j    ] > maxX) maxX = merged[j    ]
        if (merged[j + 1] > maxY) maxY = merged[j + 1]
        if (merged[j + 2] > maxZ) maxZ = merged[j + 2]
      }

      const [col, row] = chunkId.split('_').map(Number)
      const aabb = { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] }
      const lods = []

      for (let lod = 0; lod < activeLods; lod++) {
        self.postMessage({ type: 'progress', stage: 'simplify', lod, chunk: chunkId, pct: done / totalOps })

        // LOD0: skip simplify (ratio=1.0) — only deduplicate + optimize cache/fetch
        const { positions: outPos, indices: outIdx } = lodRatios[lod] === 1.0
          ? optimizeOnly(merged)
          : simplifyAndOptimize(merged, lodRatios[lod], lodErrors[lod])

        const triCount = outIdx.length / 3

        if (!previewOnly) {
          const { gltf } = buildMinimalGLTF(outPos, outIdx)
          self.postMessage({ type: 'chunk_done', chunkId, lod, gltf, triCount })
        }

        lods.push({ file: `chunk_${col}_${row}_lod${lod}.gltf`, triCount })
        done++
      }

      manifestChunks.push({ id: chunkId, col, row, aabb, lods })
      globalBuckets.delete(chunkId)  // free Float32Arrays for this chunk — allow GC
    }

    self.postMessage({ type: 'done', manifest: buildManifest(manifestChunks, chunkSize, [0, 0]) })

  } catch (err) {
    self.postMessage({ type: 'error', message: err.message })
  }
}
