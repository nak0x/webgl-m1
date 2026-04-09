/**
 * Time — boucle d'animation via requestAnimationFrame
 * Émet 'tick' à chaque frame avec elapsed (ms) et delta (ms).
 */
import EventEmitter from './EventEmitter.js'

export default class Time extends EventEmitter {
  constructor() {
    super()
    this.start   = Date.now()
    this.current = this.start
    this.elapsed = 0
    this.delta   = 16
    this._rafId  = null
    this._disposed = false

    // Premier tick après une frame pour éviter delta = 0
    this._rafId = requestAnimationFrame(() => this._tick())
  }

  _tick() {
    if (this._disposed) return

    const current = Date.now()
    this.delta   = current - this.current
    this.current = current
    this.elapsed = this.current - this.start

    this.trigger('tick')

    this._rafId = requestAnimationFrame(() => this._tick())
  }

  dispose() {
    this._disposed = true
    if (this._rafId) cancelAnimationFrame(this._rafId)
  }
}
