/**
 * InteractionManager — Raycaster pour les clics sur des meshes de la scène
 *
 * Gère la détection de clics sur des meshes enregistrés.
 * Les coordonnées UV de l'intersection sont transmises aux handlers.
 *
 * Usage :
 *   const im = new InteractionManager(experience)
 *   im.register(mesh, (uv, hit) => { ... })
 *   // ...
 *   im.dispose()
 */
import * as THREE from 'three'

export default class InteractionManager {
  constructor(experience) {
    this.experience = experience
    this.camera     = experience.camera
    this.renderer   = experience.renderer

    this._raycaster = new THREE.Raycaster()
    this._mouse     = new THREE.Vector2()
    this._handlers  = new Map() // mesh → (uv, hit) => void

    this._onClick = (e) => this._handleClick(e)
    experience.canvas.addEventListener('click', this._onClick)
  }

  /**
   * Enregistre un mesh comme cible de raycasting.
   *
   * @param {THREE.Mesh} mesh — le mesh à surveiller
   * @param {Function}   onHit — appelé avec (uv: THREE.Vector2, hit: Intersection)
   */
  register(mesh, onHit) {
    this._handlers.set(mesh, onHit)
  }

  /** Retire un mesh du système d'interaction. */
  unregister(mesh) {
    this._handlers.delete(mesh)
  }

  _handleClick(e) {
    const rect = this.renderer.instance.domElement.getBoundingClientRect()
    this._mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
    this._mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1

    this._raycaster.setFromCamera(this._mouse, this.camera.instance)

    const meshes = [...this._handlers.keys()]
    const hits   = this._raycaster.intersectObjects(meshes, false)

    if (!hits.length) return

    const hit     = hits[0]
    const handler = this._handlers.get(hit.object)
    if (handler && hit.uv) handler(hit.uv, hit)
  }

  dispose() {
    this.experience.canvas.removeEventListener('click', this._onClick)
    this._handlers.clear()
  }
}
