/**
 * DialogueManager — moteur de dialogue pur JS.
 *
 * Vit sur experience.dialogue.
 * Le QuestManager l'ouvre quand un step a des lignes de dialogue.
 * Vue écoute ses événements via useDialogueState.
 *
 * Événements émis :
 *   'open'     { line, index, total }   — premier affichage
 *   'line'     { line, index, total }   — chaque ligne suivante
 *   'complete'                          — toutes les lignes passées
 */
import EventEmitter from '../EventEmitter.js'

export default class DialogueManager extends EventEmitter {
  constructor() {
    super()
    this.active  = false
    this.current = null   // { speaker, text }
    this._lines  = []
    this._index  = 0
  }

  open(lines) {
    this._lines  = lines
    this._index  = 0
    this.active  = true
    this.current = lines[0]
    this.trigger('open', { line: lines[0], index: 0, total: lines.length })
  }

  next() {
    if (!this.active) return

    this._index++

    if (this._index >= this._lines.length) {
      this.active  = false
      this.current = null
      this.trigger('complete')
      return
    }

    this.current = this._lines[this._index]
    this.trigger('line', {
      line:  this.current,
      index: this._index,
      total: this._lines.length,
    })
  }

  dispose() {
    this.active  = false
    this.current = null
    this._lines  = []
    this.off()
  }
}
