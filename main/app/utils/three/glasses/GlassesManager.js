import EventEmitter from '../EventEmitter.js'

export default class GlassesManager extends EventEmitter {
  constructor() {
    super()
    this._equipped = false
  }

  equip() {
    this._equipped = true
    this.trigger('glasses:on')
  }

  unequip() {
    this._equipped = false
    this.trigger('glasses:off')
  }

  notify({ id, title, text, permanent = false, duration = 4000 }) {
    this.trigger('notification', { id, title, text, permanent, duration })
  }

  removeNotification(id) {
    this.trigger('notification:remove', { id })
  }

  setBattery(level) {
    this.trigger('battery', { level })
  }

  addCollectible(id, label) {
    this.trigger('collectible:add', { id, label })
  }

  collect(id) {
    this.trigger('collectible:done', { id })
  }

  destroy() {
    this.off()
  }
}
