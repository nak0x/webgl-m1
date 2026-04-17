/**
 * DebugRaycast — overlay de debug pour identifier les objets dans la scène.
 *
 * En mode FPS : raycast depuis le centre de l'écran (crosshair).
 * Mis à jour chaque frame via debug.update() → experience._update().
 *
 * Usage (depuis un World, après _setupModel) :
 *   this.experience.debug.watchScene(this.experience)
 */
import * as THREE from 'three'

export default class DebugRaycast {
  constructor(experience) {
    this._camera    = experience.camera.instance
    this._scene     = experience.scene
    this._raycaster = new THREE.Raycaster()
    // Toujours depuis le centre — crosshair FPS
    this._center    = new THREE.Vector2(0, 0)

    this._el = this._createOverlay()
  }

  _createOverlay() {
    const el = document.createElement('div')
    el.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 24px;
      pointer-events: none;
      background: rgba(0,0,0,0.75);
      color: #00ff88;
      font: 11px/1.5 monospace;
      padding: 5px 8px;
      border-radius: 4px;
      border: 1px solid rgba(0,255,136,0.3);
      max-width: 300px;
      word-break: break-all;
      z-index: 9999;
      display: none;
    `
    document.body.appendChild(el)
    return el
  }

  update() {
    this._raycaster.setFromCamera(this._center, this._camera)
    const hits = this._raycaster.intersectObjects(this._scene.children, true)

    if (hits.length === 0) {
      this._el.style.display = 'none'
      return
    }

    const obj  = hits[0].object
    const path = this._buildPath(obj)

    this._el.style.display = 'block'
    this._el.innerHTML = `
      <span style="color:#aaa">type:</span> ${obj.type}<br>
      <span style="color:#aaa">name:</span> <b style="color:#fff">${obj.name || '(unnamed)'}</b><br>
      <span style="color:#aaa">path:</span> <span style="color:#88ccff">${path}</span>
    `
  }

  /** Remonte la hiérarchie jusqu'à la scène : A › B › C */
  _buildPath(obj) {
    const parts = []
    let current = obj
    while (current && current !== this._scene) {
      if (current.name) parts.unshift(current.name)
      current = current.parent
    }
    return parts.join(' › ') || '(no names)'
  }

  dispose() {
    this._el.remove()
  }
}
