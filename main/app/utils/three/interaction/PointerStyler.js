/**
 * PointerStyler — change le cursor CSS en fonction du hover.
 * Désactivé automatiquement en mode FPS (pointer lock actif).
 */
export default class PointerStyler {
  constructor(canvas, emitter) {
    this._canvas  = canvas
    this._emitter = emitter

    this._onEnter = () => { this._canvas.style.cursor = 'pointer' }
    this._onLeave = () => { this._canvas.style.cursor = 'default'  }

    emitter.on('hover:enter', this._onEnter)
    emitter.on('hover:leave', this._onLeave)
  }

  dispose() {
    this._emitter.off('hover:enter', this._onEnter)
    this._emitter.off('hover:leave', this._onLeave)
    this._canvas.style.cursor = 'default'
  }
}
