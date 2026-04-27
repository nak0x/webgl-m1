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
import GUI   from 'lil-gui'
import Stats from 'stats.js'

export default class Debug {
  constructor() {
    this.active = window.location.hash === '#debug'

    if (this.active) {
      this.gui = new GUI({ width: 300 })

      this.stats = new Stats()
      this.stats.showPanel(0) // 0: FPS, 1: ms/frame, 2: MB
      document.body.appendChild(this.stats.dom)
    }
  }

  dispose() {
    this.gui?.destroy()
    if (this.stats) {
      document.body.removeChild(this.stats.dom)
    }
  }
}
