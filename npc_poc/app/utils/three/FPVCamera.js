/**
 * FPVCamera — First-Person View camera with PointerLockControls + WASD
 *
 * Same public interface as Camera (update, resize, dispose) so Experience
 * can treat them interchangeably (Strategy pattern).
 *
 * Click to lock pointer, ESC to release. WASD to move, mouse to look.
 * Camera sits at human eye height (1.7 units).
 */
import * as THREE from 'three'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'

const _direction = new THREE.Vector3()

export default class FPVCamera {
  /**
   * @param {Experience} experience
   * @param {object}     opts
   * @param {number}     opts.height       — eye height (default 1.7)
   * @param {number}     opts.moveSpeed    — units / second (default 5)
   * @param {Function}   opts.onLock       — called when pointer is locked
   * @param {Function}   opts.onUnlock     — called when pointer is unlocked
   */
  constructor(experience, opts = {}) {
    this.experience = experience
    this.sizes  = experience.sizes
    this.scene  = experience.scene
    this.canvas = experience.canvas

    this._height    = opts.height    ?? 1.7
    this._moveSpeed = opts.moveSpeed ?? 5
    this._onLockCb   = opts.onLock   ?? null
    this._onUnlockCb = opts.onUnlock ?? null

    // Keyboard state
    this._keys = { w: false, a: false, s: false, d: false }

    this._setInstance()
    this._setControls()
    this._setKeyboard()
  }

  /* ── public getters ─────────────────────────────────────── */

  /** The underlying PerspectiveCamera used for rendering. */
  get instance() { return this._camera }

  /** Whether the pointer is currently locked. */
  get isLocked() { return this._controls.isLocked }

  /* ── setup ──────────────────────────────────────────────── */

  _setInstance() {
    this._camera = new THREE.PerspectiveCamera(
      75,
      this.sizes.width / this.sizes.height,
      0.1,
      500,
    )
    this._camera.position.set(0, this._height, 0)
  }

  _setControls() {
    this._controls = new PointerLockControls(this._camera, this.canvas)

    // Wire lock / unlock callbacks
    this._controls.addEventListener('lock', () => {
      this._onLockCb?.()
    })
    this._controls.addEventListener('unlock', () => {
      this._onUnlockCb?.()
    })

    // Click on canvas → lock
    this._onCanvasClick = () => {
      if (!this._controls.isLocked) this._controls.lock()
    }
    this.canvas.addEventListener('click', this._onCanvasClick)
  }

  _setKeyboard() {
    this._onKeyDown = (e) => {
      const k = e.key.toLowerCase()
      if (k in this._keys) this._keys[k] = true
    }
    this._onKeyUp = (e) => {
      const k = e.key.toLowerCase()
      if (k in this._keys) this._keys[k] = false
    }
    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup',   this._onKeyUp)
  }

  /* ── per-frame (called by Experience) ───────────────────── */

  /**
   * @param {number} delta — time in ms since last frame
   */
  update(delta) {
    if (!this._controls.isLocked) return

    const speed = this._moveSpeed * (delta / 1000)

    _direction.set(0, 0, 0)
    if (this._keys.w) _direction.z -= 1
    if (this._keys.s) _direction.z += 1
    if (this._keys.a) _direction.x -= 1
    if (this._keys.d) _direction.x += 1

    if (_direction.lengthSq() === 0) return
    _direction.normalize()

    // Move relative to camera orientation (horizontal only)
    this._controls.moveRight(_direction.x * speed)
    this._controls.moveForward(-_direction.z * speed)

    // Lock Y to eye height
    this._camera.position.y = this._height
  }

  /* ── resize ─────────────────────────────────────────────── */

  resize() {
    this._camera.aspect = this.sizes.width / this.sizes.height
    this._camera.updateProjectionMatrix()
  }

  /* ── cleanup ────────────────────────────────────────────── */

  dispose() {
    this.canvas.removeEventListener('click', this._onCanvasClick)
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup',   this._onKeyUp)
    this._controls.dispose()
  }
}
