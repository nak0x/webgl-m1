import * as THREE from 'three'

export default class AtelierScene2World {
  constructor(experience, callbacks = {}) {
    this.experience = experience
    this.scene      = experience.scene
    this.camera     = experience.camera
    this._callbacks = callbacks

    this.scene.background = new THREE.Color(0x111118)
    this.scene.fog = new THREE.Fog(0x111118, 25, 70)

    experience.resources.on('ready', () => this._setup())
  }

  _setup() {
    this._setupLights()
    this._setupModel()
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
    this._sun = sun

    const fill = new THREE.DirectionalLight(0x8090ff, 0.25)
    fill.position.set(-5, 3, -3)
    this.scene.add(fill)
    this._fill = fill
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

    // Caméra depuis le GLTF si présente, sinon position par défaut
    if (gltf.cameras?.length > 0) {
      const gltfCam = gltf.cameras[0]
      gltfCam.updateWorldMatrix(true, false)

      const pos  = new THREE.Vector3()
      const quat = new THREE.Quaternion()
      gltfCam.matrixWorld.decompose(pos, quat, new THREE.Vector3())

      this.camera.instance.position.copy(pos)
      this.camera.instance.quaternion.copy(quat)
      this.camera.controls.target.copy(pos).add(
        new THREE.Vector3(0, 0, -1).applyQuaternion(quat)
      )
    } else {
      this.camera.instance.position.set(0, 2, 6)
      this.camera.controls.target.set(0, 1, 0)
    }

    this.camera.controls.enableDamping = true
    this.camera.controls.update()

    if (this.experience.debug.active) {
      const names = []
      this.model.traverse(c => { if (c.isMesh) names.push(c.name) })
      console.log('[AtelierScene2World] meshes GLTF :', names)
    }
  }

  update() {}

  resize() {}

  dispose() {
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
