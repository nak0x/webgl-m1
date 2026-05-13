/**
 * VoiceBabble — voix synthétique style Animal Crossing.
 *
 * Génère un babillage oscillateur (aucun fichier audio nécessaire).
 * S'abonne automatiquement au DialogueManager passé en paramètre :
 *   - 'open' / 'line'  → démarre le babble, s'arrête quand le typewriter finit
 *   - 'complete'       → coupe le babble (sécurité)
 *
 * La durée de babble est calée sur la vitesse du typewriter HUD (TYPING_MS_PER_CHAR).
 *
 * Profils : map optionnelle speaker → { freq }.
 * Exemple : { Technicien: { freq: 180 } }
 * Sans profil : fréquence par défaut 320 Hz.
 */

const TYPING_MS_PER_CHAR = 30  // doit correspondre à l'intervalle dans DialogueHud.vue

export default class VoiceBabble {
  constructor(soundManager, dialogueManager, profiles = {}) {
    this._sm       = soundManager
    this._dialogue = dialogueManager
    this._profiles = profiles
    this._timer    = null
    this._stopTimer = null
    this._running  = false

    this._onOpen     = (data) => this._start(data)
    this._onLine     = (data) => this._start(data)
    this._onComplete = ()     => this._stop()

    dialogueManager.on('open',     this._onOpen)
    dialogueManager.on('line',     this._onLine)
    dialogueManager.on('complete', this._onComplete)
  }

  _start({ line } = {}) {
    this._stop()

    const profile   = this._profiles[line?.speaker] ?? {}
    const baseFreq  = profile.freq ?? 320
    const textLen   = line?.text?.length ?? 0
    const duration  = textLen * TYPING_MS_PER_CHAR

    this._running = true

    const loop = () => {
      if (!this._running) return
      this._blip(baseFreq * (0.88 + Math.random() * 0.24))
      this._timer = setTimeout(loop, 75 + Math.random() * 55)
    }

    loop()

    // Auto-stop quand le typewriter aurait fini d'écrire
    this._stopTimer = setTimeout(() => this._stop(), duration)
  }

  _stop() {
    this._running = false
    clearTimeout(this._timer)
    clearTimeout(this._stopTimer)
  }

  _blip(freq) {
    const ctx = this._sm.audioContext
    if (!ctx || ctx.state !== 'running') return

    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type            = 'sine'
    osc.frequency.value = freq

    gain.gain.setValueAtTime(0.18, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07)

    osc.connect(gain)
    gain.connect(this._sm.voiceGain)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.07)
  }

  dispose() {
    this._stop()
    this._dialogue.off('open',     this._onOpen)
    this._dialogue.off('line',     this._onLine)
    this._dialogue.off('complete', this._onComplete)
  }
}
