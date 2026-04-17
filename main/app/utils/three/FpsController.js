/**
 * FpsController — PointerLock + WASD sur la caméra principale.
 *
 * Usage :
 *   this._fps = new FpsController(experience)
 *   // dans update() :
 *   this._fps.update(experience.time.delta)
 *   // dans dispose() :
 *   this._fps.dispose()
 *
 * Clic sur le canvas → lock le pointeur.
 * ESC → déverrouille (comportement natif du navigateur).
 */
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'

export default class FpsController {
  constructor(experience) {
    this._experience = experience
    this._camera     = experience.camera.instance
    this._canvas     = experience.canvas
    this._time       = experience.time

    this.controls = new PointerLockControls(this._camera, document.body)

    // État des touches
    this._keys  = { w: false, a: false, s: false, d: false }
    this.speed  = 4  // unités/seconde, modifiable depuis le World

    this._onKeyDown = this._onKeyDown.bind(this)
    this._onKeyUp   = this._onKeyUp.bind(this)
    this._onClick   = this._onClick.bind(this)

    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup',   this._onKeyUp)
    this._canvas.addEventListener('click', this._onClick)

    // Désactive OrbitControls pour laisser la place au FPS
    experience.camera.autoUpdate     = false
    experience.camera.controls.enabled = false
  }

  get isLocked() {
    return this.controls.isLocked
  }

  update(deltaMs) {
    if (!this.controls.isLocked) return

    const dist = this.speed * (deltaMs / 1000)

    if (this._keys.w) this.controls.moveForward(dist)
    if (this._keys.s) this.controls.moveForward(-dist)
    if (this._keys.a) this.controls.moveRight(-dist)
    if (this._keys.d) this.controls.moveRight(dist)
  }

  _onClick() {
    if (!this.controls.isLocked) this.controls.lock()
  }

  _onKeyDown(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    this._keys.w = true; break
      case 'KeyS': case 'ArrowDown':  this._keys.s = true; break
      case 'KeyA': case 'ArrowLeft':  this._keys.a = true; break
      case 'KeyD': case 'ArrowRight': this._keys.d = true; break
    }
  }

  _onKeyUp(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    this._keys.w = false; break
      case 'KeyS': case 'ArrowDown':  this._keys.s = false; break
      case 'KeyA': case 'ArrowLeft':  this._keys.a = false; break
      case 'KeyD': case 'ArrowRight': this._keys.d = false; break
    }
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup',   this._onKeyUp)
    this._canvas.removeEventListener('click', this._onClick)
    this.controls.dispose()

    // Rétablit OrbitControls
    this._experience.camera.autoUpdate       = true
    this._experience.camera.controls.enabled = true
  }
}
