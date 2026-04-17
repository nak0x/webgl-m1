/**
 * ProximityDetector — détecte quand la caméra entre/sort du rayon d'un objet.
 *
 * Événements émis :
 *   proximity:enter  { id, distance }
 *   proximity:leave  { id }
 */
export default class ProximityDetector {
  constructor(experience, emitter) {
    this._emitter = emitter
    this._camera  = experience.camera.instance
    this._entries = []  // { object3D, id, radius, wasInside }
  }

  register(object3D, id, radius = 2) {
    this._entries.push({ object3D, id, radius, wasInside: false })
  }

  unregister(id) {
    const entry = this._entries.find(e => e.id === id)
    if (entry?.wasInside) this._emitter.trigger('proximity:leave', { id })
    this._entries = this._entries.filter(e => e.id !== id)
  }

  /** Retourne les ids dont le joueur est actuellement dans le rayon. */
  getInsideIds() {
    return new Set(this._entries.filter(e => e.wasInside).map(e => e.id))
  }

  update() {
    const camPos = this._camera.position
    for (const entry of this._entries) {
      const dist   = camPos.distanceTo(entry.object3D.position)
      const inside = dist <= entry.radius

      if (inside && !entry.wasInside) {
        entry.wasInside = true
        this._emitter.trigger('proximity:enter', { id: entry.id, distance: dist })
      } else if (!inside && entry.wasInside) {
        entry.wasInside = false
        this._emitter.trigger('proximity:leave', { id: entry.id })
      }
    }
  }

  dispose() {
    this._entries = []
  }
}
