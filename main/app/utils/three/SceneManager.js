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
   * Lance le chargement des assets d'une scène sans instancier de World.
   * Retourne les Resources pour pouvoir écouter la progression.
   * Passer ensuite ces Resources à load() pour éviter un double téléchargement.
   */
  preload(sources) {
    const resources = new Resources(sources)
    return resources
  }

  /**
   * Charge une nouvelle scène.
   * preloadedResources : Resources déjà lancées par preload() — réutilisées
   *   pour éviter un double téléchargement.
   *
   * Si le World précédent pose deferDispose = true (ex: CinematicWorld), son
   * dispose() est différé après que le nouveau World soit prêt — l'overlay reste
   * visible pendant le setup, aucune frame noire.
   * Pour les game Worlds, dispose() est appelé immédiatement pour éviter les
   * conflits FPS (PointerLock, event listeners).
   */
  load(WorldClass, sources, callbacks = {}, preloadedResources = null) {
    return new Promise((resolve) => {
      const previousWorld = this._world
      this._world = null
      this.experience.setWorld(null)

      const deferDispose = !!previousWorld?.deferDispose
      if (!deferDispose) previousWorld?.dispose?.()

      this._clearScene()
      this._resetCamera()

      const resources = preloadedResources ?? new Resources(sources)
      this.experience.resources = resources

      if (callbacks.onLoadProgress) {
        resources.on('progress', callbacks.onLoadProgress)
      }

      this._world = new WorldClass(this.experience, callbacks)
      this.experience.setWorld(this._world)

      // World._setup() s'est abonné à 'ready' dans son constructeur — il s'exécute
      // en premier. onReady() est appelé juste après.
      const onReady = () => {
        if (deferDispose) previousWorld?.dispose?.()
        resolve(this._world)
      }

      if (resources.isReady) {
        // trigger() est synchrone : _setup() + onReady() dans le même tick que la
        // fin de la cinématique, avant le prochain RAF — aucune frame noire.
        resources.trigger('ready')
        onReady()
      } else {
        resources.on('ready', onReady)
      }
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
