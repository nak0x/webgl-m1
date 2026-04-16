/**
 * DoorWorld — POC : animer un seul objet (Porte) d'un GLB via le système d'interaction FPS.
 *
 * Le GLB contient deux objets :
 *   - Wall  : mur statique, ne bouge jamais
 *   - Porte : porte interactive, s'ouvre/se ferme au regard + touche E
 *
 * Réutilise exactement le même système d'interaction que InteractWorld :
 *   PointerLock, raycaster depuis le réticule, touche E, callbacks Vue.
 *
 * Callbacks vers Vue :
 *   onLockChange(locked)        — pointer lock activé/désactivé
 *   onPromptChange(text | null) — texte d'action à afficher (null = rien)
 *   onMessage(text | null)      — message/info à afficher en overlay
 */
import * as THREE from 'three'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'

const SPEED      = 5
const JUMP_VEL   = 6
const GRAVITY    = 14
const EYE_HEIGHT = 1.7

// Angle cible de la porte (en radians)
const DOOR_OPEN_ANGLE  = -Math.PI / 2   // −90° = ouverte
const DOOR_CLOSE_ANGLE =  0             // 0°   = fermée
const DOOR_LERP_SPEED  =  4             // vitesse d'interpolation (par seconde)

export default class DoorWorld {
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

    // Caméra FPS — position de départ en face de la porte
    this.camera.instance.position.set(0, EYE_HEIGHT, 4)
    this.camera.instance.rotation.set(0, 0, 0)

    // ── Mouvement joueur ────────────────────────────────────────
    this._velocity  = new THREE.Vector3()
    this._direction = new THREE.Vector3()
    this._onGround  = true
    this._keys      = { forward: false, backward: false, left: false, right: false, jump: false }

    // ── Système d'interaction (regard + E) ──────────────────────
    this._interactables = new Map()   // mesh → config
    this._raycaster     = new THREE.Raycaster()
    this._raycaster.far = 8
    this._currentTarget = null

    // ── État de la porte ────────────────────────────────────────
    this._doorOpen        = false
    this._doorAngle       = DOOR_CLOSE_ANGLE    // angle courant (interpolé)
    this._doorTargetAngle = DOOR_CLOSE_ANGLE    // angle cible
    this._doorMesh        = null                // référence vers le nœud Porte

    this._setup()

    experience.resources.on('ready', () => {
      this._setupDoorModel()
    })
  }

  // ════════════════════════════════════════════════════════════
  //  SETUP
  // ════════════════════════════════════════════════════════════

  _setup() {
    this._setupControls()
    this._setupLights()
    this._setupFloor()
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
    sun.position.set(5, 10, 8)
    sun.castShadow           = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.near   = 1
    sun.shadow.camera.far    = 30
    sun.shadow.camera.left   = -10
    sun.shadow.camera.right  = 10
    sun.shadow.camera.top    = 10
    sun.shadow.camera.bottom = -10
    this.scene.add(sun)

    this.scene.add(new THREE.HemisphereLight(0x88aacc, 0x445533, 0.8))
  }

  _setupFloor() {
    const geo = new THREE.PlaneGeometry(30, 30)
    const mat = new THREE.MeshStandardMaterial({ color: 0x889988, roughness: 0.9 })
    const floor = new THREE.Mesh(geo, mat)
    floor.rotation.x    = -Math.PI / 2
    floor.receiveShadow = true
    this.scene.add(floor)
    this._floorGeo = geo
    this._floorMat = mat
  }

  // ── Chargement du modèle GLB ────────────────────────────────
  _setupDoorModel() {
    const gltf = this.experience.resources.items.door
    const model = gltf.scene

    // Chercher les objets Wall et Porte par leur nom
    let wallMesh  = null
    let porteMesh = null

    model.traverse(child => {
      if (child.name === 'Wall')  wallMesh  = child
      if (child.name === 'Porte') porteMesh = child
      // Activer les ombres sur tous les meshes
      if (child.isMesh) {
        child.castShadow    = true
        child.receiveShadow = true
      }
    })

    this.scene.add(model)

    if (!porteMesh) {
      console.warn('[DoorWorld] Aucun objet nommé "Porte" trouvé dans le GLB.')
      return
    }

    this._doorMesh = porteMesh
    this._doorAngle       = porteMesh.rotation.y
    this._doorTargetAngle = porteMesh.rotation.y

    // Enregistrer la Porte comme objet interactif
    this._addInteractive(porteMesh, {
      prompt:      '[E] Ouvrir / Fermer la porte',
      maxDistance:  5,
      onInteract: () => {
        this._doorOpen        = !this._doorOpen
        this._doorTargetAngle = this._doorOpen ? DOOR_OPEN_ANGLE : DOOR_CLOSE_ANGLE

        if (this._doorOpen) {
          // Porte ouverte → déclenche la transition de scène
          this._callbacks.onTransition?.('carXray')
        } else {
          this._callbacks.onMessage?.('Porte fermée')
          clearTimeout(this._msgTimeout)
          this._msgTimeout = setTimeout(() => this._callbacks.onMessage?.(null), 1500)
        }
      },
      onEnter: () => {
        // La porte est surlignée via le prompt — on pourrait aussi modifier sa couleur ici
      },
      onLeave: () => {},
    })
  }

  // ── Système d'interaction (copie compacte d'InteractWorld) ──

  /**
   * Rend un mesh (ou group) interactif.
   */
  _addInteractive(object, config) {
    const entry = {
      prompt:      config.prompt      || '[E] Interagir',
      maxDistance: config.maxDistance  ?? 4,
      onInteract:  config.onInteract  || null,
      onEnter:     config.onEnter     || null,
      onLeave:     config.onLeave     || null,
    }
    object.traverse(child => {
      if (child.isMesh) this._interactables.set(child, entry)
    })
    // Si l'objet lui-même est un Mesh
    if (object.isMesh) this._interactables.set(object, entry)
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

  _tryInteract() {
    if (!this._currentTarget) return
    const config = this._interactables.get(this._currentTarget)
    config?.onInteract?.()
  }

  // ── Détection du regard (raycaster depuis le réticule) ──────
  _updateInteraction() {
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

    if (newTarget !== this._currentTarget) {
      if (this._currentTarget) {
        const oldConfig = this._interactables.get(this._currentTarget)
        oldConfig?.onLeave?.()
      }

      this._currentTarget = newTarget

      if (newTarget) {
        const config = this._interactables.get(newTarget)
        config?.onEnter?.()
        this._callbacks.onPromptChange?.(config.prompt)
      } else {
        this._callbacks.onPromptChange?.(null)
      }
    }
  }

  // ── Animation de la porte (lerp vers l'angle cible) ────────
  _updateDoor(delta) {
    if (!this._doorMesh) return

    const diff = this._doorTargetAngle - this._doorAngle
    if (Math.abs(diff) < 0.001) {
      // On snap à la valeur exacte et on arrête
      this._doorAngle = this._doorTargetAngle
    } else {
      this._doorAngle += diff * Math.min(1, DOOR_LERP_SPEED * delta)
    }

    this._doorMesh.rotation.y = this._doorAngle
  }

  // ── Boucle update ───────────────────────────────────────────
  update() {
    const delta = Math.min(this.experience.time.delta / 1000, 0.1)

    // Animation de la porte (toujours, même sans lock)
    this._updateDoor(delta)

    if (!this._plControls.isLocked) return

    // ── Déplacement FPS ──
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

    // Détection regard
    this._updateInteraction()
  }

  resize() {}

  dispose() {
    clearTimeout(this._msgTimeout)
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup',   this._onKeyUp)
    this._plControls.dispose()
    this._floorGeo?.dispose()
    this._floorMat?.dispose()
    this._interactables.clear()
  }
}
