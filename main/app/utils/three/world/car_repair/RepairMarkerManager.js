import EventEmitter from '../../EventEmitter.js'
import { createXray } from '../../materials/createXray.js'
import {
  SEVERITY_COLORS,
  PROXIMITY_RADIUS,
  XRAY_BODY_COLOR,
  XRAY_BODY_PARAMS,
  XRAY_REPAIR_PARAMS,
} from './CarRepairConfig.js'

export default class RepairMarkerManager extends EventEmitter {
  constructor(experience, repairMarkers, model) {
    super()
    this._exp     = experience
    this._markers = repairMarkers
    this._model   = model
    this._elapsed = 0
    this._xray    = null

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

  enableXray() {
    if (this._xray || !this._model) return

    const repairColors = new Map()
    this._markers.forEach(m => {
      const color = SEVERITY_COLORS[m.repairDef.severity] ?? SEVERITY_COLORS.use
      m.meshes.forEach(mesh => repairColors.set(mesh, color))
    })

    const instances = []
    const restore   = []

    this._model.traverse(mesh => {
      if (!mesh.isMesh) return

      const repairColor = repairColors.get(mesh)
      const isRepair    = repairColor !== undefined
      const xray        = createXray({ color: (isRepair ? repairColor : XRAY_BODY_COLOR).clone() })
      xray.setParams(isRepair ? XRAY_REPAIR_PARAMS : XRAY_BODY_PARAMS)
      instances.push(xray)

      restore.push({ mesh, material: mesh.material, renderOrder: mesh.renderOrder })

      mesh.material    = Array.isArray(mesh.material)
        ? new Array(mesh.material.length).fill(xray.material)
        : xray.material
      mesh.renderOrder = isRepair ? 2 : 1
    })

    this._xray = { instances, restore }
  }

  disableXray() {
    if (!this._xray) return

    this._xray.restore.forEach(({ mesh, material, renderOrder }) => {
      mesh.material    = material
      mesh.renderOrder = renderOrder
    })
    this._xray.instances.forEach(x => x.dispose())
    this._xray = null
  }

  confirmRepair(id, action) {
    this.disableXray()

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
    this.disableXray()
    this._markers.forEach(m => {
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
