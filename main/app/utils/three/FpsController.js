import { PointerLockControls } from '/lib/addons/controls/PointerLockControls.js'
import { Capsule } from '/lib/addons/math/Capsule.js'
import { Vector3 } from '/lib/three.js'

const GRAVITY        = 30
const WALK_SPEED     = 8
const DAMPING        = 8
const CAPSULE_RADIUS = 0.3
const EYE_HEIGHT     = 1.0   // distance start → end (hauteur du cylindre)

const _forward = new Vector3()
const _right   = new Vector3()
const _move    = new Vector3()
const _delta   = new Vector3()
const _up      = new Vector3(0, 1, 0)

export default class FpsController {
  constructor(experience, octree) {
    this._experience = experience
    this._camera     = experience.camera.instance
    this._canvas     = experience.canvas
    this._octree     = octree
    this._collisionManager = null

    this.controls = new PointerLockControls(this._camera, document.body)
    this._keys       = { w: false, a: false, s: false, d: false }
    this.speed       = WALK_SPEED
    this.enabled     = true
    this._walkHandle = null

    this._velocity = new Vector3()
    this._onFloor  = false

    const eye = this._camera.position
    this._capsule = new Capsule(
      new Vector3(eye.x, eye.y - EYE_HEIGHT, eye.z),
      new Vector3(eye.x, eye.y,              eye.z),
      CAPSULE_RADIUS,
    )

    this._crosshairEl = this._createCrosshair()

    this._onKeyDown = this._onKeyDown.bind(this)
    this._onKeyUp   = this._onKeyUp.bind(this)
    this._onClick   = this._onClick.bind(this)

    this.controls.addEventListener('lock',   () => { if (!this._cinematicActive) this._crosshairEl.style.opacity = '1' })
    this.controls.addEventListener('unlock', () => {
      this._crosshairEl.style.opacity = '0'
      this._stopWalk()
      this._keys.w = this._keys.a = this._keys.s = this._keys.d = false
    })

    this._cinematicActive = false
    this._onCinematicStart = () => {
      this._cinematicActive = true
      this._crosshairEl.style.opacity = '0'
    }
    this._onCinematicEnd = () => {
      this._cinematicActive = false
      if (this.controls.isLocked) this._crosshairEl.style.opacity = '1'
    }
    experience.cinematic?.on('start', this._onCinematicStart)
    experience.cinematic?.on('end',   this._onCinematicEnd)

    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup',   this._onKeyUp)
    this._canvas.addEventListener('click', this._onClick)

    experience.camera.autoUpdate       = false
    experience.camera.controls.enabled = false
  }

  get isLocked() { return this.controls.isLocked }

  // PointerLockControls.lock() calls requestPointerLock() but discards its
  // Promise, causing uncaught rejections when called without a user gesture
  // or when already locked. We call the DOM API directly to catch those cases.
  lock() {
    if (this.controls.isLocked) return
    this.controls.domElement.requestPointerLock()?.catch(() => {})
  }

  setCollisionManager(cm) { this._collisionManager = cm }

  hideCrosshair() { this._crosshairEl.style.opacity = '0' }
  showCrosshair() { if (this.controls.isLocked && !this._cinematicActive) this._crosshairEl.style.opacity = '1' }

  _createCrosshair() {
    const el = document.createElement('div')
    el.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 18px;
      height: 18px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s;
      z-index: 1000;
    `
    el.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="9" y1="0" x2="9" y2="7"  stroke="white" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="9" y1="11" x2="9" y2="18" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="0" y1="9" x2="7"  y2="9" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="11" y1="9" x2="18" y2="9" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    `
    document.body.appendChild(el)
    return el
  }

  update(deltaMs) {
    if (!this.controls.isLocked || !this.enabled) return

    const dt = Math.min(deltaMs / 1000, 0.05)

    this._camera.getWorldDirection(_forward)
    _forward.y = 0
    _forward.normalize()
    _right.crossVectors(_forward, _up)

    _move.set(0, 0, 0)
    if (this._keys.w) _move.addScaledVector(_forward,  1)
    if (this._keys.s) _move.addScaledVector(_forward, -1)
    if (this._keys.a) _move.addScaledVector(_right,   -1)
    if (this._keys.d) _move.addScaledVector(_right,    1)
    if (_move.lengthSq() > 0) _move.normalize()

    const accel = this._onFloor ? this.speed : this.speed * 0.3
    this._velocity.x += _move.x * accel * dt * 9
    this._velocity.z += _move.z * accel * dt * 9
    const damp = Math.exp(-DAMPING * dt)
    this._velocity.x *= damp
    this._velocity.z *= damp

    if (this._onFloor) {
      this._velocity.y = Math.max(0, this._velocity.y)
    } else {
      this._velocity.y -= GRAVITY * dt
    }

    _delta.copy(this._velocity).multiplyScalar(dt)
    if (this._collisionManager) {
      const { x, z } = this._capsule.end
      const { dx, dz } = this._collisionManager.resolveMovement(x, z, _delta.x, _delta.z)
      if (dx === 0 && _delta.x !== 0) this._velocity.x = 0
      if (dz === 0 && _delta.z !== 0) this._velocity.z = 0
      _delta.x = dx
      _delta.z = dz
    }
    this._capsule.translate(_delta)
    this._resolveCollisions()
    this._camera.position.copy(this._capsule.end)
  }

  _resolveCollisions() {
    const result = this._octree.capsuleIntersect(this._capsule)
    this._onFloor = false
    if (!result) return

    this._onFloor = result.normal.y > 0

    if (!this._onFloor) {
      const vn = result.normal.dot(this._velocity)
      this._velocity.addScaledVector(result.normal, -vn)
    } else {
      this._velocity.y = Math.max(0, this._velocity.y)
    }

    this._capsule.translate(result.normal.multiplyScalar(result.depth))
  }

  _onClick() {
    this.lock()
  }

  _onKeyDown(e) {
    if (e.repeat) return
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    this._keys.w = true; break
      case 'KeyS': case 'ArrowDown':  this._keys.s = true; break
      case 'KeyA': case 'ArrowLeft':  this._keys.a = true; break
      case 'KeyD': case 'ArrowRight': this._keys.d = true; break
      case 'KeyG': this._experience.glasses?.toggle(); break
    }
    if (!this._walkHandle && this._isMoving) {
      this._walkHandle = this._experience.sound?.play('walk', { loop: true }) ?? null
    }
  }

  _onKeyUp(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    this._keys.w = false; break
      case 'KeyS': case 'ArrowDown':  this._keys.s = false; break
      case 'KeyA': case 'ArrowLeft':  this._keys.a = false; break
      case 'KeyD': case 'ArrowRight': this._keys.d = false; break
    }
    if (!this._isMoving) this._stopWalk()
  }

  get _isMoving() {
    return this._keys.w || this._keys.s || this._keys.a || this._keys.d
  }

  _stopWalk() {
    this._walkHandle?.stop()
    this._walkHandle = null
  }

  dispose() {
    this._stopWalk()
    this._experience.cinematic?.off('start', this._onCinematicStart)
    this._experience.cinematic?.off('end',   this._onCinematicEnd)
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup',   this._onKeyUp)
    this._canvas.removeEventListener('click', this._onClick)
    this._crosshairEl.remove()
    // PointerLockControls.dispose() removes listeners but does NOT call
    // exitPointerLock — the lock persists across scene transitions. Release
    // explicitly so the next scene's FPS controller can lock cleanly.
    if (this.controls.isLocked) this.controls.unlock()
    this.controls.dispose()

    this._experience.camera.autoUpdate       = true
    this._experience.camera.controls.enabled = true
  }
}
