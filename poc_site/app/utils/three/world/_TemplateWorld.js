/**
 * TemplateWorld — point de départ pour une nouvelle scène Three.js
 *
 * 1. Copie ce fichier et renomme-le (ex: MonWorld.js)
 * 2. Renomme la classe TemplateWorld → MonWorld
 * 3. Remplis les sections marquées TODO
 * 4. Crée la page Vue correspondante depuis _TemplatePage.vue
 */
import * as THREE from 'three'

export default class TemplateWorld {
  constructor(experience) {
    this.experience = experience
    this.scene      = experience.scene
    this.camera     = experience.camera
    this.sizes      = experience.sizes
    this.renderer   = experience.renderer

    // TODO: configurer la scène
    this.scene.background = new THREE.Color(0x111122)
    this.camera.instance.position.set(0, 4, 8)
    this.camera.controls.target.set(0, 0, 0)
    this.camera.controls.update()

    // Si tu as des assets déclarés dans _templateSources.js,
    // ils seront chargés avant que 'ready' soit émis.
    // Si pas d'assets → _setup() est quand même appelé via setTimeout(0).
    experience.resources.on('ready', () => this._setup())
  }

  // ─────────────────────────────────────────────────────────────
  // Construction de la scène (appelé une fois, après chargement)
  // ─────────────────────────────────────────────────────────────
  _setup() {
    this._setupLights()
    this._setupObjects()
    // TODO: ajouter d'autres méthodes si besoin (_setupPostPro, _setupInput...)
  }

  _setupLights() {
    // TODO: adapter les lumières à ta scène
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5))

    const dirLight = new THREE.DirectionalLight(0xffffff, 2)
    dirLight.position.set(5, 10, 5)
    dirLight.castShadow = true
    this.scene.add(dirLight)
  }

  _setupObjects() {
    // TODO: créer tes meshes, charger tes assets, etc.
    // Exemple d'accès à un asset GLTF chargé par Resources :
    //   const gltf = this.experience.resources.items.monAsset
    //   this.scene.add(gltf.scene)

    const geo = new THREE.BoxGeometry(1, 1, 1)
    const mat = new THREE.MeshStandardMaterial({ color: 0x00aaff })
    this.mesh = new THREE.Mesh(geo, mat)
    this.scene.add(this.mesh)

    // Références à disposer plus tard
    this._geo = geo
    this._mat = mat
  }

  // ─────────────────────────────────────────────────────────────
  // Appelé automatiquement à chaque frame par Experience
  // ─────────────────────────────────────────────────────────────
  update() {
    if (!this.mesh) return
    const t = this.experience.time.elapsed / 1000
    // TODO: animations, mise à jour des uniforms, etc.
    this.mesh.rotation.y = t
  }

  // ─────────────────────────────────────────────────────────────
  // Appelé automatiquement au resize par Experience (optionnel)
  // Nécessaire seulement si tu as des caméras supplémentaires.
  // ─────────────────────────────────────────────────────────────
  resize() {
    // TODO (optionnel)
    // const a = this.sizes.width / this.sizes.height
    // this.maCamera2.aspect = a
    // this.maCamera2.updateProjectionMatrix()
  }

  // ─────────────────────────────────────────────────────────────
  // Appelé par experience.dispose() → nettoyage mémoire
  // ─────────────────────────────────────────────────────────────
  dispose() {
    // TODO: disposer tous les objets créés dans ce World
    this._geo?.dispose()
    this._mat?.dispose()
    // Retirer les event listeners si tu en as ajouté
    // window.removeEventListener('keydown', this._onKeyDown)
  }
}
