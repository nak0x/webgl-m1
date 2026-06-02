import EventEmitter from '../../EventEmitter.js'
import { createXray } from '../../materials/createXray.js'
import { SEVERITY_COLORS, PROXIMITY_RADIUS } from './CarRepairConfig.js'

export default class RepairMarkerManager extends EventEmitter {
  constructor(experience, repairMarkers) {
    super()
    this._exp     = experience
    this._markers = repairMarkers
    this._elapsed = 0

    repairMarkers.forEach(m => {
      experience.scene.add(m.sprite)
      experience.interaction.registerHoverable(m.sprite, m.repairDef.id)
      experience.interaction.registerProximity(m.sprite, m.repairDef.id, PROXIMITY_RADIUS)
    })
  }

  onHoverEnter(id) {
    const marker = this._find(id)
    if (marker) this.trigger('inspect:open', { repair: marker.repairDef })
  }

  onHoverLeave(_id) {
    this.trigger('inspect:close', {})
  }

  enableXray(id) {
    const marker = this._find(id)
    if (!marker || marker.xrayInstances) return

    const color = SEVERITY_COLORS[marker.repairDef.severity] ?? SEVERITY_COLORS.use
    marker.originalMaterials = new Map()
    marker.xrayInstances     = []

    marker.meshes.forEach(mesh => {
      const origMat = mesh.material
      marker.originalMaterials.set(mesh, origMat)

      const xray = createXray({ color: color.clone() })
      marker.xrayInstances.push(xray)

      if (Array.isArray(origMat)) {
        mesh.material = new Array(origMat.length).fill(xray.material)
      } else {
        mesh.material = xray.material
      }
    })
  }

  disableXray(id) {
    const marker = this._find(id)
    if (!marker?.originalMaterials) return

    marker.meshes.forEach(mesh => {
      const orig = marker.originalMaterials.get(mesh)
      if (orig !== undefined) mesh.material = orig
    })

    marker.xrayInstances?.forEach(x => x.dispose())
    marker.xrayInstances     = null
    marker.originalMaterials = null
  }

  confirmRepair(id, action) {
    this.disableXray(id)

    const idx = this._markers.findIndex(m => m.repairDef.id === id)
    if (idx === -1) return

    const marker = this._markers[idx]
    this._exp.scene.remove(marker.sprite)
    this._exp.interaction.unregister(id)
    marker.sprite.material.map?.dispose()
    marker.sprite.material.dispose()
    this._markers.splice(idx, 1)

    this.trigger('repair:done', { id, action })
  }

  update(delta) {
    this._elapsed += delta * 0.001
    this._markers.forEach(m => {
      m.sprite.position.y = m.baseY + Math.sin(this._elapsed * 2 + m.phase) * 0.04
    })
  }

  destroy() {
    this._markers.forEach(m => {
      this.disableXray(m.repairDef.id)
      this._exp.scene.remove(m.sprite)
      m.sprite.material.map?.dispose()
      m.sprite.material.dispose()
    })
    this._exp.interaction.unregisterAll(this._markers.map(m => m.repairDef.id))
    this._markers  = []
    this._listeners = {}
  }

  _find(id) {
    return this._markers.find(m => m.repairDef.id === id) ?? null
  }
}
