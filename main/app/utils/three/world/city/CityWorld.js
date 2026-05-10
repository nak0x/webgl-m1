import * as THREE        from 'three'
import FpsController    from '../../FpsController.js'
import CrosshairTarget  from '../../CrosshairTarget.js'
import DialogueManager  from '../../dialogue/DialogueManager.js'
import { buildOctree }  from '../../buildOctree.js'
import CityChunkManager from './CityChunkManager.js'
import { SPAWN, EYE_HEIGHT } from './CityConfig.js'

// FpsController capsule radius is 0.3, EYE_HEIGHT constant is 1.0.
// Settled camera height = floor_y + 0.3 + 1.0.
// To get settled eye at EYE_HEIGHT (1.45m): floor_y = 1.45 - 1.3 = 0.15.
const FLOOR_Y      = EYE_HEIGHT - 1.3   // 0.15 m
const SKY          = new THREE.Color(0xc8dff5)

export default class CityWorld {
  constructor(experience, callbacks = {}) {
    this.experience = experience
    this.scene      = experience.scene
    this.camera     = experience.camera
    this._callbacks = callbacks

    this.scene.background = SKY.clone()
    this.scene.fog         = new THREE.FogExp2(SKY.clone(), 0.006)

    this.dialogue = new DialogueManager()
    experience.setDialogue(this.dialogue)

    // No preloaded resources — start immediately once Resources fires 'ready'.
    experience.resources.on('ready', () => this._setup())
  }

  _setup() {
    this._setupLights()
    this._setupMaterial()
    this._setupFloor()
    this._setupFps()
    this._setupChunks()  // async, fire-and-forget — chunks load progressively
  }

  _setupLights() {
    // Sky-tinted ambient — primary fill for white clearcoat material
    this.scene.add(new THREE.AmbientLight(0xd0e8ff, 1.4))

    // Main sun — oblique to cast strong clearcoat highlights
    const sun = new THREE.DirectionalLight(0xfffce0, 2.8)
    sun.position.set(-30, 50, 30)
    sun.castShadow = false  // shadows over a whole city would shatter performance
    this.scene.add(sun)

    // Sky bounce — slightly warm fill from opposite side
    const fill = new THREE.DirectionalLight(0xa0c8f0, 0.7)
    fill.position.set(20, 10, -30)
    this.scene.add(fill)

    // Hemisphere — blends sky colour into ground-facing surfaces
    this.scene.add(new THREE.HemisphereLight(0xd0e8ff, 0xb0a888, 0.5))
  }

  _setupMaterial() {
    this._material = new THREE.MeshPhongMaterial({ color: 0xffffff })
  }

  // Invisible flat ground used by FpsController's octree.
  // Placed at FLOOR_Y so the capsule settles with camera at exactly EYE_HEIGHT.
  _setupFloor() {
    const geo  = new THREE.PlaneGeometry(4000, 4000)
    const mat  = new THREE.MeshBasicMaterial({ visible: false })
    this._floor = new THREE.Mesh(geo, mat)
    this._floor.rotation.x  = -Math.PI / 2
    this._floor.position.y  = FLOOR_Y
    this._floor.updateMatrixWorld(true)
    this.scene.add(this._floor)
    this._floorOctree = buildOctree(this._floor)
  }

  _setupFps() {
    this.camera.instance.position.copy(SPAWN)
    this.camera.instance.lookAt(SPAWN.x + 1, SPAWN.y, SPAWN.z)

    this._fps      = new FpsController(this.experience, this._floorOctree)
    this._crosshair = new CrosshairTarget(this.experience)
    this.experience.interaction.setFpsMode(true)

    this.dialogue.on('open',     () => { this._fps.enabled = false; this._fps.controls.unlock() })
    this.dialogue.on('complete', () => { this._fps.enabled = true;  this._fps.lock() })

    this._callbacks.onFpsReady?.(this._fps)
  }

  async _setupChunks() {
    this._chunks = new CityChunkManager(this.scene, this._material)
    try {
      await this._chunks.init()
      this._chunks.update(SPAWN.x, SPAWN.z)
    } catch (err) {
      console.error('[CityWorld] manifest load failed:', err)
    }
  }

  update() {
    this._fps?.update(this.experience.time.delta)
    this._crosshair?.update()

    if (this._chunks) {
      const { x, z } = this.camera.instance.position
      this._chunks.update(x, z)
    }
  }

  resize() {}

  dispose() {
    this.dialogue.dispose()
    this._fps?.dispose()
    this._crosshair?.dispose()
    this.experience.interaction.setFpsMode(false)
    this._chunks?.dispose()
    this._material?.dispose()
    this._floor?.geometry?.dispose()
    this._floor?.material?.dispose()
  }
}
