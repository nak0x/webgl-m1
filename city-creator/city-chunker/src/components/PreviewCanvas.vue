<script setup>
import { ref, shallowRef, watch, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useToast } from '../composables/useToast.js'

const props = defineProps({
  districts:        { type: Array,   default: () => [] },
  offsets:          { type: Array,   default: () => [] },
  chunkSize:        { type: Number,  default: 64 },
  manifest:         { type: Object,  default: null },
  collisionData:    { type: Object,  default: null },  // { bin: ArrayBuffer, meta }
  showCollisionMap: { type: Boolean, default: false },
})

const emit = defineEmits(['offset-changed'])

const { info, warn, error: toastError } = useToast()

const containerRef = ref(null)
const renderer     = shallowRef(null)
const camera       = shallowRef(null)
const controls     = shallowRef(null)
const scene        = shallowRef(null)

let districtRoot = null
let gridGroup    = null
let aabbGroup    = null

// Per-district objects (indexed by district order)
let districtGroups  = []   // THREE.Group[] — pivot at centroid, positioned at {x,z}
let translateHandles = []  // THREE.Mesh[] — invisible inner disc, hit → translate
let rotateHandles    = []  // THREE.Mesh[] — invisible outer annulus, hit → rotate
let translateRings   = []  // THREE.Mesh[] — visible inner torus (district colour)
let rotateRings      = []  // THREE.Mesh[] — visible outer torus (gold)

const DISTRICT_COLORS = [0x3d9eff, 0xf0a742, 0x2ea043, 0xe25555, 0xc9a0ff]
const ROTATE_COLOR    = 0xf0c040

let rafId     = null
let resizeObs = null
let loadGen   = 0

// ── Drag state ────────────────────────────────────────────────────────────────
const isDragging = ref(false)
let _dragMode         = ''      // 'translate' | 'rotate'
let _dragIdx          = -1
let _hoveredIdx       = -1
let _hoveredMode      = ''

// translate drag
const _dragPlane  = new THREE.Plane()
const _dragOffset = new THREE.Vector3()   // click-point − group pivot

// rotate drag
let _dragStartAngle    = 0
let _dragStartRotation = 0

const _raycaster = new THREE.Raycaster()
const _mouseNDC  = new THREE.Vector2()
const _hitPoint  = new THREE.Vector3()

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('/draco/')
const loader = new GLTFLoader()
loader.setDRACOLoader(dracoLoader)

// ── Scene init ────────────────────────────────────────────────────────────────

function initScene(el) {
  const w = el.clientWidth || 800
  const h = el.clientHeight || 600

  const r = new THREE.WebGLRenderer({ antialias: true })
  r.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  r.setSize(w, h)
  r.setClearColor(0x0d1117)
  el.appendChild(r.domElement)
  renderer.value = r

  const s = new THREE.Scene()
  scene.value = s

  districtRoot = new THREE.Group()
  gridGroup    = new THREE.Group()
  aabbGroup    = new THREE.Group()
  s.add(districtRoot, gridGroup, aabbGroup)

  const cam  = new THREE.PerspectiveCamera(55, w / h, 1, 5000)
  cam.position.set(150, 200, 300)
  camera.value = cam

  const ctrl = new OrbitControls(cam, r.domElement)
  ctrl.enableDamping = true
  ctrl.dampingFactor  = 0.05
  controls.value = ctrl

  function tick() {
    rafId = requestAnimationFrame(tick)
    ctrl.update()
    r.render(s, cam)
  }
  tick()

  const dom = r.domElement
  dom.addEventListener('pointerdown',  onPointerDown)
  dom.addEventListener('pointermove',  onPointerMove)
  dom.addEventListener('pointerup',    onPointerUp)
  dom.addEventListener('pointerleave', onPointerUp)

  resizeObs = new ResizeObserver(() => {
    const rw = el.clientWidth, rh = el.clientHeight
    if (!rw || !rh) return
    cam.aspect = rw / rh
    cam.updateProjectionMatrix()
    r.setSize(rw, rh)
  })
  resizeObs.observe(el)
}

// ── Disposal ──────────────────────────────────────────────────────────────────

function _disposeGroup(g) {
  g.traverse(obj => {
    if (!obj.isMesh) return
    obj.geometry?.dispose()
    if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
    else obj.material?.dispose()
  })
}

function _clearDistrictGroups() {
  for (const g of districtGroups) { _disposeGroup(g); districtRoot?.remove(g) }
  districtGroups  = []
  translateHandles = []
  rotateHandles    = []
  translateRings   = []
  rotateRings      = []
  _dragIdx = -1; _hoveredIdx = -1; _dragMode = ''; _hoveredMode = ''
}

function _clearGroup(g) {
  while (g.children.length) {
    const c = g.children[0]
    if (c.isMesh || c.isLine || c.isLineSegments) { c.geometry?.dispose(); c.material?.dispose() }
    g.remove(c)
  }
}

// ── Collision map overlay ─────────────────────────────────────────────────────

let collisionMesh = null

function _disposeCollisionMesh() {
  if (!collisionMesh) return
  scene.value?.remove(collisionMesh)
  collisionMesh.geometry?.dispose()
  collisionMesh.material?.map?.dispose()
  collisionMesh.material?.dispose()
  collisionMesh = null
}

function _buildCollisionPlane(data) {
  _disposeCollisionMesh()
  if (!data || !scene.value) return

  const { bin, meta } = data
  const { pixelWidth, pixelHeight, worldMinX, worldMinZ, pfX, pfZ, minY, maxY } = meta
  const sampleHeight = (minY + maxY) / 2

  const bitfield = new Uint8Array(bin)
  const imgData  = new ImageData(pixelWidth, pixelHeight)
  for (let i = 0; i < pixelWidth * pixelHeight; i++) {
    const bit  = (bitfield[i >> 3] >> (i & 7)) & 1
    const base = i * 4
    imgData.data[base    ] = 255
    imgData.data[base + 1] = 255
    imgData.data[base + 2] = 255
    imgData.data[base + 3] = bit ? 140 : 0
  }

  const canvas = document.createElement('canvas')
  canvas.width  = pixelWidth
  canvas.height = pixelHeight
  canvas.getContext('2d').putImageData(imgData, 0, 0)

  // Plane size derived from the pixel grid, not the raw world extent:
  // pixelWidth/pfX == worldW by construction (round(worldW*pf)/pf),
  // so the plane always matches exactly what the rasteriser covered.
  const planeW = pixelWidth  / pfX
  const planeD = pixelHeight / pfZ

  const texture  = new THREE.CanvasTexture(canvas)
  texture.flipY  = true   // canvas row 0 (worldMinZ) → UV v=1 → worldMinZ in scene
  const geo      = new THREE.PlaneGeometry(planeW, planeD)
  const mat      = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, depthTest: false, side: THREE.DoubleSide,
  })

  collisionMesh = new THREE.Mesh(geo, mat)
  collisionMesh.rotation.x  = -Math.PI / 2
  collisionMesh.position.set(worldMinX + planeW / 2, sampleHeight, worldMinZ + planeD / 2)
  collisionMesh.renderOrder = 1

  if (props.showCollisionMap) scene.value.add(collisionMesh)
}

// ── District loading ──────────────────────────────────────────────────────────

async function loadDistricts(files) {
  const gen = ++loadGen
  _clearDistrictGroups()
  if (gridGroup) _clearGroup(gridGroup)
  if (aabbGroup) _clearGroup(aabbGroup)
  if (!files?.length) return

  let loaded = 0

  for (let i = 0; i < files.length; i++) {
    if (gen !== loadGen) return
    const file  = files[i]
    const color = DISTRICT_COLORS[i % DISTRICT_COLORS.length]
    const url   = URL.createObjectURL(file)

    try {
      info(`Loading ${file.name}…`)
      const gltf = await loader.loadAsync(url)
      if (gen !== loadGen) return

      const geos = []
      gltf.scene.updateMatrixWorld(true)
      gltf.scene.traverse(obj => {
        if (!obj.isMesh || !obj.geometry?.attributes?.position) return
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', obj.geometry.attributes.position.clone())
        if (obj.geometry.index) g.setIndex(obj.geometry.index.clone())
        g.applyMatrix4(obj.matrixWorld)
        geos.push(g)
      })
      if (!geos.length) { warn('No meshes found', file.name); continue }

      let merged
      try { merged = mergeGeometries(geos, true); geos.forEach(g => g.dispose()) }
      catch { merged = geos[0]; geos.slice(1).forEach(g => g.dispose()) }

      // Centroid in geometry (GLB) local space — used as group pivot
      const localBox = new THREE.Box3().setFromBufferAttribute(merged.attributes.position)
      const centroid = localBox.getCenter(new THREE.Vector3())
      const cx = centroid.x, cz = centroid.z
      const floorY = localBox.min.y

      const wireMat = new THREE.MeshBasicMaterial({ color, wireframe: true, opacity: 0.35, transparent: true })
      const mesh    = new THREE.Mesh(merged, wireMat)
      // Shift mesh so group local origin = centroid
      mesh.position.set(-cx, 0, -cz)

      const group = new THREE.Group()
      group.add(mesh)
      districtRoot.add(group)
      districtGroups[i] = group

      // Restore saved transform, or emit natural position so App.vue learns it
      const saved = props.offsets[i]
      if (saved && saved.x !== undefined) {
        group.position.set(saved.x, 0, saved.z)
        group.rotation.y = saved.angle ?? 0
      } else {
        // Natural: centroid stays at its GLB world position
        group.position.set(cx, 0, cz)
        group.rotation.y = 0
        emit('offset-changed', { index: i, x: cx, z: cz, angle: 0 })
      }

      const size  = localBox.getSize(new THREE.Vector3())
      const ringR = Math.max(size.x, size.z) * 0.06
      _buildGizmo(i, group, floorY, ringR, color)

      const triCount = (merged.index?.count ?? merged.attributes.position.count) / 3
      info(`Loaded ${file.name}`, `${Math.round(triCount / 1000)}k triangles`)
      loaded++
    } catch (err) {
      toastError(`Failed to load ${file.name}`, err?.message ?? String(err))
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  if (gen !== loadGen) return
  if (loaded > 0) { fitCamera(); rebuildGrid() }
}

// ── Gizmo ─────────────────────────────────────────────────────────────────────
// All gizmo children sit in group-local space.
// Local origin (0,0,0) = geometry centroid = rotation pivot.

function _buildGizmo(idx, group, floorY, ringR, color) {
  const gY  = floorY + 0.3   // slightly above the geometry floor
  const rotR = ringR * 2.2   // outer rotation ring radius

  // ── Translation ring (inner, district colour)
  const trGeo = new THREE.TorusGeometry(ringR, Math.max(ringR * 0.07, 0.4), 8, 48)
  trGeo.rotateX(Math.PI / 2)
  const trMat  = new THREE.MeshBasicMaterial({ color, depthTest: false })
  const trMesh = new THREE.Mesh(trGeo, trMat)
  trMesh.position.set(0, gY, 0)
  trMesh.renderOrder = 2
  group.add(trMesh)
  translateRings[idx] = trMesh

  // ── Rotation ring (outer, gold)
  const rrGeo = new THREE.TorusGeometry(rotR, Math.max(rotR * 0.04, 0.3), 8, 64)
  rrGeo.rotateX(Math.PI / 2)
  const rrMat  = new THREE.MeshBasicMaterial({ color: ROTATE_COLOR, depthTest: false })
  const rrMesh = new THREE.Mesh(rrGeo, rrMat)
  rrMesh.position.set(0, gY, 0)
  rrMesh.renderOrder = 2
  group.add(rrMesh)
  rotateRings[idx] = rrMesh

  // ── Axis arrows (visual only, no raycasting)
  const al = ringR * 1.5, ah = al * 0.25, ar = ah * 0.5
  const axX = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(0,gY,0), al, 0xff4444, ah, ar)
  const axZ = new THREE.ArrowHelper(new THREE.Vector3(0,0,1), new THREE.Vector3(0,gY,0), al, 0x4488ff, ah, ar)
  axX.renderOrder = 2; axZ.renderOrder = 2
  group.add(axX, axZ)

  // ── Invisible translation hit disc (inner, slightly larger than translation ring)
  const thGeo = new THREE.CircleGeometry(ringR * 1.4, 32)
  thGeo.rotateX(-Math.PI / 2)
  const thMesh = new THREE.Mesh(thGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }))
  thMesh.position.set(0, gY - 0.05, 0)
  thMesh.userData.districtIdx = idx
  thMesh.userData.dragMode    = 'translate'
  group.add(thMesh)
  translateHandles[idx] = thMesh

  // ── Invisible rotation hit annulus (outer ring, no overlap with inner disc)
  const rhGeo = new THREE.RingGeometry(ringR * 1.7, rotR * 1.3, 64)
  rhGeo.rotateX(-Math.PI / 2)
  const rhMesh = new THREE.Mesh(rhGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }))
  rhMesh.position.set(0, gY - 0.05, 0)
  rhMesh.userData.districtIdx = idx
  rhMesh.userData.dragMode    = 'rotate'
  group.add(rhMesh)
  rotateHandles[idx] = rhMesh
}

// ── Camera ────────────────────────────────────────────────────────────────────

function fitCamera() {
  const cam = camera.value, ctrl = controls.value
  if (!cam || !ctrl || !districtRoot) return
  districtRoot.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(districtRoot)
  if (box.isEmpty()) return
  const center = box.getCenter(new THREE.Vector3())
  const size   = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)
  cam.near = maxDim * 0.0005
  cam.far  = maxDim * 20
  cam.updateProjectionMatrix()
  const dist = maxDim * 1.4
  cam.position.set(center.x, center.y + dist * 0.35, center.z + dist * 0.85)
  ctrl.target.copy(center)
  ctrl.update()
}

// ── Grid ──────────────────────────────────────────────────────────────────────

function rebuildGrid() {
  if (!gridGroup || !aabbGroup || !districtRoot) return
  _clearGroup(gridGroup)
  _clearGroup(aabbGroup)
  if (!districtGroups.length) return

  const cs = props.chunkSize
  if (!cs || cs <= 0) return

  districtRoot.updateMatrixWorld(true)
  const cityBox = new THREE.Box3().setFromObject(districtRoot)
  if (cityBox.isEmpty()) return

  const { min, max } = cityBox
  const gridMinX = Math.floor(min.x / cs) * cs
  const gridMaxX = Math.ceil(max.x  / cs) * cs
  const gridMinZ = Math.floor(min.z / cs) * cs
  const gridMaxZ = Math.ceil(max.z  / cs) * cs
  const gridY    = (min.y + max.y) * 0.5
  const cols = Math.round((gridMaxX - gridMinX) / cs)
  const rows = Math.round((gridMaxZ - gridMinZ) / cs)
  if (cols <= 0 || rows <= 0) return

  const verts = []
  for (let c = 0; c <= cols; c++) { const x = gridMinX + c * cs; verts.push(x, gridY, gridMinZ, x, gridY, gridMaxZ) }
  for (let r = 0; r <= rows; r++) { const z = gridMinZ + r * cs; verts.push(gridMinX, gridY, z, gridMaxX, gridY, z) }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3))
  gridGroup.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x1c2d3e })))

  const ac = new THREE.Color(0xff6622)
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const cb = new THREE.Box3(
        new THREE.Vector3(gridMinX + c * cs,       min.y, gridMinZ + r * cs),
        new THREE.Vector3(gridMinX + (c + 1) * cs, max.y, gridMinZ + (r + 1) * cs)
      )
      if (cb.intersectsBox(cityBox)) aabbGroup.add(new THREE.Box3Helper(cb, ac))
    }
  }
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

function _heatColor(t) {
  const out = new THREE.Color()
  out.lerpColors(
    t < 0.5 ? new THREE.Color(0x2ea043) : new THREE.Color(0xf0a742),
    t < 0.5 ? new THREE.Color(0xf0a742) : new THREE.Color(0xe25555),
    t < 0.5 ? t * 2 : (t - 0.5) * 2
  )
  return out
}

function updateHeatmap(mf) {
  if (!aabbGroup) return
  _clearGroup(aabbGroup)
  const counts = mf.chunks.map(c => c.lods[0]?.triCount ?? 0)
  const minT = Math.min(...counts), range = (Math.max(...counts) - minT) || 1
  for (const chunk of mf.chunks) {
    const box = new THREE.Box3(new THREE.Vector3(...chunk.aabb.min), new THREE.Vector3(...chunk.aabb.max))
    aabbGroup.add(new THREE.Box3Helper(box, _heatColor(((chunk.lods[0]?.triCount ?? 0) - minT) / range)))
  }
}

// ── Pointer helpers ───────────────────────────────────────────────────────────

function _toNDC(e) {
  const rect = renderer.value.domElement.getBoundingClientRect()
  _mouseNDC.set(
    (e.clientX - rect.left) / rect.width * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  )
}

// Raycast all handles; return { idx, mode } or null
function _findHandle() {
  const all = [
    ...translateHandles.filter(Boolean),
    ...rotateHandles.filter(Boolean),
  ]
  if (!all.length) return null
  _raycaster.setFromCamera(_mouseNDC, camera.value)
  const hits = _raycaster.intersectObjects(all)
  if (!hits.length) return null
  const { districtIdx, dragMode } = hits[0].object.userData
  return { idx: districtIdx, mode: dragMode }
}

function _emitOffset(idx) {
  const g = districtGroups[idx]
  if (!g) return
  emit('offset-changed', { index: idx, x: g.position.x, z: g.position.z, angle: g.rotation.y })
}

// ── Pointer events ────────────────────────────────────────────────────────────

function onPointerDown(e) {
  if (!renderer.value || !camera.value) return
  _toNDC(e)
  const hit = _findHandle()
  if (!hit) return

  e.stopPropagation()
  _dragIdx  = hit.idx
  _dragMode = hit.mode
  isDragging.value = true
  controls.value.enabled = false
  renderer.value.domElement.setPointerCapture(e.pointerId)

  // Drag plane at gizmo Y (group local gizmoY ≈ floorY + 0.3, world Y ≈ same since group Y = 0)
  const gY  = translateHandles[hit.idx]?.position.y ?? 0.3
  const gWY = districtGroups[hit.idx].position.y + gY
  _dragPlane.setFromNormalAndCoplanarPoint(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, gWY, 0)
  )

  _raycaster.setFromCamera(_mouseNDC, camera.value)
  _raycaster.ray.intersectPlane(_dragPlane, _hitPoint)

  if (hit.mode === 'translate') {
    const gp = districtGroups[hit.idx].position
    _dragOffset.set(_hitPoint.x - gp.x, 0, _hitPoint.z - gp.z)
  } else {
    // Rotation: record starting angle from pivot to cursor
    const gp = districtGroups[hit.idx].position
    _dragStartAngle    = Math.atan2(_hitPoint.z - gp.z, _hitPoint.x - gp.x)
    _dragStartRotation = districtGroups[hit.idx].rotation.y
  }
}

function onPointerMove(e) {
  if (!renderer.value || !camera.value) return
  _toNDC(e)

  if (isDragging.value && _dragIdx >= 0) {
    _raycaster.setFromCamera(_mouseNDC, camera.value)
    if (!_raycaster.ray.intersectPlane(_dragPlane, _hitPoint)) return

    if (_dragMode === 'translate') {
      districtGroups[_dragIdx].position.x = _hitPoint.x - _dragOffset.x
      districtGroups[_dragIdx].position.z = _hitPoint.z - _dragOffset.z
    } else {
      // Rotation: angle from pivot to cursor minus start angle
      const gp = districtGroups[_dragIdx].position
      const cur = Math.atan2(_hitPoint.z - gp.z, _hitPoint.x - gp.x)
      districtGroups[_dragIdx].rotation.y = _dragStartRotation + (cur - _dragStartAngle)
    }

    _emitOffset(_dragIdx)
    rebuildGrid()
    return
  }

  // Hover highlight
  const hit = _findHandle()
  const idx  = hit?.idx  ?? -1
  const mode = hit?.mode ?? ''

  if (idx !== _hoveredIdx || mode !== _hoveredMode) {
    // Restore previous
    if (_hoveredIdx >= 0) {
      if (translateRings[_hoveredIdx])  translateRings[_hoveredIdx].material.color.set(DISTRICT_COLORS[_hoveredIdx % DISTRICT_COLORS.length])
      if (rotateRings[_hoveredIdx])     rotateRings[_hoveredIdx].material.color.set(ROTATE_COLOR)
    }
    _hoveredIdx  = idx
    _hoveredMode = mode
    // Highlight new
    if (idx >= 0) {
      if (mode === 'translate' && translateRings[idx]) translateRings[idx].material.color.set(0xffffff)
      if (mode === 'rotate'    && rotateRings[idx])    rotateRings[idx].material.color.set(0xffffff)
    }
  }

  let cursor = 'default'
  if (idx >= 0) cursor = mode === 'rotate' ? 'crosshair' : 'grab'
  renderer.value.domElement.style.cursor = cursor
}

function onPointerUp(e) {
  if (!isDragging.value) return
  isDragging.value = false
  _dragMode = ''
  _dragIdx  = -1
  controls.value.enabled = true
  try { renderer.value?.domElement.releasePointerCapture(e.pointerId) } catch {}
  renderer.value.domElement.style.cursor = _hoveredIdx >= 0 ? (_hoveredMode === 'rotate' ? 'crosshair' : 'grab') : 'default'
}

// ── Watchers ──────────────────────────────────────────────────────────────────

watch(() => props.districts,        loadDistricts, { immediate: false })
watch(() => props.chunkSize,        rebuildGrid)
watch(() => props.manifest,         mf => { if (mf) updateHeatmap(mf) })
watch(() => props.collisionData,    data => _buildCollisionPlane(data))
watch(() => props.showCollisionMap, show => {
  if (!collisionMesh || !scene.value) return
  if (show) scene.value.add(collisionMesh)
  else      scene.value.remove(collisionMesh)
})

// Sync group transforms when offsets change externally (e.g. parent reset)
watch(() => props.offsets, newOffsets => {
  if (isDragging.value) return
  newOffsets?.forEach((off, i) => {
    if (!districtGroups[i] || !off) return
    districtGroups[i].position.x = off.x ?? 0
    districtGroups[i].position.z = off.z ?? 0
    districtGroups[i].rotation.y = off.angle ?? 0
  })
  rebuildGrid()
}, { deep: true })

onMounted(() => { if (containerRef.value) initScene(containerRef.value) })

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
  resizeObs?.disconnect()
  const dom = renderer.value?.domElement
  if (dom) {
    dom.removeEventListener('pointerdown',  onPointerDown)
    dom.removeEventListener('pointermove',  onPointerMove)
    dom.removeEventListener('pointerup',    onPointerUp)
    dom.removeEventListener('pointerleave', onPointerUp)
  }
  _clearDistrictGroups()
  _disposeCollisionMesh()
  dracoLoader.dispose()
  renderer.value?.dispose()
})
</script>

<template>
  <div ref="containerRef" class="preview-canvas" :class="{ dragging: isDragging }"></div>
</template>

<style scoped>
.preview-canvas {
  width: 100%;
  height: 100%;
  cursor: default;
}
.preview-canvas.dragging {
  cursor: grabbing !important;
}
</style>
