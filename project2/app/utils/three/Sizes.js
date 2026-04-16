/**
 * Sizes — gestion centralisée du viewport
 * Émet 'resize' quand le viewport change.
 * Experience l'écoute et propage le resize aux autres classes dans le bon ordre.
 */
import EventEmitter from './EventEmitter.js'

export default class Sizes extends EventEmitter {
  constructor() {
    super()
    this.width      = window.innerWidth
    this.height     = window.innerHeight
    this.pixelRatio = Math.min(window.devicePixelRatio, 2)

    this._onResize = () => {
      this.width      = window.innerWidth
      this.height     = window.innerHeight
      this.pixelRatio = Math.min(window.devicePixelRatio, 2)
      this.trigger('resize')
    }
    window.addEventListener('resize', this._onResize)
  }

  dispose() {
    window.removeEventListener('resize', this._onResize)
  }
}
