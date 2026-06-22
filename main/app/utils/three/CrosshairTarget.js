import * as THREE from '/lib/three.js'

export default class CrosshairTarget {
  constructor(experience) {
    this._camera      = experience.camera.instance
    this._scene       = experience.scene
    this._debug       = experience.debug
    this._outlinePass = experience.renderer.outlinePass
    this._interaction = experience.interaction
    this._raycaster   = new THREE.Raycaster()
    this._center      = new THREE.Vector2(0, 0)
    this._lastObj     = null
    this._targets     = []   // réutilisé chaque frame, évite une alloc

    if (this._debug.active) {
      this._el = this._createOverlay()
    }
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
    const interactables = this._interaction.getInteractables()

    // Caste uniquement contre les interactables enregistrés, pas toute la scène.
    // Dans les scènes streamées (ville), scene.children grandit sans borne : tester
    // chaque triangle de chunk à chaque frame est le coût per-frame dominant et
    // empire à mesure que le monde se charge. L'ensemble interactable est minuscule
    // (objets de quête), donc le coût reste O(interactables) quelle que soit la
    // quantité de géométrie chargée. Contrepartie : un interactable derrière un mur
    // peut s'outliner (l'occlusion par la géométrie statique n'est plus testée) —
    // l'interaction réelle reste gardée par la proximité / les trigger zones.
    if (interactables.size === 0) {
      this._clearTarget()
      return
    }

    this._targets.length = 0
    for (const obj of interactables.keys()) this._targets.push(obj)

    this._raycaster.setFromCamera(this._center, this._camera)
    const hits = this._raycaster.intersectObjects(this._targets, true)

    // Cherche le premier hit dont un ancêtre est un objet interactable enregistré
    let targetObj = null
    let targetId  = null
    let hitMesh   = null

    if (hits.length > 0) {
      let obj = hits[0].object
      while (obj) {
        if (interactables.has(obj)) {
          targetObj = obj
          targetId  = interactables.get(obj)
          hitMesh   = hits[0].object
          break
        }
        obj = obj.parent
      }
    }

    if (!targetObj) {
      this._clearTarget()
      return
    }

    if (targetObj !== this._lastObj) {
      this._outlinePass.selectedObjects = [targetObj]
      this._lastObj = targetObj
    }
    this._interaction.setAimedId(targetId)

    if (this._el) {
      this._el.style.display = 'block'
      this._el.innerHTML = `
        <span style="color:#aaa">type:</span> ${hitMesh.type}<br>
        <span style="color:#aaa">name:</span> <b style="color:#fff">${hitMesh.name || '(unnamed)'}</b><br>
        <span style="color:#aaa">path:</span> <span style="color:#88ccff">${this._buildPath(hitMesh)}</span><br>
        <span style="color:#aaa">id:</span> <span style="color:#ffaa00">${targetId}</span>
      `
    }
  }

  _clearTarget() {
    if (this._lastObj) {
      this._outlinePass.selectedObjects = []
      this._lastObj = null
    }
    this._interaction.setAimedId(null)
    if (this._el) this._el.style.display = 'none'
  }

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
    this._outlinePass.selectedObjects = []
    this._interaction.setAimedId(null)
    this._el?.remove()
  }
}
