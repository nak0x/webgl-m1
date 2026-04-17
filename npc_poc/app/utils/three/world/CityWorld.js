/**
 * CityWorld — procedural city scene with NPC system.
 *
 * Scene contents:
 *   • 100×100 ground plane (dark asphalt)
 *   • Procedural grid buildings (~60% coverage) with randomized heights
 *   • Roads as gaps between building blocks
 *   • Directional + ambient lighting with shadows
 *   • Vehicle + pedestrian traffic networks
 *   • NPCController managing humans + cars
 *   • FPV camera integration
 *
 * Lifecycle: constructed by index.vue, wired into Experience.
 */
import * as THREE from 'three'
import FPVCamera       from '../FPVCamera.js'
import TrafficNetwork  from '../npc/TrafficNetwork.js'
import NPCController   from '../npc/NPCController.js'
import NPC_SETTINGS    from '../npc/NPCSettings.js'

export default class CityWorld {
  /** @type {'fpv'|'orbit'} */
  static CAMERA_FPV   = 'fpv'
  static CAMERA_ORBIT = 'orbit'

  /**
   * @param {Experience} experience
   * @param {object}     callbacks
   * @param {Function}   callbacks.onPointerLock  — called with true/false
   * @param {Function}   callbacks.onCameraChange — called with 'fpv'|'orbit'
   */
  constructor(experience, callbacks = {}) {
    this.experience = experience
    this.scene      = experience.scene
    this.sizes      = experience.sizes
    this.camera     = experience.camera
    this.renderer   = experience.renderer
    this._callbacks = callbacks

    // Scene config
    this.scene.background = new THREE.Color(0x87CEEB) // sky blue
    this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.015)

    // Disable the default OrbitControls camera
    this.camera.autoUpdate = false
    this.camera.controls.enabled = false

    // FPV Camera
    this._fpv = new FPVCamera(experience, {
      height:    1.7,
      moveSpeed: 6,
      onLock:    () => this._callbacks.onPointerLock?.(true),
      onUnlock:  () => this._callbacks.onPointerLock?.(false),
    })

    // Orbit camera setup (reuse Experience's camera + controls)
    this._setupOrbitCamera()

    // Default to FPV
    this._cameraMode = CityWorld.CAMERA_FPV
    this.renderer.setActiveCamera(this._fpv.instance)

    // Key binding: V to toggle camera
    this._onKeyDown = (e) => {
      if (e.key === 'v' || e.key === 'V') this.toggleCamera()
    }
    window.addEventListener('keydown', this._onKeyDown)

    // Tracking arrays
    this._buildingMeshes = []
    this._disposables    = []

    // Build scene
    this._setupLights()
    this._setupGround()
    this._setupBuildings()
    this._setupNetworks()
    this._setupNPCs()

    // Start NPC simulation immediately
    experience.resources.on('ready', () => {
      this._npcController.start()
    })
  }

  /* ══════════════════════════════════════════════════════════
   *  CAMERA TOGGLE
   * ══════════════════════════════════════════════════════════ */

  _setupOrbitCamera() {
    // Configure orbit controls for a bird's-eye city overview
    this.camera.instance.position.set(0, 40, 40)
    this.camera.controls.target.set(0, 0, 0)
    this.camera.setDamping(true, 0.08)
    this.camera.controls.maxPolarAngle = Math.PI / 2 - 0.05 // prevent going below ground
    this.camera.controls.minDistance = 5
    this.camera.controls.maxDistance = 120
    this.camera.controls.update()
  }

  /** @returns {'fpv'|'orbit'} current camera mode */
  get cameraMode() { return this._cameraMode }

  /** Toggle between FPV and Orbit camera modes. */
  toggleCamera() {
    if (this._cameraMode === CityWorld.CAMERA_FPV) {
      this._switchToOrbit()
    } else {
      this._switchToFPV()
    }
  }

  _switchToOrbit() {
    this._cameraMode = CityWorld.CAMERA_ORBIT

    // Unlock pointer if locked
    if (this._fpv.isLocked) {
      document.exitPointerLock()
    }

    // Position orbit camera above the FPV camera's current position
    const fpvPos = this._fpv.instance.position
    this.camera.instance.position.set(fpvPos.x, 40, fpvPos.z + 30)
    this.camera.controls.target.set(fpvPos.x, 0, fpvPos.z)
    this.camera.controls.enabled = true
    this.camera.controls.update()

    this.renderer.setActiveCamera(null) // use default (orbit) camera
    this._callbacks.onCameraChange?.('orbit')
    this._callbacks.onPointerLock?.(false)
  }

  _switchToFPV() {
    this._cameraMode = CityWorld.CAMERA_FPV

    // Disable orbit controls
    this.camera.controls.enabled = false

    this.renderer.setActiveCamera(this._fpv.instance)
    this._callbacks.onCameraChange?.('fpv')
  }

  /* ══════════════════════════════════════════════════════════
   *  LIGHTS
   * ══════════════════════════════════════════════════════════ */

  _setupLights() {
    // Ambient
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambient)

    // Directional (sun)
    const sun = new THREE.DirectionalLight(0xfff4e6, 1.5)
    sun.position.set(30, 50, 20)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left   = -60
    sun.shadow.camera.right  =  60
    sun.shadow.camera.top    =  60
    sun.shadow.camera.bottom = -60
    sun.shadow.camera.near   = 0.5
    sun.shadow.camera.far    = 150
    sun.shadow.bias = -0.001
    this.scene.add(sun)
    this._sun = sun

    // Hemisphere for sky/ground color bleed
    const hemi = new THREE.HemisphereLight(0x87CEEB, 0x444422, 0.4)
    this.scene.add(hemi)
  }

  /* ══════════════════════════════════════════════════════════
   *  GROUND
   * ══════════════════════════════════════════════════════════ */

  _setupGround() {
    const cfg = NPC_SETTINGS.network
    const size = cfg.gridSize

    // Asphalt ground
    const groundGeo = new THREE.PlaneGeometry(size, size)
    const groundMat = new THREE.MeshStandardMaterial({
      color:     0x333333,
      roughness: 0.9,
      metalness: 0.0,
    })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)

    this._disposables.push(groundGeo, groundMat)

    // Road markings — thin white lines along road centers
    const half = size / 2
    const markingMat = new THREE.MeshBasicMaterial({ color: 0x666666 })
    const markingGeo = new THREE.PlaneGeometry(size, 0.15)

    for (let v = -half; v <= half; v += cfg.blockSize) {
      // Horizontal road stripe
      const hStripe = new THREE.Mesh(markingGeo, markingMat)
      hStripe.rotation.x = -Math.PI / 2
      hStripe.position.set(0, 0.01, v)
      this.scene.add(hStripe)

      // Vertical road stripe
      const vStripe = new THREE.Mesh(markingGeo, markingMat)
      vStripe.rotation.x = -Math.PI / 2
      vStripe.rotation.z = Math.PI / 2
      vStripe.position.set(v, 0.01, 0)
      this.scene.add(vStripe)
    }

    this._disposables.push(markingGeo, markingMat)
  }

  /* ══════════════════════════════════════════════════════════
   *  BUILDINGS
   * ══════════════════════════════════════════════════════════ */

  _setupBuildings() {
    const cfg  = NPC_SETTINGS.network
    const half = cfg.gridSize / 2
    const block = cfg.blockSize
    const roadWidth = cfg.sidewalkOffset * 2 // Total road+sidewalk clearance

    // Building materials (shared, varied colors)
    const buildingColors = [
      0xe8dcc8, 0xd4c5a9, 0xc9b99a, 0xbfb093,
      0xd6cdb9, 0xcec4af, 0xb8ad98, 0xa89e8a,
      0xe0d5c1, 0xd2c8b4, 0xcbbfab, 0xbdb2a0,
    ]
    const buildingMats = buildingColors.map(c =>
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0.05 })
    )
    this._disposables.push(...buildingMats)

    // Window material (dark with slight emissiveness for life)
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x224466,
      roughness: 0.2,
      metalness: 0.3,
      emissive: 0x112233,
      emissiveIntensity: 0.3,
    })
    this._disposables.push(windowMat)

    // Place buildings in each block (area between 4 adjacent intersections)
    for (let cx = -half + block / 2; cx < half; cx += block) {
      for (let cz = -half + block / 2; cz < half; cz += block) {
        // Available area within this block (subtract road clearance)
        const availableSize = block - roadWidth

        if (availableSize < 2) continue // too narrow

        // Fill the block with 1–4 buildings
        const numBuildings = 1 + Math.floor(Math.random() * 3)
        this._placeBlockBuildings(cx, cz, availableSize, numBuildings, buildingMats, windowMat)
      }
    }
  }

  _placeBlockBuildings(blockCx, blockCz, availableSize, count, materials, windowMat) {
    // Simple subdivision: divide block into a 2×2 sub-grid
    const subSize = availableSize / 2
    const gap = 0.5 // gap between buildings

    const subCenters = [
      { x: blockCx - subSize / 2, z: blockCz - subSize / 2 },
      { x: blockCx + subSize / 2, z: blockCz - subSize / 2 },
      { x: blockCx - subSize / 2, z: blockCz + subSize / 2 },
      { x: blockCx + subSize / 2, z: blockCz + subSize / 2 },
    ]

    // Randomly pick which sub-slots get buildings
    const slots = [...subCenters].sort(() => Math.random() - 0.5).slice(0, count)

    for (const slot of slots) {
      const bw = subSize - gap
      const bd = subSize - gap
      const bh = 2 + Math.random() * 8 // height 2–10

      if (bw < 1 || bd < 1) continue

      const geo = new THREE.BoxGeometry(bw, bh, bd)
      const mat = materials[Math.floor(Math.random() * materials.length)]

      const building = new THREE.Mesh(geo, mat)
      building.position.set(slot.x, bh / 2, slot.z)
      building.castShadow    = true
      building.receiveShadow = true
      this.scene.add(building)

      this._buildingMeshes.push(building)
      this._disposables.push(geo)

      // Add window strips
      this._addWindows(building, bw, bh, bd, windowMat)
    }
  }

  _addWindows(building, bw, bh, bd, windowMat) {
    const windowHeight = 0.4
    const windowWidth  = 0.3
    const floorHeight  = 2.5
    const numFloors = Math.floor(bh / floorHeight)

    if (numFloors < 1) return

    const windowGeo = new THREE.PlaneGeometry(windowWidth, windowHeight)
    this._disposables.push(windowGeo)

    for (let floor = 0; floor < numFloors; floor++) {
      const y = -bh / 2 + floorHeight * (floor + 0.5) + 0.5
      const numWindowsPerSide = Math.floor(bw / 0.8)

      // Front + back faces (Z axis)
      for (let w = 0; w < numWindowsPerSide; w++) {
        const x = -bw / 2 + 0.4 + w * (bw - 0.8) / Math.max(numWindowsPerSide - 1, 1)

        // Front
        const wf = new THREE.Mesh(windowGeo, windowMat)
        wf.position.set(x, y, bd / 2 + 0.01)
        building.add(wf)

        // Back
        const wb = new THREE.Mesh(windowGeo, windowMat)
        wb.position.set(x, y, -bd / 2 - 0.01)
        wb.rotation.y = Math.PI
        building.add(wb)
      }

      // Left + right faces (X axis)
      const numWindowsDepth = Math.floor(bd / 0.8)
      for (let w = 0; w < numWindowsDepth; w++) {
        const z = -bd / 2 + 0.4 + w * (bd - 0.8) / Math.max(numWindowsDepth - 1, 1)

        // Right
        const wr = new THREE.Mesh(windowGeo, windowMat)
        wr.position.set(bw / 2 + 0.01, y, z)
        wr.rotation.y = Math.PI / 2
        building.add(wr)

        // Left
        const wl = new THREE.Mesh(windowGeo, windowMat)
        wl.position.set(-bw / 2 - 0.01, y, z)
        wl.rotation.y = -Math.PI / 2
        building.add(wl)
      }
    }
  }

  /* ══════════════════════════════════════════════════════════
   *  TRAFFIC NETWORKS
   * ══════════════════════════════════════════════════════════ */

  _setupNetworks() {
    const cfg = NPC_SETTINGS.network

    this._vehicleNetwork = TrafficNetwork.createVehicleGrid(cfg)
    this._pedestrianNetwork = TrafficNetwork.createPedestrianGrid(cfg)

    // Optional: add debug visualization (uncomment to see roads)
    // const vDebug = this._vehicleNetwork.createDebugVisualization(0xff4444)
    // const pDebug = this._pedestrianNetwork.createDebugVisualization(0x44ff44)
    // this.scene.add(vDebug)
    // this.scene.add(pDebug)
  }

  /* ══════════════════════════════════════════════════════════
   *  NPC SYSTEM
   * ══════════════════════════════════════════════════════════ */

  _setupNPCs() {
    this._npcController = new NPCController(
      this.experience,
      this._vehicleNetwork,
      this._pedestrianNetwork,
      this._buildingMeshes,
    )
    this._npcController.init(NPC_SETTINGS)
  }

  /* ══════════════════════════════════════════════════════════
   *  FRAME LOOP (called by Experience)
   * ══════════════════════════════════════════════════════════ */

  update() {
    const delta = this.experience.time.delta

    // Camera
    if (this._cameraMode === CityWorld.CAMERA_FPV) {
      this._fpv.update(delta)
    } else {
      this.camera.controls.update()
    }

    // Active camera for NPC frustum checks
    const activeCam = this._cameraMode === CityWorld.CAMERA_FPV
      ? this._fpv.instance
      : this.camera.instance

    // NPC system
    this._npcController.update(delta, activeCam)
  }

  /* ══════════════════════════════════════════════════════════
   *  RESIZE
   * ══════════════════════════════════════════════════════════ */

  resize() {
    this._fpv.resize()
    // Orbit camera resize is handled by Experience.camera.resize()
  }

  /* ══════════════════════════════════════════════════════════
   *  CLEANUP
   * ══════════════════════════════════════════════════════════ */

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown)
    this._npcController?.dispose()
    this._fpv?.dispose()

    for (const d of this._disposables) {
      d.dispose?.()
    }
    this._disposables = []
    this._buildingMeshes = []
  }
}
