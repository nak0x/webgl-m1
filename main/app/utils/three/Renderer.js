/**
 * Renderer — WebGLRenderer + env map PMREM
 * Gère le rendu de la scène. Supporte le changement de caméra active.
 */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

export default class Renderer {
  constructor(experience) {
    this.experience = experience
    this.sizes  = experience.sizes
    this.scene  = experience.scene
    this.camera = experience.camera
    this.canvas = experience.canvas

    this._activeCamera = null

    this._setInstance()
  }

  _setInstance() {
    const { sizes } = this

    this.instance = new THREE.WebGLRenderer({
      antialias:       sizes.pixelRatio < 2,
      canvas:          this.canvas,
      powerPreference: 'high-performance',
    })
    this.instance.setPixelRatio(sizes.pixelRatio)
    this.instance.setSize(sizes.width, sizes.height)
    this.instance.outputColorSpace   = THREE.SRGBColorSpace
    this.instance.shadowMap.enabled  = true
    this.instance.shadowMap.type     = THREE.PCFShadowMap

    // Tone mapping : ACES Filmic, exposure EV -1.64 → 2^(-1.64) ≈ 0.32
    this.instance.toneMapping         = THREE.ACESFilmicToneMapping
    this.instance.toneMappingExposure = Math.pow(2, -1.64)

    // Environment : Neutral (RoomEnvironment gris neutre)
    const pmrem  = new THREE.PMREMGenerator(this.instance)
    pmrem.compileEquirectangularShader()
    this.scene.environment = pmrem.fromScene(new RoomEnvironment()).texture
    pmrem.dispose()
  }

  /**
   * Définit la caméra utilisée pour le rendu.
   * Passer null pour revenir à la caméra principale.
   */
  setActiveCamera(cam) {
    this._activeCamera = cam
  }

  /** Appelé par Experience._resize() */
  resize() {
    this.instance.setSize(this.sizes.width, this.sizes.height)
    this.instance.setPixelRatio(this.sizes.pixelRatio)
  }

  /** Appelé par Experience._update() */
  update() {
    this.instance.render(this.scene, this._activeCamera ?? this.camera.instance)
  }

  dispose() {
    this.instance.dispose()
  }
}
