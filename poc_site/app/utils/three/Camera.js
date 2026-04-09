/**
 * Camera — caméra principale + OrbitControls
 * Reçoit l'Experience pour accéder à sizes, scene et canvas.
 * Le resize et l'update sont coordonnés par Experience (pas d'écoute interne).
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export default class Camera {
  constructor(experience) {
    this.experience = experience
    this.sizes  = experience.sizes
    this.scene  = experience.scene
    this.canvas = experience.canvas

    // Si false, Experience n'appellera pas controls.update() automatiquement.
    // Utile quand le World gère plusieurs controls (ex: multi-caméra).
    this.autoUpdate = true

    this._setInstance()
    this._setControls()
  }

  _setInstance() {
    this.instance = new THREE.PerspectiveCamera(
      60,
      this.sizes.width / this.sizes.height,
      0.1,
      200,
    )
    this.instance.position.set(0, 4, 8)
  }

  _setControls() {
    this.controls = new OrbitControls(this.instance, this.canvas)
    this.controls.target.set(0, 0, 0)
    this.controls.update()
  }

  /** Active le damping des OrbitControls. */
  setDamping(enabled, factor = 0.05) {
    this.controls.enableDamping = enabled
    if (enabled) this.controls.dampingFactor = factor
  }

  /** Appelé par Experience._resize() */
  resize() {
    this.instance.aspect = this.sizes.width / this.sizes.height
    this.instance.updateProjectionMatrix()
  }

  /** Appelé par Experience._update() */
  update() {
    if (this.autoUpdate) this.controls.update()
  }

  dispose() {
    this.controls.dispose()
  }
}
