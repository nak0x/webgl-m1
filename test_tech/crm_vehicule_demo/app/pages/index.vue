<template>
  <div class="map-page">
    <div ref="canvasContainer" class="canvas-container"></div>

    <!-- HUD Overlay: Vehicle List -->
    <div class="map-overlay glass animate-slide-left">
      <div class="overlay-header">
        <h3>Véhicules</h3>
        <span class="vehicle-count">{{ store.vehicles.length }}</span>
      </div>
      <input
        v-model="store.searchQuery"
        class="input overlay-search"
        placeholder="Rechercher..."
      />
      <div class="overlay-filters">
        <button
          v-for="f in statusFilters"
          :key="f.value"
          class="filter-btn"
          :class="{ active: store.filterStatus === f.value }"
          @click="store.filterStatus = f.value"
        >
          <span v-if="f.dot" class="filter-dot" :style="{ background: f.dot }"></span>
          {{ f.label }}
        </button>
      </div>
      <div class="vehicle-list">
        <div
          v-for="vehicle in store.filteredVehicles"
          :key="vehicle.id"
          class="vehicle-item"
          :class="{ selected: store.selectedVehicleId === vehicle.id }"
          @click="onVehicleClick(vehicle.id)"
        >
          <div class="vehicle-item-left">
            <VehicleTypeIcon :type="vehicle.type" :type-label="vehicle.typeLabel" />
            <div class="vehicle-item-info">
              <span class="vehicle-item-name">{{ vehicle.name }}</span>
              <span class="vehicle-item-assign">{{ vehicle.assignedTo }}</span>
            </div>
          </div>
          <StatusBadge :status="vehicle.status" />
        </div>
      </div>
    </div>

    <!-- Vehicle Info Panel -->
    <Transition name="panel">
      <div v-if="store.selectedVehicle" class="info-panel glass-strong animate-slide-right">
        <div class="info-panel-header">
          <div>
            <h3>{{ store.selectedVehicle.name }}</h3>
            <span class="info-type">{{ store.selectedVehicle.typeLabel }}</span>
          </div>
          <button class="btn-close" @click="store.selectVehicle(null)">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4l10 10M14 4L4 14"/>
            </svg>
          </button>
        </div>

        <div class="info-body">
          <div class="info-row">
            <span class="info-label">Statut</span>
            <StatusBadge :status="store.selectedVehicle.status" />
          </div>
          <div class="info-row">
            <span class="info-label">Assigné à</span>
            <span class="info-value">{{ store.selectedVehicle.assignedTo }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Kilométrage</span>
            <span class="info-value">{{ store.selectedVehicle.mileage.toLocaleString() }} km</span>
          </div>
          <div class="info-row">
            <span class="info-label">Dernier entretien</span>
            <span class="info-value">{{ formatDate(store.selectedVehicle.lastMaintenance) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Prochain entretien</span>
            <span class="info-value">{{ formatDate(store.selectedVehicle.nextMaintenance) }}</span>
          </div>
        </div>

        <NuxtLink :to="`/dashboard/vehicles/${store.selectedVehicle.id}`" class="btn btn-primary info-btn">
          Voir dans le CRM
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M2 7h10M8 3l4 4-4 4"/>
          </svg>
        </NuxtLink>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import * as THREE from 'three'
import { MapControls } from 'three/examples/jsm/controls/MapControls.js'
import { useVehiclesStore } from '~/stores/vehicles'

definePageMeta({ layout: 'default' })

const store = useVehiclesStore()
const canvasContainer = ref<HTMLElement | null>(null)

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: MapControls
let raycaster: THREE.Raycaster
let mouse: THREE.Vector2
let vehicleMeshes: Map<string, THREE.Mesh> = new Map()
let ringMeshes: Map<string, THREE.Mesh> = new Map()
let trailMeshGroups: Map<string, THREE.Group> = new Map()
let hoveredVehicleId: string | null = null
let animationId: number

// ── Vehicle Movement System ──
const MAX_TRAIL_LENGTH = 200
const TRAIL_WIDTH = 0.25
const ROAD_COORDS = [-8, -4, 0, 4, 8] // Grid intersections where roads cross

interface VehicleRoute {
  waypoints: THREE.Vector3[]
  currentWaypointIdx: number
  progress: number       // 0→1 between current and next waypoint
  speed: number          // units per second
  trail: THREE.Vector3[] // breadcrumb positions
}

const vehicleRoutes: Map<string, VehicleRoute> = new Map()

const statusFilters = [
  { value: 'all', label: 'Tous', dot: null },
  { value: 'bon_etat', label: 'OK', dot: '#40916C' },
  { value: 'warning', label: 'Attention', dot: '#F4A261' },
  { value: 'reparation_obligatoire', label: 'Réparation', dot: '#E76F51' },
]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getStatusColor(status: string): number {
  switch (status) {
    case 'bon_etat': return 0x40916c
    case 'warning': return 0xf4a261
    case 'reparation_obligatoire': return 0xe76f51
    default: return 0x52b788
  }
}

function getStatusHex(status: string): string {
  switch (status) {
    case 'bon_etat': return '#40916C'
    case 'warning': return '#F4A261'
    case 'reparation_obligatoire': return '#E76F51'
    default: return '#52B788'
  }
}

// ── Route Generation ──
// Deterministic PRNG
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453
  return x - Math.floor(x)
}

// Generate a looping route along the road grid for a vehicle
function generateRoute(vehicleId: string, startX: number, startZ: number, seed: number): VehicleRoute {
  const waypoints: THREE.Vector3[] = []
  let s = seed
  // Start near the vehicle's initial position, snap to nearest road intersection
  let cx = ROAD_COORDS.reduce((prev, curr) => Math.abs(curr - startX) < Math.abs(prev - startX) ? curr : prev)
  let cz = ROAD_COORDS.reduce((prev, curr) => Math.abs(curr - startZ) < Math.abs(prev - startZ) ? curr : prev)

  waypoints.push(new THREE.Vector3(cx, 0.15, cz))

  // Generate 8-14 waypoints along the road grid, then loop back to start
  const numWaypoints = 8 + Math.floor(seededRandom(s++) * 7)
  for (let i = 0; i < numWaypoints; i++) {
    const r = seededRandom(s++)
    // Randomly pick: move along X (horizontal road) or Z (vertical road)
    if (r < 0.5) {
      // Move along X axis (stay on horizontal road at current Z)
      const candidates = ROAD_COORDS.filter(v => v !== cx)
      const pick = candidates[Math.floor(seededRandom(s++) * candidates.length)]
      cx = pick
    } else {
      // Move along Z axis (stay on vertical road at current X)
      const candidates = ROAD_COORDS.filter(v => v !== cz)
      const pick = candidates[Math.floor(seededRandom(s++) * candidates.length)]
      cz = pick
    }
    waypoints.push(new THREE.Vector3(cx, 0.15, cz))
  }

  // Close the loop back to start
  waypoints.push(waypoints[0].clone())

  // Speed varies by vehicle type seed
  const baseSpeed = 1.2 + seededRandom(s++) * 1.8 // 1.2 to 3.0 units/sec

  return {
    waypoints,
    currentWaypointIdx: 0,
    progress: seededRandom(s++) * 0.5, // Start at random progress so they don't all sync
    speed: baseSpeed,
    trail: [waypoints[0].clone()],
  }
}

function initScene() {
  if (!canvasContainer.value) return

  const w = canvasContainer.value.clientWidth
  const h = canvasContainer.value.clientHeight

  // Scene
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xe8ebe4)
  scene.fog = new THREE.Fog(0xe8ebe4, 25, 60)

  // Camera
  camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200)
  camera.position.set(18, 22, 18)
  camera.lookAt(0, 0, 0)

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1
  canvasContainer.value.appendChild(renderer.domElement)

  // Controls — MapControls for Google Maps-like interaction
  controls = new MapControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.screenSpacePanning = false
  controls.minDistance = 8
  controls.maxDistance = 50
  controls.maxPolarAngle = Math.PI / 2.5
  controls.minPolarAngle = Math.PI / 6
  controls.target.set(0, 0, 0)

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)

  const hemiLight = new THREE.HemisphereLight(0xf0f5e8, 0xd4c5a9, 0.5)
  scene.add(hemiLight)

  const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.2)
  dirLight.position.set(15, 20, 10)
  dirLight.castShadow = true
  dirLight.shadow.mapSize.width = 2048
  dirLight.shadow.mapSize.height = 2048
  dirLight.shadow.camera.near = 0.5
  dirLight.shadow.camera.far = 60
  dirLight.shadow.camera.left = -20
  dirLight.shadow.camera.right = 20
  dirLight.shadow.camera.top = 20
  dirLight.shadow.camera.bottom = -20
  dirLight.shadow.bias = -0.001
  scene.add(dirLight)

  // Raycaster
  raycaster = new THREE.Raycaster()
  mouse = new THREE.Vector2()

  // Build the city
  buildCity()
  buildVehicles()
  initRoutes()

  // Events
  renderer.domElement.addEventListener('pointermove', onPointerMove)
  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('resize', onResize)

  // Animation loop
  animate()
}

function buildCity() {
  // Ground plane — warm gray
  const groundGeo = new THREE.PlaneGeometry(80, 80)
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xd2cec5,
    roughness: 0.95,
    metalness: 0.0,
  })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.01
  ground.receiveShadow = true
  scene.add(ground)

  // Road grid
  const roadMat = new THREE.MeshStandardMaterial({ color: 0xb5b0a5, roughness: 0.9, metalness: 0 })

  // Horizontal roads
  for (let z = -8; z <= 8; z += 4) {
    const roadGeo = new THREE.PlaneGeometry(40, 1.2)
    const road = new THREE.Mesh(roadGeo, roadMat)
    road.rotation.x = -Math.PI / 2
    road.position.set(0, 0.01, z)
    road.receiveShadow = true
    scene.add(road)
  }

  // Vertical roads
  for (let x = -8; x <= 8; x += 4) {
    const roadGeo = new THREE.PlaneGeometry(1.2, 40)
    const road = new THREE.Mesh(roadGeo, roadMat)
    road.rotation.x = -Math.PI / 2
    road.position.set(x, 0.01, 0)
    road.receiveShadow = true
    scene.add(road)
  }

  // Buildings — white cubes with variation
  const buildingMat = new THREE.MeshStandardMaterial({
    color: 0xf5f2ed,
    roughness: 0.6,
    metalness: 0.05,
  })

  const greenAccentMat = new THREE.MeshStandardMaterial({
    color: 0x95d5b2,
    roughness: 0.5,
    metalness: 0.05,
  })

  const darkBuildingMat = new THREE.MeshStandardMaterial({
    color: 0xe8e4dd,
    roughness: 0.7,
    metalness: 0.05,
  })

  let buildingSeed = 0

  // Place buildings in blocks between roads
  for (let bx = -8; bx <= 8; bx += 4) {
    for (let bz = -8; bz <= 8; bz += 4) {
      const count = 1 + Math.floor(seededRandom(buildingSeed++) * 3)

      for (let i = 0; i < count; i++) {
        const offsetX = (seededRandom(buildingSeed++) - 0.5) * 2.4
        const offsetZ = (seededRandom(buildingSeed++) - 0.5) * 2.4
        const height = 0.8 + seededRandom(buildingSeed++) * 4
        const width = 0.6 + seededRandom(buildingSeed++) * 1.2
        const depth = 0.6 + seededRandom(buildingSeed++) * 1.2

        const bGeo = new THREE.BoxGeometry(width, height, depth)
        const isGreenAccent = seededRandom(buildingSeed++) > 0.82
        const isDark = seededRandom(buildingSeed++) > 0.65
        const mat = isGreenAccent ? greenAccentMat : isDark ? darkBuildingMat : buildingMat
        const building = new THREE.Mesh(bGeo, mat)
        building.position.set(bx + offsetX, height / 2, bz + offsetZ)
        building.castShadow = true
        building.receiveShadow = true
        scene.add(building)

        // Green accent on rooftop for some buildings
        if (seededRandom(buildingSeed++) > 0.6) {
          const roofGeo = new THREE.BoxGeometry(width * 0.9, 0.1, depth * 0.9)
          const roof = new THREE.Mesh(roofGeo, greenAccentMat)
          roof.position.set(bx + offsetX, height + 0.05, bz + offsetZ)
          scene.add(roof)
        }
      }
    }
  }

  // Green accent patches on ground
  const patchMat = new THREE.MeshStandardMaterial({ color: 0xb7e4c7, roughness: 0.8, metalness: 0 })
  const patchPositions = [
    { x: 2, z: 2, s: 2.5 },
    { x: -6, z: 6, s: 3 },
    { x: 7, z: -7, s: 2 },
    { x: -3, z: -6, s: 1.8 },
    { x: 6, z: 3, s: 2.2 },
  ]
  patchPositions.forEach(({ x, z, s }) => {
    const pGeo = new THREE.PlaneGeometry(s, s)
    const patch = new THREE.Mesh(pGeo, patchMat)
    patch.rotation.x = -Math.PI / 2
    patch.position.set(x, 0.02, z)
    scene.add(patch)
  })
}

function buildVehicles() {
  store.vehicles.forEach((vehicle) => {
    // Vehicle marker: small box with status color
    const color = getStatusColor(vehicle.status)
    const geo = new THREE.BoxGeometry(0.45, 0.45, 0.45)
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.3,
      metalness: 0.2,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.3,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(vehicle.position.x, 0.4, vehicle.position.z)
    mesh.castShadow = true
    mesh.userData = { vehicleId: vehicle.id }
    scene.add(mesh)
    vehicleMeshes.set(vehicle.id, mesh)

    // Pulsing ring under vehicle
    const ringGeo = new THREE.RingGeometry(0.35, 0.5, 24)
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.set(vehicle.position.x, 0.05, vehicle.position.z)
    ring.userData = { isRing: true, vehicleId: vehicle.id }
    scene.add(ring)
    ringMeshes.set(vehicle.id, ring)
  })
}

// ── Initialize routes + trail mesh groups for all vehicles ──
function initRoutes() {
  store.vehicles.forEach((vehicle, idx) => {
    const route = generateRoute(
      vehicle.id,
      vehicle.position.x,
      vehicle.position.z,
      idx * 1000 + 42
    )

    // Vehicles in repair move slower
    if (vehicle.status === 'reparation_obligatoire') {
      route.speed *= 0.5
    }

    vehicleRoutes.set(vehicle.id, route)

    // Create a group to hold trail mesh segments
    const trailGroup = new THREE.Group()
    trailGroup.userData = { vehicleId: vehicle.id }
    scene.add(trailGroup)
    trailMeshGroups.set(vehicle.id, trailGroup)
  })
}

// Build a flat ribbon mesh segment between two trail points
function addTrailSegment(vehicleId: string, from: THREE.Vector3, to: THREE.Vector3) {
  const group = trailMeshGroups.get(vehicleId)
  if (!group) return

  const vehicle = store.getVehicleById(vehicleId)
  if (!vehicle) return

  // Direction vector and perpendicular for ribbon width
  const dir = new THREE.Vector3().subVectors(to, from)
  const len = dir.length()
  if (len < 0.01) return

  dir.normalize()
  // Perpendicular in XZ plane
  const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(TRAIL_WIDTH / 2)

  // 4 corners of the ribbon quad
  const vertices = new Float32Array([
    from.x - perp.x, 0.06, from.z - perp.z,
    from.x + perp.x, 0.06, from.z + perp.z,
    to.x + perp.x, 0.06, to.z + perp.z,
    to.x - perp.x, 0.06, to.z - perp.z,
  ])
  const indices = [0, 1, 2, 0, 2, 3]

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geo.setIndex(indices)

  const color = getStatusColor(vehicle.status)
  // Fade older segments: newer = more opaque
  const segCount = group.children.length
  const fadeStart = MAX_TRAIL_LENGTH * 0.6
  const opacity = segCount < fadeStart ? 0.7 : 0.7 * (1 - (segCount - fadeStart) / (MAX_TRAIL_LENGTH - fadeStart))

  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: Math.max(0.15, opacity),
    side: THREE.DoubleSide,
    depthWrite: false,
  })

  const mesh = new THREE.Mesh(geo, mat)
  group.add(mesh)

  // Cap total segments
  while (group.children.length > MAX_TRAIL_LENGTH) {
    const oldest = group.children[0]
    ;(oldest as THREE.Mesh).geometry.dispose()
    ;((oldest as THREE.Mesh).material as THREE.Material).dispose()
    group.remove(oldest)
  }

  // Refresh opacity fade for all segments in the group
  const total = group.children.length
  group.children.forEach((child, i) => {
    const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial
    // Linear fade: oldest segments are most transparent
    m.opacity = 0.15 + 0.65 * (i / total)
  })
}

// ── Update vehicle positions along their routes ──
function updateVehicleMovement(delta: number) {
  vehicleRoutes.forEach((route, vehicleId) => {
    const mesh = vehicleMeshes.get(vehicleId)
    const ring = ringMeshes.get(vehicleId)
    if (!mesh) return

    const wp = route.waypoints
    const from = wp[route.currentWaypointIdx]
    const toIdx = (route.currentWaypointIdx + 1) % wp.length
    const to = wp[toIdx]

    // Distance between waypoints
    const segLen = from.distanceTo(to)
    if (segLen < 0.01) {
      // Skip zero-length segments
      route.currentWaypointIdx = toIdx
      route.progress = 0
      return
    }

    // Advance progress
    route.progress += (route.speed * delta) / segLen

    if (route.progress >= 1) {
      // Move to next waypoint
      route.progress = route.progress - 1
      route.currentWaypointIdx = toIdx
      // If we looped back to start, keep going
      if (route.currentWaypointIdx >= wp.length - 1) {
        route.currentWaypointIdx = 0
      }
      return
    }

    // Interpolate position
    const newX = from.x + (to.x - from.x) * route.progress
    const newZ = from.z + (to.z - from.z) * route.progress

    mesh.position.x = newX
    mesh.position.z = newZ

    // Move ring to follow
    if (ring) {
      ring.position.x = newX
      ring.position.z = newZ
    }

    // Add to trail (only every ~0.25 units of movement)
    const lastTrailPt = route.trail[route.trail.length - 1]
    const dist = Math.sqrt(
      (newX - lastTrailPt.x) ** 2 + (newZ - lastTrailPt.z) ** 2
    )
    if (dist > 0.25) {
      const newPt = new THREE.Vector3(newX, 0.15, newZ)
      addTrailSegment(vehicleId, lastTrailPt, newPt)
      route.trail.push(newPt)
      // Cap trail array
      if (route.trail.length > MAX_TRAIL_LENGTH) {
        route.trail.shift()
      }
    }
  })
}

function onVehicleClick(vehicleId: string) {
  if (store.selectedVehicleId === vehicleId) {
    store.selectVehicle(null)
    // Reset all trail groups visibility
    trailMeshGroups.forEach((group) => {
      group.visible = true
      group.children.forEach((child, i) => {
        const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial
        m.opacity = 0.15 + 0.65 * (i / group.children.length)
      })
    })
    return
  }
  store.selectVehicle(vehicleId)

  // Highlight selected trail, dim others
  trailMeshGroups.forEach((group, id) => {
    if (id === vehicleId) {
      group.children.forEach((child, i) => {
        const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial
        m.opacity = 0.3 + 0.7 * (i / group.children.length)
      })
    } else {
      group.children.forEach((child) => {
        const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial
        m.opacity = 0.08
      })
    }
  })

  // Fly camera to vehicle
  const mesh = vehicleMeshes.get(vehicleId)
  if (mesh && controls) {
    controls.target.lerp(mesh.position, 0.5)
  }
}

function onPointerMove(event: PointerEvent) {
  if (!canvasContainer.value) return
  const rect = canvasContainer.value.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return // left click only

  raycaster.setFromCamera(mouse, camera)
  const meshArray = Array.from(vehicleMeshes.values())
  const intersects = raycaster.intersectObjects(meshArray)

  if (intersects.length > 0) {
    const vehicleId = intersects[0].object.userData.vehicleId
    if (vehicleId) {
      onVehicleClick(vehicleId)
    }
  }
}

function onResize() {
  if (!canvasContainer.value) return
  const w = canvasContainer.value.clientWidth
  const h = canvasContainer.value.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

let time = 0
let lastTime = 0
function animate() {
  animationId = requestAnimationFrame(animate)
  const now = performance.now() / 1000
  const delta = lastTime === 0 ? 0.016 : Math.min(now - lastTime, 0.05)
  lastTime = now
  time += delta

  controls.update()

  // Move vehicles along their routes
  updateVehicleMovement(delta)

  // Animate vehicle markers: gentle bob
  vehicleMeshes.forEach((mesh) => {
    const baseY = 0.4
    mesh.position.y = baseY + Math.sin(time * 2 + mesh.position.x) * 0.05
    mesh.rotation.y += 0.008
  })

  // Update ring opacities for pulse
  ringMeshes.forEach((ring) => {
    const mat = ring.material as THREE.MeshBasicMaterial
    mat.opacity = 0.2 + Math.sin(time * 3 + ring.position.x) * 0.2
  })

  // Hover detection
  raycaster.setFromCamera(mouse, camera)
  const meshArray = Array.from(vehicleMeshes.values())
  const intersects = raycaster.intersectObjects(meshArray)

  if (intersects.length > 0) {
    const newHoveredId = intersects[0].object.userData.vehicleId
    if (newHoveredId !== hoveredVehicleId) {
      // Reset previous
      if (hoveredVehicleId) {
        const prev = vehicleMeshes.get(hoveredVehicleId)
        if (prev) {
          prev.scale.set(1, 1, 1);
          (prev.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3
        }
      }
      // Highlight new
      hoveredVehicleId = newHoveredId
      const mesh = vehicleMeshes.get(newHoveredId)
      if (mesh) {
        mesh.scale.set(1.3, 1.3, 1.3);
        (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6
      }
      renderer.domElement.style.cursor = 'pointer'
    }
  } else {
    if (hoveredVehicleId) {
      const prev = vehicleMeshes.get(hoveredVehicleId)
      if (prev) {
        prev.scale.set(1, 1, 1);
        (prev.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3
      }
      hoveredVehicleId = null
      renderer.domElement.style.cursor = 'grab'
    }
  }

  renderer.render(scene, camera)
}

onMounted(() => {
  initScene()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId)
  renderer?.dispose()
  controls?.dispose()
  window.removeEventListener('resize', onResize)
})

// Watch for vehicle status change to update marker color
watch(
  () => store.vehicles.map((v) => v.status),
  () => {
    store.vehicles.forEach((vehicle) => {
      const mesh = vehicleMeshes.get(vehicle.id)
      if (mesh) {
        const color = getStatusColor(vehicle.status)
        const mat = mesh.material as THREE.MeshStandardMaterial
        mat.color.set(color)
        mat.emissive.set(color)
      }
    })
  },
)
</script>

<style scoped>
.map-page {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.canvas-container {
  width: 100%;
  height: 100%;
}

.canvas-container canvas {
  display: block;
}

/* Overlay */
.map-overlay {
  position: absolute;
  top: var(--space-4);
  left: var(--space-4);
  width: 280px;
  max-height: calc(100vh - 32px);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  z-index: 10;
}

.overlay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.overlay-header h3 {
  font-size: 1rem;
  margin: 0;
}

.vehicle-count {
  background: var(--green-200);
  color: var(--green-800);
  padding: 2px 10px;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
}

.overlay-search {
  font-size: 0.8rem;
  padding: 8px 12px;
}

.overlay-filters {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border: 1px solid transparent;
  transition: all var(--transition-fast);
}

.filter-btn:hover {
  background: var(--green-200);
  color: var(--green-800);
}

.filter-btn.active {
  background: var(--green-700);
  color: white;
}

.filter-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

/* Vehicle List */
.vehicle-list {
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-height: calc(100vh - 240px);
}

.vehicle-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  gap: var(--space-2);
}

.vehicle-item:hover {
  background: var(--bg-hover);
}

.vehicle-item.selected {
  background: var(--green-200);
}

.vehicle-item-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.vehicle-item-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.vehicle-item-name {
  font-weight: 600;
  font-size: 0.8rem;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vehicle-item-assign {
  font-size: 0.7rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Info Panel */
.info-panel {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  width: 300px;
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  z-index: 10;
}

.info-panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.info-panel-header h3 {
  font-size: 1.1rem;
  margin: 0;
}

.info-type {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.btn-close {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  transition: all var(--transition-fast);
}

.btn-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.info-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.info-label {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.info-value {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-primary);
}

.info-btn {
  width: 100%;
  text-decoration: none;
}

/* Panel transition */
.panel-enter-active,
.panel-leave-active {
  transition: all 0.3s ease;
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

@media (max-width: 768px) {
  .map-overlay {
    width: 220px;
    left: var(--space-2);
    top: var(--space-2);
  }

  .info-panel {
    width: calc(100% - 16px);
    left: var(--space-2);
    right: var(--space-2);
    bottom: var(--space-2);
    top: auto;
  }
}
</style>
