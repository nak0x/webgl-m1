/**
 * FpsWorld — POC contrôleur first-person (page /fps)
 *
 * PointerLockControls pour le regard (souris lockée au click).
 * WASD/ZQSD pour se déplacer, Espace pour sauter.
 * Décor : sol + cubes dispersés pour tester la navigation.
 *
 * callbacks.onLockChange(locked) — informe Vue du lock pointer
 */
import * as THREE from 'three'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'

const SPEED     = 5     // unités / seconde
const JUMP_VEL  = 6
const GRAVITY   = 14
const EYE_HEIGHT = 1.7

export default class FpsWorld {
  constructor(experience, callbacks = {}) {
    this.experience = experience
    this.scene      = experience.scene
    this.camera     = experience.camera
    this.sizes      = experience.sizes
    this._callbacks = callbacks

    // Désactiver OrbitControls — on utilise PointerLockControls
    this.camera.autoUpdate = false
    this.camera.controls.enabled = false

    // Config scène
    this.scene.background = new THREE.Color(0xc8dce8)
    this.scene.fog = new THREE.Fog(0xc8dce8, 20, 80)

    // Caméra FPS
    this.camera.instance.position.set(0, EYE_HEIGHT, 5)
    this.camera.instance.rotation.set(0, 0, 0)

    // État du joueur
    this._velocity = new THREE.Vector3()
    this._direction = new THREE.Vector3()
    this._onGround = true
    this._keys = { forward: false, backward: false, left: false, right: false, jump: false }

    this._setup()
  }

  _setup() {
    this._setupControls()
    this._setupLights()
    this._setupFloor()
    this._setupDecor()
    this._setupInput()
  }

  _setupControls() {
    this._plControls = new PointerLockControls(
      this.camera.instance,
      this.experience.canvas,
    )

    this._plControls.addEventListener('lock', () => {
      this._callbacks.onLockChange?.(true)
    })
    this._plControls.addEventListener('unlock', () => {
      this._callbacks.onLockChange?.(false)
    })
  }

  _setupLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.2))

    const sun = new THREE.DirectionalLight(0xfff5e0, 2.5)
    sun.position.set(10, 15, 8)
    sun.castShadow            = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.near    = 1
    sun.shadow.camera.far     = 50
    sun.shadow.camera.left    = -20
    sun.shadow.camera.right   = 20
    sun.shadow.camera.top     = 20
    sun.shadow.camera.bottom  = -20
    this.scene.add(sun)

    const hemi = new THREE.HemisphereLight(0x88aacc, 0x445533, 0.8)
    this.scene.add(hemi)
  }

  _setupFloor() {
    const geo = new THREE.PlaneGeometry(100, 100)
    const mat = new THREE.MeshStandardMaterial({ color: 0x889988, roughness: 0.9 })
    const floor = new THREE.Mesh(geo, mat)
    floor.rotation.x    = -Math.PI / 2
    floor.receiveShadow = true
    this.scene.add(floor)
    this._floorGeo = geo
    this._floorMat = mat
  }

  _setupDecor() {
    // Cubes dispersés pour repérage spatial
    this._decorGeo = new THREE.BoxGeometry(1, 1, 1)
    this._decorMats = []

    const colors = [0xee6644, 0x44aa88, 0x4488cc, 0xccaa44, 0xaa44cc]

    for (let i = 0; i < 30; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: colors[i % colors.length],
        roughness: 0.6,
      })
      this._decorMats.push(mat)

      const sx = 0.5 + Math.random() * 2.5
      const sy = 0.5 + Math.random() * 3
      const sz = 0.5 + Math.random() * 2.5
      const mesh = new THREE.Mesh(this._decorGeo, mat)
      mesh.scale.set(sx, sy, sz)
      mesh.position.set(
        (Math.random() - 0.5) * 40,
        sy / 2,
        (Math.random() - 0.5) * 40,
      )
      mesh.rotation.y = Math.random() * Math.PI
      mesh.castShadow    = true
      mesh.receiveShadow = true
      this.scene.add(mesh)
    }
  }

  _setupInput() {
    this._onKeyDown = (e) => this._setKey(e.code, true)
    this._onKeyUp   = (e) => this._setKey(e.code, false)

    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup',   this._onKeyUp)
  }

  _setKey(code, state) {
    switch (code) {
      case 'KeyW': case 'KeyZ': case 'ArrowUp':    this._keys.forward  = state; break
      case 'KeyS': case 'ArrowDown':                this._keys.backward = state; break
      case 'KeyA': case 'KeyQ': case 'ArrowLeft':   this._keys.left     = state; break
      case 'KeyD': case 'ArrowRight':                this._keys.right    = state; break
      case 'Space':                                  this._keys.jump     = state; break
    }
  }

  /** Appelé depuis la page Vue au click sur le canvas / overlay */
  lock() {
    this._plControls.lock()
  }

  // ── Boucle ──────────────────────────────────────────────────
  update() {
    const delta = Math.min(this.experience.time.delta / 1000, 0.1)
    if (!this._plControls.isLocked) return

    // Friction horizontale
    this._velocity.x *= 0.88
    this._velocity.z *= 0.88

    // Direction de déplacement
    this._direction.z = Number(this._keys.forward) - Number(this._keys.backward)
    this._direction.x = Number(this._keys.right)   - Number(this._keys.left)
    this._direction.normalize()

    if (this._keys.forward  || this._keys.backward) this._velocity.z -= this._direction.z * SPEED * delta * 10
    if (this._keys.left     || this._keys.right)    this._velocity.x += this._direction.x * SPEED * delta * 10

    // Gravité + saut
    if (this._onGround && this._keys.jump) {
      this._velocity.y = JUMP_VEL
      this._onGround = false
    }
    this._velocity.y -= GRAVITY * delta

    // Appliquer le déplacement
    this._plControls.moveRight(this._velocity.x * delta)
    this._plControls.moveForward(-this._velocity.z * delta)
    this.camera.instance.position.y += this._velocity.y * delta

    // Sol
    if (this.camera.instance.position.y < EYE_HEIGHT) {
      this.camera.instance.position.y = EYE_HEIGHT
      this._velocity.y = 0
      this._onGround = true
    }
  }

  resize() {}

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup',   this._onKeyUp)
    this._plControls.dispose()
    this._floorGeo.dispose()
    this._floorMat.dispose()
    this._decorGeo.dispose()
    this._decorMats.forEach(m => m.dispose())
  }
}
