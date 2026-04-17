import * as THREE from 'three'

export default class AtelierWorld {
  constructor(experience) {
    this.experience = experience
    this.scene      = experience.scene
    this.camera     = experience.camera
    this.resources  = experience.resources

    // Fond sombre atelier
    this.scene.background = new THREE.Color(0x1a1a1a)
    this.scene.fog = new THREE.Fog(0x1a1a1a, 20, 60)

    // Position caméra initiale
    this.camera.instance.position.set(0, 2, 6)
    this.camera.controls.target.set(0, 1, 0)
    this.camera.controls.enableDamping = true
    this.camera.controls.dampingFactor = 0.05
    this.camera.controls.update()

    this.resources.on('ready', () => this._setup())
  }

  _setup() {
    this._setupLights()
    this._setupModel()
    this._setupFloor()
  }

  _setupLights() {
    // Lumière ambiante douce
    const ambient = new THREE.AmbientLight(0xfff5e0, 0.4)
    this.scene.add(ambient)

    // Lumière principale — plafond de l'atelier
    const ceiling = new THREE.DirectionalLight(0xfff5e0, 1.5)
    ceiling.position.set(2, 8, 4)
    ceiling.castShadow = true
    ceiling.shadow.mapSize.set(2048, 2048)
    ceiling.shadow.camera.near = 0.1
    ceiling.shadow.camera.far  = 30
    ceiling.shadow.camera.left   = -8
    ceiling.shadow.camera.right  =  8
    ceiling.shadow.camera.top    =  8
    ceiling.shadow.camera.bottom = -8
    this.scene.add(ceiling)

    // Lumière de remplissage latérale
    const fill = new THREE.DirectionalLight(0x80a0ff, 0.3)
    fill.position.set(-5, 3, -2)
    this.scene.add(fill)
  }

  _setupModel() {
    const gltf = this.resources.items.atelier
    if (!gltf) return

    this.model = gltf.scene

    // Ombres sur tous les meshes
    this.model.traverse(child => {
      if (child.isMesh) {
        child.castShadow    = true
        child.receiveShadow = true
      }
    })

    // Centrer le modèle
    const box    = new THREE.Box3().setFromObject(this.model)
    const center = box.getCenter(new THREE.Vector3())
    this.model.position.sub(center)
    this.model.position.y += (box.getSize(new THREE.Vector3()).y / 2)

    this.scene.add(this.model)
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

  update() {
    // animations, mise à jour des uniforms, etc.
  }

  dispose() {
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
