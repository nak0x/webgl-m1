/**
 * InteractionManager — orchestrateur central des interactions 3D.
 *
 * S'intègre dans Experience via deux lignes :
 *   this.interaction = new InteractionManager(this)   // constructor
 *   this.interaction.update()                         // _update(), avant world.update()
 *
 * API côté World :
 *   registerHoverable(mesh, id)              → hover/click souris
 *   registerProximity(object3D, id, radius)  → détection de distance
 *   registerTriggerZone(shape, id)           → zone Box3 ou Sphere
 *   unregister(id)                           → retire un objet de tout
 *   setFpsMode(true/false)                   → switch raycasting centre/souris
 *
 * Événements disponibles via .on() :
 *   hover:enter    { id, point }
 *   hover:leave    { id }
 *   hover:click    { id }          (mode libre uniquement)
 *   proximity:enter { id, distance }
 *   proximity:leave { id }
 *   trigger:enter  { id }
 *   trigger:leave  { id }
 *   interact       { id }          (touche E, pour chaque objet dans le rayon)
 */
import EventEmitter        from '../EventEmitter.js'
import RaycastDetector     from './RaycastDetector.js'
import ProximityDetector   from './ProximityDetector.js'
import TriggerZoneDetector from './TriggerZoneDetector.js'
import PointerStyler       from './PointerStyler.js'

export default class InteractionManager extends EventEmitter {
  constructor(experience) {
    super()
    this._raycast   = new RaycastDetector(experience, this)
    this._proximity = new ProximityDetector(experience, this)
    this._trigger   = new TriggerZoneDetector(experience, this)
    this._pointer   = new PointerStyler(experience.canvas, this)

    this._onKeyDown = this._onKeyDown.bind(this)
    window.addEventListener('keydown', this._onKeyDown)
  }

  // ── API publique ────────────────────────────────────────────────

  registerHoverable(mesh, id) {
    this._raycast.register(mesh, id)
  }

  registerProximity(object3D, id, radius = 2) {
    this._proximity.register(object3D, id, radius)
  }

  registerTriggerZone(shape, id) {
    this._trigger.register(shape, id)
  }

  /** Retire un objet de tous les détecteurs en une seule ligne. */
  unregister(id) {
    this._raycast.unregister(id)
    this._proximity.unregister(id)
    this._trigger.unregister(id)
  }

  /** Retire plusieurs objets d'un coup : unregisterAll(['cle', 'tournevis']) */
  unregisterAll(ids) {
    const list = Array.isArray(ids) ? ids : [ids]
    list.forEach(id => this.unregister(id))
  }

  /** Active le mode FPS : raycast depuis le centre de l'écran. */
  setFpsMode(enabled) {
    this._raycast.setMode(enabled ? 'fps' : 'free')
  }

  /**
   * Retourne une Map<Object3D, id> de tous les objets interactables enregistrés
   * (proximity + hoverable). Utilisé par CrosshairTarget pour filtrer l'outline.
   */
  getInteractables() {
    const map = new Map()
    for (const entry of this._proximity._entries) {
      map.set(entry.object3D, entry.id)
    }
    for (const [mesh, id] of this._raycast._meshMap) {
      map.set(mesh, id)
    }
    return map
  }

  // ── Boucle ──────────────────────────────────────────────────────

  update() {
    this._raycast.update()
    this._proximity.update()
    this._trigger.update()
  }

  // ── Clavier ─────────────────────────────────────────────────────

  _onKeyDown(e) {
    if (e.code !== 'KeyE') return
    const nearbyIds = this._proximity.getInsideIds()
    for (const id of nearbyIds) {
      this.trigger('interact', { id })
    }
  }

  // ── Nettoyage ────────────────────────────────────────────────────

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown)
    this._raycast.dispose()
    this._proximity.dispose()
    this._trigger.dispose()
    this._pointer.dispose()
    this._listeners = {}  // clear tous les abonnements
  }
}
