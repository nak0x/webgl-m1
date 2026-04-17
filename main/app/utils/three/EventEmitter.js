/**
 * EventEmitter — système d'événements léger
 * Permet aux classes de s'abonner/désabonner et d'émettre des événements.
 */
export default class EventEmitter {
  constructor() {
    this._listeners = {}
  }

  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = []
    this._listeners[event].push(callback)
    return this
  }

  off(event, callback) {
    if (!this._listeners[event]) return this
    if (callback) {
      this._listeners[event] = this._listeners[event].filter(cb => cb !== callback)
    } else {
      delete this._listeners[event]
    }
    return this
  }

  trigger(event, ...args) {
    if (!this._listeners[event]) return this
    this._listeners[event].forEach(cb => cb(...args))
    return this
  }
}
