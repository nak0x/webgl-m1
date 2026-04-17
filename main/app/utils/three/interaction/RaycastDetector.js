import * as THREE from 'three'

/**
 * RaycastDetector — détecte le hover et le click sur des meshes enregistrés.
 *
 * Mode 'free' : raycast depuis la position souris (vue orbitale).
 * Mode 'fps'  : raycast depuis le centre de l'écran (crosshair).
 *
 * Événements émis sur l'emitter parent :
 *   hover:enter  { id, point }
 *   hover:leave  { id }
 *   hover:click  { id }
 */
export default class RaycastDetector {
  constructor(experience, emitter) {
    this._emitter    = emitter
    this._camera     = experience.camera.instance
    this._canvas     = experience.canvas
    this._raycaster  = new THREE.Raycaster()
    this._mouse      = new THREE.Vector2()
    this._mouseDirty = false
    this._mode       = 'free'
    this._meshMap    = new Map()  // mesh → id
    this._hovered    = null       // id actuellement survolé

    this._onMouseMove  = this._onMouseMove.bind(this)
    this._onMouseClick = this._onMouseClick.bind(this)
    this._canvas.addEventListener('mousemove', this._onMouseMove)
    this._canvas.addEventListener('click',     this._onMouseClick)
  }

  setMode(mode) {
    this._mode = mode
    if (mode === 'fps') {
      this._mouse.set(0, 0)
      this._mouseDirty = true
    }
  }

  register(mesh, id) {
    this._meshMap.set(mesh, id)
  }

  unregister(id) {
    for (const [mesh, mId] of this._meshMap) {
      if (mId === id) this._meshMap.delete(mesh)
    }
    if (this._hovered === id) {
      this._emitter.trigger('hover:leave', { id })
      this._hovered = null
    }
  }

  update() {
    // En FPS le monde bouge, on recalcule chaque frame
    if (this._mode === 'fps') this._mouseDirty = true
    if (!this._mouseDirty || this._meshMap.size === 0) return
    this._mouseDirty = false

    this._raycaster.setFromCamera(this._mouse, this._camera)
    const meshes = [...this._meshMap.keys()]
    const hits   = this._raycaster.intersectObjects(meshes, true)

    // Remonte la hiérarchie pour trouver le mesh enregistré
    let hitId = null
    if (hits.length > 0) {
      for (const hit of hits) {
        let obj = hit.object
        while (obj) {
          if (this._meshMap.has(obj)) { hitId = this._meshMap.get(obj); break }
          obj = obj.parent
        }
        if (hitId) break
      }
    }

    if (hitId !== this._hovered) {
      if (this._hovered) this._emitter.trigger('hover:leave', { id: this._hovered })
      if (hitId)         this._emitter.trigger('hover:enter', { id: hitId, point: hits[0].point })
      this._hovered = hitId
    }
  }

  _onMouseMove(e) {
    if (this._mode === 'fps') return
    const rect = this._canvas.getBoundingClientRect()
    this._mouse.x =  ((e.clientX - rect.left)  / rect.width)  * 2 - 1
    this._mouse.y = -((e.clientY - rect.top)    / rect.height) * 2 + 1
    this._mouseDirty = true
  }

  _onMouseClick() {
    if (this._mode === 'fps' || !this._hovered) return
    this._emitter.trigger('hover:click', { id: this._hovered })
  }

  dispose() {
    this._canvas.removeEventListener('mousemove', this._onMouseMove)
    this._canvas.removeEventListener('click',     this._onMouseClick)
    this._meshMap.clear()
  }
}
