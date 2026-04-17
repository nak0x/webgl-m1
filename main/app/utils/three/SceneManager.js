/**
 * SceneManager — orchestre le cycle de vie des scènes 3D.
 *
 * Travaille avec une seule Experience (canvas + renderer persistants).
 * À chaque goToScene() : dispose le World courant, nettoie la scène,
 * charge les nouvelles Resources, instancie le nouveau World.
 *
 * Usage :
 *   const mgr = new SceneManager(experience)
 *   await mgr.load(CarXrayWorld, CarXraySources, callbacks)
 *   mgr.unload()
 */
import Resources from './Resources.js'

export default class SceneManager {
  constructor(experience) {
    this.experience = experience
    this._world = null
  }

  get world() {
    return this._world
  }

  /**
   * Charge une nouvelle scène.
   * Retourne une Promise qui se résout quand le World est prêt
   * (resources chargées + setup() exécuté).
   */
  load(WorldClass, sources, callbacks = {}) {
    return new Promise((resolve) => {
      // 1. Dispose du World courant
      this._world?.dispose?.()
      this._world = null
      this.experience.setWorld(null)

      // 2. Nettoyage de la scène THREE
      this._clearScene()

      // 3. Reset état caméra entre les scènes
      this._resetCamera()

      // 4. Nouvelles Resources (remplace la ref sur l'Experience)
      const resources = new Resources(sources)
      this.experience.resources = resources

      // 5. Nouveau World — il s'abonne à resources.on('ready') en interne
      this._world = new WorldClass(this.experience, callbacks)
      this.experience.setWorld(this._world)

      // 6. On résout APRÈS que le World ait fini son setup()
      //    (son listener 'ready' est enregistré avant le nôtre)
      resources.on('ready', () => resolve(this._world))
    })
  }

  unload() {
    this._world?.dispose?.()
    this._world = null
    this.experience.setWorld(null)
    this._clearScene()
    this._resetCamera()
  }

  // ── Privé ────────────────────────────────────────────────────

  _clearScene() {
    const scene = this.experience.scene

    // Dispose toutes les géométries et matériaux
    scene.traverse(obj => {
      obj.geometry?.dispose()
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach(m => m.dispose?.())
      }
    })

    // Retire tous les enfants directs
    while (scene.children.length > 0) {
      scene.remove(scene.children[0])
    }

    scene.background = null
    scene.fog = null
  }

  _resetCamera() {
    const cam = this.experience.camera
    cam.autoUpdate = true
    cam.controls.enabled = true
    cam.controls.enableDamping = false
    cam.instance.position.set(0, 4, 8)
    cam.controls.target.set(0, 0, 0)
    cam.controls.update()
  }

  dispose() {
    this.unload()
  }
}
