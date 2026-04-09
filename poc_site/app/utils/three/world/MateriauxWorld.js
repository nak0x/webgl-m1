/**
 * MateriauxWorld — scène de présentation des matériaux (page /materiaux)
 *
 * Contient : 4 sphères (plexiglass, verre, bois, eau), piédestaux,
 * lumières, brouillard, projection screen-space des labels.
 *
 * onLabelsUpdate(positions) — callback appelé à chaque frame avec
 *   positions = [{ x, y }, ...] pour chaque sphère (screen-space).
 */
import * as THREE from 'three'
import { createPlexiglass } from '../materials/createPlexiglass.js'
import { createVerre }      from '../materials/createVerre.js'
import { createBois }       from '../materials/createBois.js'
import { createEau }        from '../materials/createEau.js'

const POSITIONS = [-4.5, -1.5, 1.5, 4.5]

export default class MateriauxWorld {
  constructor(experience, onLabelsUpdate) {
    this.experience       = experience
    this.scene            = experience.scene
    this.camera           = experience.camera
    this.sizes            = experience.sizes
    this._onLabelsUpdate  = onLabelsUpdate

    // ── Configuration de l'expérience pour cette scène ──
    this.scene.background = new THREE.Color(0x0d0d1a)
    experience.renderer.setToneMapping(1.2)
    this.camera.setDamping(true)
    this.camera.instance.position.set(0, 2, 10)
    this.camera.controls.minDistance   = 4
    this.camera.controls.maxDistance   = 25
    this.camera.controls.maxPolarAngle = Math.PI * 0.58
    this.camera.controls.target.set(0, 0, 0)
    this.camera.controls.update()

    this.scene.fog = new THREE.FogExp2(0x0d0d1a, 0.04)

    // Vecteur réutilisable pour la projection screen-space
    this._v3 = new THREE.Vector3()

    this._setupLights()
    this._setupFloor()
    this._setupMaterials()
    this._setupSpheres()
    this._setupPedestals()
  }

  _setupLights() {
    this.scene.add(new THREE.AmbientLight(0x223355, 0.8))

    const keyLight = new THREE.DirectionalLight(0xfff5e0, 3)
    keyLight.position.set(6, 10, 6)
    keyLight.castShadow               = true
    keyLight.shadow.mapSize.set(1024, 1024)
    keyLight.shadow.camera.near       = 1
    keyLight.shadow.camera.far        = 30
    keyLight.shadow.camera.left       = -10
    keyLight.shadow.camera.right      = 10
    keyLight.shadow.camera.top        = 10
    keyLight.shadow.camera.bottom     = -10
    this.scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0x4488ff, 1.2)
    fillLight.position.set(-6, 4, -4)
    this.scene.add(fillLight)

    const rimLight = new THREE.PointLight(0x00ffcc, 8, 20)
    rimLight.position.set(0, 6, -6)
    this.scene.add(rimLight)
  }

  _setupFloor() {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.15, metalness: 0.6 }),
    )
    floor.rotation.x    = -Math.PI / 2
    floor.position.y    = -1.5
    floor.receiveShadow = true
    this.scene.add(floor)
  }

  _setupMaterials() {
    this._plexi = createPlexiglass()
    this._verre = createVerre()
    this._bois  = createBois()
    this._eau   = createEau()
  }

  _setupSpheres() {
    this._geo = new THREE.SphereGeometry(1.1, 64, 48)

    const mats = [
      this._plexi.material,
      this._verre.material,
      this._bois.material,
      this._eau.material,
    ]

    this._spheres = mats.map((mat, i) => {
      const mesh = new THREE.Mesh(this._geo, mat)
      mesh.position.set(POSITIONS[i], 0, 0)
      mesh.castShadow    = i >= 2
      mesh.receiveShadow = true
      this.scene.add(mesh)
      return mesh
    })
  }

  _setupPedestals() {
    this._pedGeo = new THREE.CylinderGeometry(0.5, 0.65, 0.18, 32)
    this._pedMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.4, metalness: 0.7 })

    POSITIONS.forEach(x => {
      const ped = new THREE.Mesh(this._pedGeo, this._pedMat)
      ped.position.set(x, -1.22, 0)
      ped.receiveShadow = true
      this.scene.add(ped)
    })
  }

  /** Projette une position world en coordonnées screen-space (px). */
  _project(worldPos) {
    this._v3.copy(worldPos).project(this.camera.instance)
    return {
      x: (this._v3.x *  0.5 + 0.5) * this.sizes.width,
      y: (this._v3.y * -0.5 + 0.5) * this.sizes.height,
    }
  }

  /** Appelé par Experience._update() à chaque frame */
  update() {
    const t = this.experience.time.elapsed / 1000

    // Rotation & lévitation des sphères
    this._spheres[0].rotation.y =  t * 0.18
    this._spheres[1].rotation.y = -t * 0.14
    this._spheres[2].rotation.y =  t * 0.22
    this._spheres[3].rotation.y =  t * 0.10
    this._spheres.forEach((s, i) => {
      s.position.y = Math.sin(t * 0.7 + i * 1.1) * 0.12
    })

    // Mise à jour uniforms eau
    this._eau.uniforms.uTime.value = t
    this._eau.uniforms.uCameraPos.value.copy(this.camera.instance.position)

    // Mise à jour positions des labels (sous les sphères)
    if (this._onLabelsUpdate) {
      const positions = this._spheres.map(s => this._project(
        new THREE.Vector3(s.position.x, s.position.y - 1.45, s.position.z)
      ))
      this._onLabelsUpdate(positions)
    }
  }

  dispose() {
    this._plexi.dispose()
    this._verre.dispose()
    this._bois.dispose()
    this._eau.dispose()
    this._geo.dispose()
    this._pedGeo.dispose()
    this._pedMat.dispose()
  }
}
