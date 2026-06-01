import * as THREE from '/lib/three.js'
import FpsController    from '../../FpsController.js'
import CrosshairTarget  from '../../CrosshairTarget.js'
import { buildOctree }  from '../../buildOctree.js'
import RepairParser     from './RepairParser.js'
import RepairBuilder    from './RepairBuilder.js'
import RepairMarkerManager from './RepairMarkerManager.js'
import { SCENE }        from './CarRepairConfig.js'

export default class CarRepairWorld {
  constructor(experience, callbacks = {}) {
    this.experience  = experience
    this.scene       = experience.scene
    this.camera      = experience.camera
    this._callbacks  = callbacks
    this._model      = null
    this._fps        = null
    this._markerManager = null
    this._xrayActive    = null

    this.scene.background = new THREE.Color(SCENE.BACKGROUND)
    this.scene.fog = new THREE.Fog(SCENE.BACKGROUND, SCENE.FOG_NEAR, SCENE.FOG_FAR)

    // Guard: SceneManager triggers 'ready' synchronously when sources is empty,
    // but Resources also fires it via setTimeout — the two triggers would run
    // _setup() twice. The flag prevents the second call.
    this._setupDone = false
    experience.resources.on('ready', () => {
      if (this._setupDone) return
      this._setupDone = true
      this._setup()
    })
  }

  async _setup() {
    await this._loadRepairData()
    this._setupLights()
    this._setupModel()
    this._setupFloor()
    this._setupFps()
    this._setupMarkers()

    this._callbacks.onWorldReady?.({
      repairData:    this._repairData,
      markerManager: this._markerManager,
    })
  }

  async _loadRepairData() {
    try {
      const res  = await fetch('/data/car_repair_sample.json')
      const json = await res.json()
      const parser = new RepairParser()
      this._repairData = {
        vehicle: parser.parseVehicle(json),
        meta:    parser.parseMeta(json),
        repairs: parser.parse(json),
      }
    } catch (e) {
      console.warn('[CarRepairWorld] Impossible de charger car_repair_sample.json', e)
      this._repairData = { vehicle: null, meta: null, repairs: [] }
    }
  }

  _setupLights() {
    this.scene.add(new THREE.AmbientLight(0xfff8f0, 1.8))

    const key = new THREE.DirectionalLight(0xffffff, 3.0)
    key.position.set(4, 8, 4)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.near   = 1
    key.shadow.camera.far    = 25
    key.shadow.camera.left   = -5
    key.shadow.camera.right  =  5
    key.shadow.camera.top    =  5
    key.shadow.camera.bottom = -5
    key.shadow.bias          = -0.002
    this.scene.add(key)

    const fill = new THREE.DirectionalLight(0xddeeff, 1.4)
    fill.position.set(-5, 4, -2)
    this.scene.add(fill)

    const rim = new THREE.DirectionalLight(0xffffff, 1.0)
    rim.position.set(0, 3, -6)
    this.scene.add(rim)
  }

  _setupModel() {
    const gltf = this.experience.resources.items.carRepair
    if (!gltf) {
      console.warn('[CarRepairWorld] GLB absent — cube placeholder')
      this._placeholderGeo = new THREE.BoxGeometry(2, 0.9, 4)
      this._placeholderMat = new THREE.MeshStandardMaterial({ color: 0x9aabb5, roughness: 0.6 })
      const box = new THREE.Mesh(this._placeholderGeo, this._placeholderMat)
      box.position.set(0, 0.45, 0)
      box.castShadow    = true
      box.receiveShadow = true
      this.scene.add(box)
      this._placeholder = box
      return
    }

    this._model = gltf.scene
    this._model.traverse(c => {
      if (c.isMesh) {
        c.castShadow    = true
        c.receiveShadow = true
      }
    })
    this.scene.add(this._model)

    if (gltf.cameras?.length > 0) {
      const gltfCam = gltf.cameras[0]
      gltfCam.updateWorldMatrix(true, false)
      const pos  = new THREE.Vector3()
      const quat = new THREE.Quaternion()
      gltfCam.matrixWorld.decompose(pos, quat, new THREE.Vector3())
      this.camera.instance.position.copy(pos)
      this.camera.instance.quaternion.copy(quat)
    } else {
      this.camera.instance.position.set(4, 1.7, 4)
      this.camera.instance.lookAt(0, 0.5, 0)
    }
  }

  _setupFloor() {
    this._floorGeo = new THREE.PlaneGeometry(30, 30)
    this._floorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 })
    const floor = new THREE.Mesh(this._floorGeo, this._floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.scene.add(floor)

    const grid = new THREE.GridHelper(30, 60, 0xcccccc, 0xdddddd)
    grid.position.y = 0.001
    this.scene.add(grid)
    this._grid = grid
  }

  _setupFps() {
    const octreeRoot = this._model ?? this.scene
    this._fps = new FpsController(this.experience, buildOctree(octreeRoot))
    this._crosshairTarget = new CrosshairTarget(this.experience)
    this.experience.interaction.setFpsMode(true)
    this._callbacks.onFpsReady?.(this._fps)
  }

  _setupMarkers() {
    if (!this._repairData?.repairs?.length) return

    const builder = new RepairBuilder()
    const repairMarkers = builder.build(this._repairData.repairs, this._model)
    this._markerManager = new RepairMarkerManager(this.experience, repairMarkers)

    const { interaction } = this.experience
    const ids = new Set(repairMarkers.map(m => m.repairDef.id))

    interaction.on('hover:enter', ({ id }) => {
      if (!ids.has(id)) return
      this._markerManager.onHoverEnter(id)
    })

    interaction.on('hover:leave', ({ id }) => {
      if (!ids.has(id)) return
      this._markerManager.onHoverLeave(id)
    })

    interaction.on('interact', ({ id }) => {
      if (!ids.has(id)) return

      if (this._xrayActive === id) {
        this._markerManager.disableXray(id)
        this._xrayActive = null
        this._callbacks.onXrayChange?.(null)
        // E key = user gesture → lock() works here
        this._fps.enabled = true
        this._fps.lock()
      } else {
        if (this._xrayActive) {
          this._markerManager.disableXray(this._xrayActive)
          this._callbacks.onXrayChange?.(null)
        }
        this._markerManager.enableXray(id)
        this._xrayActive = id
        this._callbacks.onXrayChange?.(id)
        this._fps.enabled = false
        this._fps.controls.unlock()
      }
    })

    this._markerManager.on('repair:done', ({ id, action }) => {
      if (this._xrayActive === id) {
        this._xrayActive = null
        this._callbacks.onXrayChange?.(null)
      }
      this._callbacks.onRepairDone?.({ id, action })
      // button click = user gesture → lock() works here
      this._fps.enabled = true
      this._fps.lock()
    })
  }

  update() {
    this._fps?.update(this.experience.time.delta)
    this._crosshairTarget?.update()
    this._markerManager?.update(this.experience.time.delta)
  }

  resize() {}

  dispose() {
    this._callbacks.onRepairDispose?.()
    this._markerManager?.destroy()
    this._fps?.dispose()
    this._crosshairTarget?.dispose()
    this.experience.interaction.setFpsMode(false)

    this._floorGeo?.dispose()
    this._floorMat?.dispose()
    this._placeholderGeo?.dispose()
    this._placeholderMat?.dispose()

    if (this._model) {
      this._model.traverse(c => {
        c.geometry?.dispose()
        const mats = Array.isArray(c.material) ? c.material : [c.material]
        mats.forEach(m => m?.dispose?.())
      })
    }
  }
}
