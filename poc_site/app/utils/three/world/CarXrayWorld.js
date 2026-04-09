/**
 * CarXrayWorld — scène X-ray d'un véhicule (page /car_xray)
 *
 * Charge le GLTF Voiture_2.gltf dont chaque node est une pièce nommée.
 * Chaque pièce reçoit un matériau X-ray Fresnel dont la couleur
 * dépend de son état de casse (bon → vert, critique → rouge).
 *
 * callbacks.onPartsReady(parts)          — liste initiale des pièces
 * callbacks.onHighlight(partName | null) — pièce sous le curseur
 */
import * as THREE from 'three'
import { createXray } from '../materials/createXray.js'

// ── Couleurs par niveau de casse ──────────────────────────────
const DAMAGE_COLORS = {
  bon:       new THREE.Color(0x00ff88), // vert
  use:       new THREE.Color(0xffcc00), // jaune
  endommage: new THREE.Color(0xff6600), // orange
  critique:  new THREE.Color(0xff0044), // rouge
}

const DAMAGE_LEVELS = Object.keys(DAMAGE_COLORS)

export { DAMAGE_LEVELS, DAMAGE_COLORS }

// ── World ─────────────────────────────────────────────────────
export default class CarXrayWorld {
  constructor(experience, callbacks = {}) {
    this.experience = experience
    this.scene      = experience.scene
    this.camera     = experience.camera
    this.sizes      = experience.sizes

    this._callbacks = callbacks
    this._parts     = []        // { name, object3d, xray, damageLevel }
    this._highlight = null
    this._raycaster = new THREE.Raycaster()
    this._mouse     = new THREE.Vector2(9999, 9999)

    // ── Config scène ──
    // Fond légèrement grisé (pas blanc pur) pour que l'additive soit visible
    this.scene.background = new THREE.Color(0xdce8f0)
    this.scene.fog = new THREE.Fog(0xdce8f0, 10, 28)
    experience.renderer.setToneMapping(1.0)
    this.camera.setDamping(true)
    this.camera.instance.position.set(3, 2, 3)
    this.camera.controls.target.set(0, 0.35, 0)
    this.camera.controls.minDistance   = 1.5
    this.camera.controls.maxDistance   = 10
    this.camera.controls.maxPolarAngle = Math.PI * 0.55
    this.camera.controls.update()

    experience.resources.on('ready', () => this._setup())
  }

  _setup() {
    this._setupLights()
    this._setupFloor()
    this._setupCar()
    this._setupInput()

    if (this._callbacks.onPartsReady) {
      this._callbacks.onPartsReady(
        this._parts.map(p => ({ name: p.name, damageLevel: p.damageLevel })),
      )
    }
  }

  _setupLights() {
    // Lumière ambiante douce blanc chaud
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.8))

    // Key light (principale, légère ombre)
    const key = new THREE.DirectionalLight(0xffffff, 3.0)
    key.position.set(4, 8, 4)
    key.castShadow              = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.near      = 1
    key.shadow.camera.far       = 25
    key.shadow.camera.left      = -4
    key.shadow.camera.right     = 4
    key.shadow.camera.top       = 4
    key.shadow.camera.bottom    = -4
    key.shadow.bias             = -0.002
    this.scene.add(key)

    // Fill light (gauche, plus doux)
    const fill = new THREE.DirectionalLight(0xddeeff, 1.4)
    fill.position.set(-5, 4, -2)
    this.scene.add(fill)

    // Rim light (derrière la voiture, découpe la silhouette)
    const rim = new THREE.DirectionalLight(0xffffff, 1.0)
    rim.position.set(0, 3, -6)
    this.scene.add(rim)
  }

  _setupFloor() {
    // Sol blanc avec ombre portée
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({
        color:     0xffffff,
        roughness: 0.45,
        metalness: 0.0,
      }),
    )
    floor.rotation.x    = -Math.PI / 2
    floor.position.y    = -0.04
    floor.receiveShadow = true
    this.scene.add(floor)

    // Grille très subtile pour donner la profondeur
    const grid = new THREE.GridHelper(30, 60, 0xcccccc, 0xdddddd)
    grid.position.y = -0.035
    this.scene.add(grid)
  }

  _setupCar() {
    const gltf = this.experience.resources.items.carXray
    this._carGroup = gltf.scene

    // Parcourir chaque enfant direct du modèle — chaque node = une pièce
    this._carGroup.children.forEach(child => {
      if (!child.name) return

      const xray = createXray({ color: DAMAGE_COLORS.bon })

      // Appliquer le matériau X-ray à tous les meshes de la pièce
      if (child.isMesh) {
        child.material = xray.material
      } else {
        child.traverse(c => {
          if (c.isMesh) c.material = xray.material
        })
      }

      this._parts.push({
        name: child.name,
        object3d: child,
        xray,
        damageLevel: 'bon',
        baseEdgeOpacity: xray.uniforms.uEdgeOpacity.value,
      })
    })

    this.scene.add(this._carGroup)
  }

  _setupInput() {
    this._onMouseMove = (e) => {
      this._mouse.x =  (e.clientX / this.sizes.width)  * 2 - 1
      this._mouse.y = -(e.clientY / this.sizes.height) * 2 + 1
    }
    window.addEventListener('mousemove', this._onMouseMove)
  }

  // ── API publique appelée depuis Vue ─────────────────────────
  setPartDamage(partName, level) {
    const part = this._parts.find(p => p.name === partName)
    if (!part || !DAMAGE_COLORS[level]) return
    part.damageLevel = level
    part.xray.setColor(DAMAGE_COLORS[level])
  }

  /** Applique les params shader à toutes les pièces simultanément */
  setShaderParams(params) {
    this._parts.forEach(p => {
      p.xray.setParams(params)
      if (params.edgeOpacity !== undefined) p.baseEdgeOpacity = params.edgeOpacity
    })
  }

  getPartNames() {
    return this._parts.map(p => p.name)
  }

  // ── Boucle ──────────────────────────────────────────────────
  update() {
    if (!this._carGroup) return

    const t = this.experience.time.elapsed / 1000

    // Légère rotation du groupe complet
    this._carGroup.rotation.y = Math.sin(t * 0.15) * 0.1

    // Raycast pour le hover
    this._raycaster.setFromCamera(this._mouse, this.camera.instance)
    const meshes = []
    this._parts.forEach(p => {
      p.object3d.traverse(c => { if (c.isMesh) meshes.push(c) })
    })
    const hits = this._raycaster.intersectObjects(meshes)

    let hoveredPart = null
    if (hits.length > 0) {
      const hitObj = hits[0].object
      hoveredPart = this._parts.find(p => {
        if (p.object3d === hitObj) return true
        let found = false
        p.object3d.traverse(c => { if (c === hitObj) found = true })
        return found
      })
    }

    // Mise à jour du highlight (pulse l'edge sur la pièce survolée)
    this._parts.forEach(p => {
      const isHovered = hoveredPart === p
      p.xray.uniforms.uEdgeOpacity.value = isHovered
        ? Math.min(1.0, p.baseEdgeOpacity * 1.3 + Math.sin(t * 6) * 0.1)
        : p.baseEdgeOpacity
    })

    const newHighlight = hoveredPart?.name ?? null
    if (newHighlight !== this._highlight) {
      this._highlight = newHighlight
      this._callbacks.onHighlight?.(newHighlight)
    }
  }

  resize() {}

  dispose() {
    window.removeEventListener('mousemove', this._onMouseMove)
    this._parts.forEach(p => p.xray.dispose())
  }
}
