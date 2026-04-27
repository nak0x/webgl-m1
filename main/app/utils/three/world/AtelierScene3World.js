import * as THREE       from 'three'
import FpsController   from '../FpsController.js'
import CrosshairTarget from '../CrosshairTarget.js'
import DialogueManager from '../dialogue/DialogueManager.js'
import { buildOctree } from '../buildOctree.js'

export default class AtelierScene3World {
  constructor(experience, callbacks = {}) {
    this.experience = experience
    this.scene      = experience.scene
    this.camera     = experience.camera
    this._callbacks = callbacks

    this.scene.background = new THREE.Color(0x0a0a12)
    this.scene.fog = new THREE.Fog(0x0a0a12, 20, 60)

    this.dialogue = new DialogueManager()
    experience.setDialogue(this.dialogue)

    experience.resources.on('ready', () => this._setup())
  }

  _setup() {
    this._setupLights()
    this._setupModel()
    this._setupFps()
  }

  _setupLights() {
    this.scene.add(new THREE.AmbientLight(0xfff5e0, 0.5))

    const sun = new THREE.DirectionalLight(0xfff5e0, 1.8)
    sun.position.set(3, 8, 4)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near   = 0.1
    sun.shadow.camera.far    = 30
    sun.shadow.camera.left   = -10
    sun.shadow.camera.right  =  10
    sun.shadow.camera.top    =  10
    sun.shadow.camera.bottom = -10
    this.scene.add(sun)

    const fill = new THREE.DirectionalLight(0x8090ff, 0.25)
    fill.position.set(-5, 3, -3)
    this.scene.add(fill)
  }

  _setupModel() {
    const gltf = this.experience.resources.items.atelierScene2
    if (!gltf) return

    this.model = gltf.scene
    this.model.traverse(child => {
      if (child.isMesh) {
        child.castShadow    = true
        child.receiveShadow = true
      }
    })
    this.scene.add(this.model)

    if (gltf.cameras?.length > 0) {
      const gltfCam = gltf.cameras[0]
      gltfCam.updateWorldMatrix(true, false)
      const pos  = new THREE.Vector3()
      const quat = new THREE.Quaternion()
      gltfCam.matrixWorld.decompose(pos, quat, new THREE.Vector3())
      this.camera.instance.position.copy(pos)
      this.camera.instance.quaternion.copy(quat)
    } else {
      this.camera.instance.position.set(0, 1.7, 0)
      this.camera.instance.lookAt(0, 1.7, -1)
    }

    if (this.experience.debug.active) {
      const names = []
      this.model.traverse(c => { if (c.isMesh) names.push(c.name) })
      console.log('[AtelierScene3World] meshes GLTF :', names)
    }
  }

  _setupFps() {
    this._fps             = new FpsController(this.experience, buildOctree(this.scene))
    this._crosshairTarget = new CrosshairTarget(this.experience)
    this.experience.interaction.setFpsMode(true)

    this.dialogue.on('open',     () => { this._fps.enabled = false; this._fps.controls.unlock() })
    this.dialogue.on('complete', () => { this._fps.enabled = true;  this._fps.lock() })

    this._callbacks.onFpsReady?.(this._fps)
  }

  update() {
    this._fps?.update(this.experience.time.delta)
    this._crosshairTarget?.update()
  }

  resize() {}

  dispose() {
    this.dialogue.dispose()
    this._fps?.dispose()
    this._crosshairTarget?.dispose()
    this.experience.interaction.setFpsMode(false)

    if (this.model) {
      this.model.traverse(child => {
        child.geometry?.dispose()
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material]
          mats.forEach(m => m.dispose?.())
        }
      })
    }
  }
}
