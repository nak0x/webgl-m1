/**
 * Debug — GUI de développement conditionnel.
 *
 * Actif uniquement si l'URL contient #debug.
 * Disponible sur experience.debug partout dans le projet.
 *
 * Usage dans un World :
 *   if (this.experience.debug.active) {
 *     const f = this.experience.debug.gui.addFolder('Ma scène')
 *     f.add(mesh.position, 'y', -5, 5)
 *   }
 *
 * Le popup d'identification des objets est géré par CrosshairTarget
 * (actif en FPS, overlay visible uniquement si debug.active).
 */
import GUI from 'lil-gui'

export default class Debug {
  constructor() {
    this.active = window.location.hash === '#debug'

    if (this.active) {
      this.gui = new GUI({ width: 300 })
    }
  }

  dispose() {
    this.gui?.destroy()
  }
}
