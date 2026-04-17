/**
 * QuestManager — séquenceur de steps d'une scène.
 *
 * Usage dans un World :
 *   this._quest = new QuestManager(experience, steps, callbacks)
 *   this._quest.start()
 *
 * Structure d'un step :
 *   {
 *     id:       'talk_npc',
 *     label:    'Parler au technicien',
 *     hint:     'Approchez-vous et appuyez sur E',
 *     trigger:  { type: 'interact', id: 'technicien' },
 *     dialogue: [                          // optionnel
 *       { speaker: 'Technicien', text: '...' },
 *     ],
 *     onComplete: (world, callbacks) => {  // optionnel
 *       // retirer un objet, ouvrir une page, etc.
 *     },
 *   }
 *
 * Événements émis :
 *   'step:active'   { step, index }
 *   'step:complete' { step, index }
 *   'quest:complete'
 */
import EventEmitter from '../EventEmitter.js'

export default class QuestManager extends EventEmitter {
  constructor(experience, steps, callbacks = {}) {
    super()
    this._experience  = experience
    this._steps       = steps
    this._callbacks   = callbacks
    this._index       = -1
    this._handler     = null   // listener actif sur interaction
    this.totalSteps   = steps.length
    this.currentStep  = null
  }

  start() {
    if (this._steps.length === 0) return
    this._activateStep(0)
  }

  /** Démarre directement à une étape donnée (utile pour les tests). */
  startFrom(id) {
    const idx = this._steps.findIndex(s => s.id === id)
    if (idx === -1) { console.warn(`QuestManager: step "${id}" introuvable`); return }
    this._activateStep(idx)
  }

  // ── Privé ────────────────────────────────────────────────────

  _activateStep(index) {
    this._index      = index
    this.currentStep = this._steps[index]
    const step       = this.currentStep

    // Abonnement au trigger de ce step
    const { type, id } = step.trigger
    this._handler = (payload) => {
      if (payload.id !== id) return
      this._onStepTriggered(step)
    }
    this._experience.interaction.on(type, this._handler)
    this._currentTriggerType = type

    this.trigger('step:active', { step, index })
  }

  _onStepTriggered(step) {
    // Désabonnement immédiat — plus d'écoute pendant dialogue/transition
    this._unsubscribe()

    if (step.dialogue?.length > 0) {
      // Ouvre le dialogue et attend 'complete' avant d'avancer
      this._experience.dialogue.open(step.dialogue)

      const onComplete = () => {
        this._experience.dialogue.off('complete', onComplete)
        this._finishStep(step)
      }
      this._experience.dialogue.on('complete', onComplete)
    } else {
      this._finishStep(step)
    }
  }

  _finishStep(step) {
    step.onComplete?.(this._callbacks)

    this.trigger('step:complete', { step, index: this._index })

    const next = this._index + 1
    if (next >= this._steps.length) {
      this.currentStep = null
      this.trigger('quest:complete')
    } else {
      this._activateStep(next)
    }
  }

  _unsubscribe() {
    if (this._handler && this._currentTriggerType) {
      this._experience.interaction.off(this._currentTriggerType, this._handler)
      this._handler            = null
      this._currentTriggerType = null
    }
  }

  dispose() {
    this._unsubscribe()
    this.off()
  }
}
