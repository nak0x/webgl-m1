/**
 * CinematicPlayer — lecture d'une cinématique glTF multi-caméras.
 *
 * Charge la config depuis /models/cinematique.json :
 *   { fps, cutFrame, cameras: { first, second } }
 *
 * Flux :
 *   1. Joue toutes les AnimationClips du GLB via un AnimationMixer
 *   2. Passe la première caméra au Renderer
 *   3. Déclenche le cut à la frame configurée → switch vers la deuxième caméra
 *
 * Callbacks vers Vue :
 *   onCameraChange(cameraName) — nom de la caméra active (pour le HUD)
 *   onReady()                  — config + caméras trouvées, lecture lancée
 */
import * as THREE from 'three'

const CONFIG_PATH = '/models/cinematique.json'

export default class CinematicPlayer {
  constructor(experience, callbacks = {}) {
    this.experience = experience
    this.scene      = experience.scene
    this.renderer   = experience.renderer
    this.sizes      = experience.sizes
    this._callbacks = callbacks

    this._mixer     = null
    this._cameras   = {}     // { [name]: Camera }
    this._config    = null
    this._cutIndex  = 0      // index du cut actif dans config.cuts

    // Désactiver la caméra orbit — le renderer utilisera les caméras du GLB
    this.experience.camera.controls.enabled = false
    this.experience.camera.autoUpdate       = false

    this.scene.background = new THREE.Color(0x000000)

    experience.resources.on('ready', () => this._setup())
  }

  // ── Setup (async : attend le JSON de config) ─────────────────

  async _setup() {
    await this._loadConfig()
    this._setupScene()
    this._setupMixer()
    this._setupCameras()
    this._callbacks.onReady?.()
  }

  async _loadConfig() {
    try {
      const res    = await fetch(CONFIG_PATH)
      this._config = await res.json()
      console.log('[CinematicPlayer] Config chargée :', this._config)
    } catch (e) {
      console.warn('[CinematicPlayer] Impossible de charger cinematique.json, config par défaut.')
      this._config = { fps: 24, cutFrame: 50, cameras: { first: 'Camera', second: 'Camera.001' } }
    }
  }

  _setupScene() {
    const gltf = this.experience.resources.items.cinematique
    this.scene.add(gltf.scene)
  }

  _setupMixer() {
    const gltf = this.experience.resources.items.cinematique

    if (!gltf.animations.length) {
      console.warn('[CinematicPlayer] Aucune animation trouvée dans le GLB.')
      return
    }

    console.log(
      `[CinematicPlayer] ${gltf.animations.length} animation(s) :`,
      gltf.animations.map(a => `"${a.name}" (${a.duration.toFixed(2)}s)`).join(', '),
    )

    this._mixer = new THREE.AnimationMixer(gltf.scene)
    gltf.animations.forEach(clip => {
      this._mixer.clipAction(clip).play()
    })
  }

  _setupCameras() {
    const gltf = this.experience.resources.items.cinematique

    // Indexer toutes les caméras du GLB par nom
    gltf.scene.traverse(obj => {
      if (!obj.isCamera) return
      this._cameras[obj.name] = obj
      console.log('[CinematicPlayer] Caméra trouvée :', obj.name)
    })

    // Activer la caméra du premier cut
    this._cutIndex = 0
    const firstName = this._config.cuts[0]?.camera
    if (!firstName || !this._cameras[firstName]) {
      console.warn(`[CinematicPlayer] Caméra "${firstName}" introuvable dans le GLB.`)
      return
    }

    this._activateCamera(this._cameras[firstName])
  }

  // ── Helpers ──────────────────────────────────────────────────

  _activateCamera(cam) {
    cam.aspect = this.sizes.width / this.sizes.height
    cam.updateProjectionMatrix()
    this.renderer.setActiveCamera(cam)
    this._activeCamera = cam
    this._callbacks.onCameraChange?.(cam.name)
    console.log('[CinematicPlayer] Caméra active :', cam.name)
  }

  // ── Boucle ───────────────────────────────────────────────────

  update() {
    if (!this._mixer || !this._config) return

    const delta = this.experience.time.delta / 1000
    this._mixer.update(delta)

    const currentFrame = this._mixer.time * this._config.fps
    const nextCut      = this._config.cuts[this._cutIndex + 1]

    if (nextCut && currentFrame >= nextCut.frame) {
      this._cutIndex++
      const cam = this._cameras[nextCut.camera]

      if (cam) {
        console.log(
          `[CinematicPlayer] CUT #${this._cutIndex} à la frame ${currentFrame.toFixed(1)}`,
          `→ "${nextCut.camera}"`,
        )
        this._activateCamera(cam)
      } else {
        console.warn(`[CinematicPlayer] CUT #${this._cutIndex} : caméra "${nextCut.camera}" introuvable.`)
      }
    }
  }

  resize() {
    if (this._activeCamera) {
      this._activeCamera.aspect = this.sizes.width / this.sizes.height
      this._activeCamera.updateProjectionMatrix()
    }
  }

  dispose() {
    this._mixer?.stopAllAction()
    this.renderer.setActiveCamera(null)
    // Réactiver la caméra orbit pour les scènes suivantes
    this.experience.camera.controls.enabled = true
    this.experience.camera.autoUpdate       = true
  }
}
