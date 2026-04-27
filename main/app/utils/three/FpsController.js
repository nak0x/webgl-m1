import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'
import { Vector3 } from 'three'

const _forward = new Vector3()
const _right   = new Vector3()
const _moveDir = new Vector3()
const _up      = new Vector3(0, 1, 0)

export default class FpsController {
  constructor(experience) {
    this._experience = experience
    this._camera     = experience.camera.instance
    this._canvas     = experience.canvas

    this.controls = new PointerLockControls(this._camera, document.body)

    this._keys      = { w: false, a: false, s: false, d: false }
    this.speed      = 4
    this.enabled    = true

    this._character = null

    this._crosshairEl = this._createCrosshair()

    this._onKeyDown = this._onKeyDown.bind(this)
    this._onKeyUp   = this._onKeyUp.bind(this)
    this._onClick   = this._onClick.bind(this)

    this.controls.addEventListener('lock',   () => { this._crosshairEl.style.opacity = '1' })
    this.controls.addEventListener('unlock', () => { this._crosshairEl.style.opacity = '0' })

    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup',   this._onKeyUp)
    this._canvas.addEventListener('click', this._onClick)

    experience.camera.autoUpdate       = false
    experience.camera.controls.enabled = false
  }

  setCharacter(character) {
    this._character = character
  }

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

  get isLocked() {
    return this.controls.isLocked
  }

  lock() {
    this.controls.lock()
  }

  update(deltaMs) {
    if (!this.controls.isLocked || !this.enabled || !this._character) return

    const dt = deltaMs / 1000
    const { body, collider, controller } = this._character

    this._camera.getWorldDirection(_forward)
    _forward.y = 0
    _forward.normalize()
    _right.crossVectors(_forward, _up)

    _moveDir.set(0, 0, 0)
    if (this._keys.w) _moveDir.addScaledVector(_forward,  1)
    if (this._keys.s) _moveDir.addScaledVector(_forward, -1)
    if (this._keys.a) _moveDir.addScaledVector(_right,   -1)
    if (this._keys.d) _moveDir.addScaledVector(_right,    1)
    if (_moveDir.lengthSq() > 0) _moveDir.normalize()
    _moveDir.multiplyScalar(this.speed * dt)
    _moveDir.y = 0

    controller.computeColliderMovement(collider, _moveDir)
    const corrected = controller.computedMovement()

    const pos = body.translation()
    body.setNextKinematicTranslation({
      x: pos.x + corrected.x,
      y: pos.y,
      z: pos.z + corrected.z,
    })

    const newPos = body.translation()
    this._camera.position.x = newPos.x
    this._camera.position.z = newPos.z
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
    this._crosshairEl.remove()
    this.controls.dispose()

    this._experience.camera.autoUpdate       = true
    this._experience.camera.controls.enabled = true
  }
}
