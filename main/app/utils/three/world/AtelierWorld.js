import * as THREE    from 'three'
import FpsController from '../FpsController.js'

export default class AtelierWorld {
  constructor(experience) {
    this.experience  = experience
    this.scene       = experience.scene
    this.camera      = experience.camera
    this.resources   = experience.resources

    // Fond sombre atelier
    this.scene.background = new THREE.Color(0x1a1a1a)
    this.scene.fog = new THREE.Fog(0x1a1a1a, 20, 60)

    this.resources.on('ready', () => this._setup())
  }

  _setup() {
    this._setupLights()
    this._setupModel()
    this._setupFloor()
    this._setupFps()
  }

  _setupLights() {
    const ambient = new THREE.AmbientLight(0xfff5e0, 0.4)
    this.scene.add(ambient)

    const ceiling = new THREE.DirectionalLight(0xfff5e0, 1.5)
    ceiling.position.set(2, 8, 4)
    ceiling.castShadow = true
    ceiling.shadow.mapSize.set(2048, 2048)
    ceiling.shadow.camera.near   = 0.1
    ceiling.shadow.camera.far    = 30
    ceiling.shadow.camera.left   = -8
    ceiling.shadow.camera.right  =  8
    ceiling.shadow.camera.top    =  8
    ceiling.shadow.camera.bottom = -8
    this.scene.add(ceiling)

    const fill = new THREE.DirectionalLight(0x80a0ff, 0.3)
    fill.position.set(-5, 3, -2)
    this.scene.add(fill)
  }

  _setupModel() {
    const gltf = this.resources.items.atelier
    if (!gltf) return

    this.model = gltf.scene

    this.model.traverse(child => {
      if (child.isMesh) {
        child.castShadow    = true
        child.receiveShadow = true
      }
    })

    this.scene.add(this.model)

    // Récupère la caméra embarquée dans le GLB
    // gltf.cameras liste toutes les caméras exportées depuis Blender
    if (gltf.cameras?.length > 0) {
      const gltfCam = gltf.cameras[0]

      // S'assure que la matrice monde est à jour
      gltfCam.updateWorldMatrix(true, false)

      const pos  = new THREE.Vector3()
      const quat = new THREE.Quaternion()
      gltfCam.matrixWorld.decompose(pos, quat, new THREE.Vector3())

      this.camera.instance.position.copy(pos)
      this.camera.instance.quaternion.copy(quat)

      console.log('[AtelierWorld] Camera GLB utilisée :', gltfCam.name, pos)
    } else {
      // Fallback si pas de caméra dans le GLB
      this.camera.instance.position.set(0, 1.7, 0)
      this.camera.instance.lookAt(0, 1.7, -1)
      console.warn('[AtelierWorld] Aucune caméra trouvée dans le GLB — position fallback')
    }
  }

  _setupFloor() {
    const geo = new THREE.PlaneGeometry(30, 30)
    const mat = new THREE.MeshStandardMaterial({
      color:     0x2a2a2a,
      roughness: 0.9,
      metalness: 0.1,
    })
    const floor = new THREE.Mesh(geo, mat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.scene.add(floor)

    this._floorGeo = geo
    this._floorMat = mat
  }

  _setupFps() {
    this._fps = new FpsController(this.experience)
    this.experience.interaction.setFpsMode(true)
  }

  update() {
    this._fps?.update(this.experience.time.delta)
  }

  dispose() {
    this._fps?.dispose()
    this.experience.interaction.setFpsMode(false)

    this._floorGeo?.dispose()
    this._floorMat?.dispose()

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
