/**
 * TriggerZoneDetector — détecte quand la caméra entre/sort d'une zone.
 *
 * Accepte une THREE.Box3 ou une THREE.Sphere comme zone.
 * Pour créer une zone depuis un mesh invisible du GLB :
 *   const zone = new THREE.Box3().setFromObject(triggerMesh)
 *   triggerMesh.visible = false
 *
 * Événements émis :
 *   trigger:enter  { id }
 *   trigger:leave  { id }
 */
export default class TriggerZoneDetector {
  constructor(experience, emitter) {
    this._emitter = emitter
    this._camera  = experience.camera.instance
    this._entries = []  // { shape, id, wasInside }
  }

  register(shape, id) {
    this._entries.push({ shape, id, wasInside: false })
  }

  unregister(id) {
    const entry = this._entries.find(e => e.id === id)
    if (entry?.wasInside) this._emitter.trigger('trigger:leave', { id })
    this._entries = this._entries.filter(e => e.id !== id)
  }

  update() {
    const camPos = this._camera.position
    for (const entry of this._entries) {
      const inside = entry.shape.containsPoint(camPos)

      if (inside && !entry.wasInside) {
        entry.wasInside = true
        this._emitter.trigger('trigger:enter', { id: entry.id })
      } else if (!inside && entry.wasInside) {
        entry.wasInside = false
        this._emitter.trigger('trigger:leave', { id: entry.id })
      }
    }
  }

  dispose() {
    this._entries = []
  }
}
