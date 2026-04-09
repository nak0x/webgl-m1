/**
 * InteractWorld — FPS + système d'interaction (page /interact)
 *
 * Reprend la mécanique FPS (PointerLock + WASD + gravité).
 * Ajoute un système d'interaction simple :
 *
 *   // Interaction par le REGARD (raycast depuis le réticule + touche E)
 *   this.addInteractive(mesh, {
 *     prompt:      'Appuyer sur E pour lire',
 *     maxDistance:  3,
 *     onInteract:  () => { ... },
 *     onEnter:     () => { ... },   // regard entre sur l'objet
 *     onLeave:     () => { ... },   // regard quitte l'objet
 *   })
 *
 *   // Interaction par PROXIMITÉ (le joueur marche dans une zone)
 *   this.addZone({ x: 5, y: 0, z: 3 }, 3, {
 *     onEnter: () => { ... },       // le joueur entre dans le rayon
 *     onLeave: () => { ... },       // le joueur sort du rayon
 *   })
 *
 * Callbacks vers Vue :
 *   onLockChange(locked)           — pointer lock activé/désactivé
 *   onPromptChange(text | null)    — texte d'action à afficher (null = rien)
 *   onMessage(text | null)         — message/texte à afficher en overlay
 */
import * as THREE from 'three'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'

const SPEED      = 5
const JUMP_VEL   = 6
const GRAVITY    = 14
const EYE_HEIGHT = 1.7

export default class InteractWorld {
  constructor(experience, callbacks = {}) {
    this.experience = experience
    this.scene      = experience.scene
    this.camera     = experience.camera
    this.sizes      = experience.sizes
    this._callbacks = callbacks

    // Désactiver OrbitControls
    this.camera.autoUpdate = false
    this.camera.controls.enabled = false

    // Config scène
    this.scene.background = new THREE.Color(0xc8dce8)
    this.scene.fog = new THREE.Fog(0xc8dce8, 25, 80)

    // Caméra FPS
    this.camera.instance.position.set(0, EYE_HEIGHT, 8)
    this.camera.instance.rotation.set(0, 0, 0)

    // Joueur
    this._velocity  = new THREE.Vector3()
    this._direction = new THREE.Vector3()
    this._onGround  = true
    this._keys      = { forward: false, backward: false, left: false, right: false, jump: false }

    // ── Système d'interaction (regard) ──────────────────────────
    this._interactables = new Map()   // mesh → config
    this._raycaster     = new THREE.Raycaster()
    this._raycaster.far = 20
    this._currentTarget = null        // mesh actuellement visé

    // ── Système de zones (proximité) ─────────────────────────
    this._zones = []  // { center, radius, onEnter, onLeave, inside }

    this._setup()
  }

  // ════════════════════════════════════════════════════════════
  //  API PUBLIQUE : enregistrer un objet interactif
  // ════════════════════════════════════════════════════════════

  /**
   * Rend un mesh (ou group) interactif.
   *
   * @param {THREE.Object3D} object — le mesh ou group à rendre interactif
   * @param {Object} config
   * @param {string}   config.prompt      — texte "Appuyer sur E pour …"
   * @param {number}   [config.maxDistance=4] — portée max d'interaction
   * @param {Function} [config.onInteract] — appelé quand E est pressé
   * @param {Function} [config.onEnter]    — appelé quand le regard arrive sur l'objet
   * @param {Function} [config.onLeave]    — appelé quand le regard quitte l'objet
   */
  addInteractive(object, config) {
    const entry = {
      prompt:      config.prompt      || 'Appuyer sur E',
      maxDistance:  config.maxDistance  ?? 4,
      onInteract:  config.onInteract  || null,
      onEnter:     config.onEnter     || null,
      onLeave:     config.onLeave     || null,
    }
    // Si c'est un group, on enregistre chaque mesh enfant
    // mais la config pointe vers le même entry
    object.traverse(child => {
      if (child.isMesh) this._interactables.set(child, entry)
    })
  }

  /**
   * Crée une zone de proximité. Quand le joueur entre/sort du rayon → callbacks.
   *
   * @param {{ x: number, y: number, z: number }} position — centre de la zone
   * @param {number} radius — rayon de déclenchement
   * @param {Object} config
   * @param {Function} [config.onEnter] — le joueur entre dans la zone
   * @param {Function} [config.onLeave] — le joueur sort de la zone
   * @param {boolean}  [config.showHelper=false] — afficher un cercle au sol (debug)
   * @param {number}   [config.helperColor=0xffaa00] — couleur du cercle debug
   * @returns {{ remove: Function }} — appeler remove() pour supprimer la zone
   */
  addZone(position, radius, config = {}) {
    const zone = {
      center:  new THREE.Vector3(position.x, position.y ?? 0, position.z),
      radius,
      onEnter: config.onEnter || null,
      onLeave: config.onLeave || null,
      inside:  false,
      helper:  null,
    }

    // Cercle visuel au sol (optionnel, pratique pour debug / level design)
    if (config.showHelper !== false) {
      const ringGeo = new THREE.RingGeometry(radius - 0.04, radius, 48)
      const ringMat = new THREE.MeshBasicMaterial({
        color: config.helperColor ?? 0xffaa00,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35,
      })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.rotation.x = -Math.PI / 2
      ring.position.set(zone.center.x, 0.02, zone.center.z)
      this.scene.add(ring)
      zone.helper = { geo: ringGeo, mat: ringMat, mesh: ring }
    }

    this._zones.push(zone)
    return {
      remove: () => {
        const i = this._zones.indexOf(zone)
        if (i !== -1) this._zones.splice(i, 1)
        if (zone.helper) {
          this.scene.remove(zone.helper.mesh)
          zone.helper.geo.dispose()
          zone.helper.mat.dispose()
        }
      },
    }
  }

  // ════════════════════════════════════════════════════════════
  //  SETUP
  // ════════════════════════════════════════════════════════════

  _setup() {
    this._setupControls()
    this._setupLights()
    this._setupFloor()
    this._setupScene()
    this._setupInput()
  }

  _setupControls() {
    this._plControls = new PointerLockControls(
      this.camera.instance,
      this.experience.canvas,
    )
    this._plControls.addEventListener('lock',   () => this._callbacks.onLockChange?.(true))
    this._plControls.addEventListener('unlock', () => this._callbacks.onLockChange?.(false))
  }

  _setupLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.2))

    const sun = new THREE.DirectionalLight(0xfff5e0, 2.5)
    sun.position.set(10, 15, 8)
    sun.castShadow           = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.near   = 1
    sun.shadow.camera.far    = 50
    sun.shadow.camera.left   = -20
    sun.shadow.camera.right  = 20
    sun.shadow.camera.top    = 20
    sun.shadow.camera.bottom = -20
    this.scene.add(sun)

    this.scene.add(new THREE.HemisphereLight(0x88aacc, 0x445533, 0.8))
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

  // ── Scène de démo avec différents types d'interactions ──────
  _setupScene() {
    this._demoMats = []
    this._demoGeos = []

    // ── 1. Panneau d'info (affiche un texte) ──────────────────
    const signGeo = new THREE.BoxGeometry(2, 1.5, 0.15)
    const signMat = new THREE.MeshStandardMaterial({ color: 0x336699, roughness: 0.4 })
    const sign = new THREE.Mesh(signGeo, signMat)
    sign.position.set(0, 1.2, 0)
    sign.castShadow = true
    this.scene.add(sign)
    this._demoGeos.push(signGeo)
    this._demoMats.push(signMat)

    // Pied du panneau
    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.5, 8)
    const postMat = new THREE.MeshStandardMaterial({ color: 0x555555 })
    const post = new THREE.Mesh(postGeo, postMat)
    post.position.set(0, 0.45, 0)
    this.scene.add(post)
    this._demoGeos.push(postGeo)
    this._demoMats.push(postMat)

    this.addInteractive(sign, {
      prompt: '[E] Lire le panneau',
      maxDistance: 3,
      onInteract: () => {
        this._callbacks.onMessage?.('Bienvenue dans le POC Interaction !\n\nRegarde autour de toi et approche-toi des objets colorés.\nChacun a une interaction différente.')
      },
    })

    // ── 2. Cube rouge (animation : scale bounce) ──────────────
    const cubeGeo = new THREE.BoxGeometry(1, 1, 1)
    const cubeMat = new THREE.MeshStandardMaterial({ color: 0xee4444, roughness: 0.5 })
    this._bounceCube = new THREE.Mesh(cubeGeo, cubeMat)
    this._bounceCube.position.set(-5, 0.5, -3)
    this._bounceCube.castShadow = true
    this.scene.add(this._bounceCube)
    this._demoGeos.push(cubeGeo)
    this._demoMats.push(cubeMat)

    this._bounceTime = -1 // -1 = pas en cours

    this.addInteractive(this._bounceCube, {
      prompt: '[E] Faire rebondir',
      maxDistance: 4,
      onInteract: () => {
        this._bounceTime = 0 // déclenche l'animation
      },
    })

    // ── 3. Sphère verte (change de couleur à chaque interaction)
    const sphereGeo = new THREE.SphereGeometry(0.7, 32, 24)
    const sphereMat = new THREE.MeshStandardMaterial({ color: 0x44cc66, roughness: 0.4 })
    this._colorSphere = new THREE.Mesh(sphereGeo, sphereMat)
    this._colorSphere.position.set(4, 0.7, -2)
    this._colorSphere.castShadow = true
    this.scene.add(this._colorSphere)
    this._demoGeos.push(sphereGeo)
    this._demoMats.push(sphereMat)
    this._colorIdx = 0

    const colors = [0x44cc66, 0xcc44aa, 0x44aacc, 0xccaa44, 0xffffff]
    this.addInteractive(this._colorSphere, {
      prompt: '[E] Changer la couleur',
      maxDistance: 4,
      onInteract: () => {
        this._colorIdx = (this._colorIdx + 1) % colors.length
        sphereMat.color.setHex(colors[this._colorIdx])
      },
    })

    // ── 4. Zone de proximité — message au sol (orange) ──────────
    this.addZone({ x: 6, z: 4 }, 2.5, {
      onEnter: () => { this._callbacks.onMessage?.('Tu es entré dans la zone orange !') },
      onLeave: () => { this._callbacks.onMessage?.(null) },
      helperColor: 0xffaa00,
    })

    // ── 5b. Zone de proximité — piège au sol (rouge) ──────────
    this.addZone({ x: -6, z: -6 }, 2, {
      onEnter: () => {
        this._callbacks.onMessage?.('Zone rouge : DANGER !\nTu as déclenché un piège.')
        // Téléporte le joueur en arrière
        this.camera.instance.position.set(0, EYE_HEIGHT, 8)
        this._callbacks.onMessage?.(null)
      },
      helperColor: 0xff3333,
    })

    // ── 5c. Zone de proximité — invisible, sans helper ────────
    this.addZone({ x: 0, z: -8 }, 3, {
      showHelper: false,
      onEnter: () => { this._callbacks.onMessage?.('Tu as trouvé la zone cachée !') },
      onLeave: () => { this._callbacks.onMessage?.(null) },
    })

    // ── 4b. Cylindre — rotation toggle ────────────────────────
    const cylGeo = new THREE.CylinderGeometry(0.4, 0.4, 2, 16)
    const cylMat = new THREE.MeshStandardMaterial({ color: 0x8844cc, roughness: 0.5 })
    this._spinCyl = new THREE.Mesh(cylGeo, cylMat)
    this._spinCyl.position.set(-3, 1, 3)
    this._spinCyl.castShadow = true
    this.scene.add(this._spinCyl)
    this._demoGeos.push(cylGeo)
    this._demoMats.push(cylMat)
    this._spinning = false

    this.addInteractive(this._spinCyl, {
      prompt: '[E] Activer / arrêter la rotation',
      maxDistance: 4,
      onInteract: () => { this._spinning = !this._spinning },
    })
  }

  // ── Input ───────────────────────────────────────────────────
  _setupInput() {
    this._onKeyDown = (e) => {
      this._setKey(e.code, true)
      if (e.code === 'KeyE' && this._plControls.isLocked) this._tryInteract()
    }
    this._onKeyUp = (e) => this._setKey(e.code, false)

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

  lock() { this._plControls.lock() }

  // ── Interaction ─────────────────────────────────────────────
  _tryInteract() {
    if (!this._currentTarget) return
    const config = this._interactables.get(this._currentTarget)
    config?.onInteract?.()
  }

  _updateZones() {
    const playerPos = this.camera.instance.position
    for (const zone of this._zones) {
      // Distance horizontale uniquement (on ignore Y)
      const dx   = playerPos.x - zone.center.x
      const dz   = playerPos.z - zone.center.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      const isIn = dist <= zone.radius

      if (isIn && !zone.inside) {
        zone.inside = true
        zone.onEnter?.()
      } else if (!isIn && zone.inside) {
        zone.inside = false
        zone.onLeave?.()
      }
    }
  }

  _updateInteraction() {
    // Rayon depuis le centre de l'écran (le réticule)
    this._raycaster.setFromCamera({ x: 0, y: 0 }, this.camera.instance)

    const meshes = [...this._interactables.keys()]
    const hits   = this._raycaster.intersectObjects(meshes)

    let newTarget = null

    if (hits.length > 0) {
      const hit    = hits[0]
      const config = this._interactables.get(hit.object)
      if (config && hit.distance <= config.maxDistance) {
        newTarget = hit.object
      }
    }

    // Changement de cible
    if (newTarget !== this._currentTarget) {
      // Leave l'ancien
      if (this._currentTarget) {
        const oldConfig = this._interactables.get(this._currentTarget)
        oldConfig?.onLeave?.()
      }

      this._currentTarget = newTarget

      // Enter le nouveau
      if (newTarget) {
        const config = this._interactables.get(newTarget)
        config?.onEnter?.()
        this._callbacks.onPromptChange?.(config.prompt)
      } else {
        this._callbacks.onPromptChange?.(null)
      }
    }
  }

  // ── Boucle ──────────────────────────────────────────────────
  update() {
    const delta = Math.min(this.experience.time.delta / 1000, 0.1)
    const t     = this.experience.time.elapsed / 1000

    // Animations (toujours actives même sans lock)
    if (this._bounceTime >= 0) {
      this._bounceTime += delta
      const s = 1 + Math.sin(this._bounceTime * 12) * 0.3 * Math.max(0, 1 - this._bounceTime)
      this._bounceCube.scale.setScalar(s)
      if (this._bounceTime > 1) {
        this._bounceTime = -1
        this._bounceCube.scale.setScalar(1)
      }
    }

    if (this._spinning) {
      this._spinCyl.rotation.y += delta * 3
    }

    if (!this._plControls.isLocked) return

    // ── Déplacement ──
    this._velocity.x *= 0.88
    this._velocity.z *= 0.88

    this._direction.z = Number(this._keys.forward) - Number(this._keys.backward)
    this._direction.x = Number(this._keys.right)   - Number(this._keys.left)
    this._direction.normalize()

    if (this._keys.forward  || this._keys.backward) this._velocity.z -= this._direction.z * SPEED * delta * 10
    if (this._keys.left     || this._keys.right)    this._velocity.x += this._direction.x * SPEED * delta * 10

    if (this._onGround && this._keys.jump) {
      this._velocity.y = JUMP_VEL
      this._onGround = false
    }
    this._velocity.y -= GRAVITY * delta

    this._plControls.moveRight(this._velocity.x * delta)
    this._plControls.moveForward(-this._velocity.z * delta)
    this.camera.instance.position.y += this._velocity.y * delta

    if (this.camera.instance.position.y < EYE_HEIGHT) {
      this.camera.instance.position.y = EYE_HEIGHT
      this._velocity.y = 0
      this._onGround = true
    }

    // ── Détection proximité (zones) ──
    this._updateZones()
    // ── Détection regard (raycast réticule) ──
    this._updateInteraction()
  }

  resize() {}

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup',   this._onKeyUp)
    this._plControls.dispose()
    this._floorGeo.dispose()
    this._floorMat.dispose()
    this._demoGeos.forEach(g => g.dispose())
    this._demoMats.forEach(m => m.dispose())
    this._interactables.clear()
    this._zones.forEach(z => {
      if (z.helper) {
        z.helper.geo.dispose()
        z.helper.mat.dispose()
      }
    })
    this._zones.length = 0
  }
}
