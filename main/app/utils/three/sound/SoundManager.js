import { SOUNDS } from './SoundBank.js'

export default class SoundManager {
  constructor(experience) {
    this.experience = experience
    this._ctx       = new (window.AudioContext || window.webkitAudioContext)()
    this._buffers   = new Map()
    this._active    = new Map() // id -> Set<AudioBufferSourceNode>

    this._gains = {
      master:      this._ctx.createGain(),
      interaction: this._ctx.createGain(),
      ambient:     this._ctx.createGain(),
      voice:       this._ctx.createGain(),
    }
    this._gains.master.gain.value      = 1
    this._gains.interaction.gain.value = 1
    this._gains.ambient.gain.value     = 0.4
    this._gains.voice.gain.value       = 0.8

    this._gains.interaction.connect(this._gains.master)
    this._gains.ambient.connect(this._gains.master)
    this._gains.voice.connect(this._gains.master)
    this._gains.master.connect(this._ctx.destination)

    this._resumeHandler = () => this._ctx?.state === 'suspended' && this._ctx.resume()
    document.addEventListener('click',   this._resumeHandler)
    document.addEventListener('keydown', this._resumeHandler)

    this._preload()
    this._setupDebug()
  }

  // ── API publique ──────────────────────────────────────────────────────────

  /**
   * Lance un son par son id (défini dans SoundBank).
   * @param {string} id
   * @param {{ volume?, pitch?, loop?, onEnd? }} opts
   * @returns {{ stop: Function } | null}
   */
  play(id, opts = {}) {
    const def    = SOUNDS[id]
    const buffer = this._buffers.get(id)

    if (!def)    { console.warn(`[SoundManager] id inconnu : "${id}"`);           return null }
    if (!buffer) { console.warn(`[SoundManager] buffer absent pour "${id}" — fichier chargé ?`); return null }

    this._resumeHandler()

    const source = this._ctx.createBufferSource()
    source.buffer           = buffer
    source.loop             = opts.loop  ?? def.loop  ?? false
    source.playbackRate.value = opts.pitch ?? 1

    const gainNode = this._ctx.createGain()
    gainNode.gain.value = opts.volume ?? def.volume ?? 1
    source.connect(gainNode)
    gainNode.connect(this._gains[def.category] ?? this._gains.interaction)

    source.start(0)

    if (!this._active.has(id)) this._active.set(id, new Set())
    const set = this._active.get(id)
    set.add(source)

    source.onended = () => {
      set.delete(source)
      opts.onEnd?.()
    }

    return { stop: () => { try { source.stop() } catch (_) {} } }
  }

  /** Stoppe toutes les instances actives d'un id. */
  stop(id) {
    this._active.get(id)?.forEach(s => { try { s.stop() } catch (_) {} })
    this._active.get(id)?.clear()
  }

  /** Stoppe tous les sons d'une catégorie. */
  stopCategory(category) {
    for (const [id, def] of Object.entries(SOUNDS)) {
      if (def.category === category) this.stop(id)
    }
  }

  /** Stoppe immédiatement tous les sons actifs. */
  stopAll() {
    for (const id of this._active.keys()) this.stop(id)
  }

  /**
   * Fade le gain master vers 0 sur `ms` millisecondes,
   * puis stoppe tous les sons et remet le gain à 1.
   * À appeler au début d'une transition de scène.
   */
  fadeOutAndStop(ms = 400) {
    if (!this._ctx) return
    const gain = this._gains.master
    const now  = this._ctx.currentTime
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(gain.gain.value, now)
    gain.gain.linearRampToValueAtTime(0, now + ms / 1000)

    this._fadeTimer = setTimeout(() => {
      this.stopAll()
      if (this._ctx) {
        const t = this._ctx.currentTime
        gain.gain.cancelScheduledValues(t)
        gain.gain.setValueAtTime(1, t)
      }
    }, ms + 50)
  }

  /** Règle le gain d'une catégorie (0..1). */
  setVolume(category, value) {
    if (this._gains[category]) this._gains[category].gain.value = value
  }

  // ── Accesseurs pour VoiceBabble ───────────────────────────────────────────

  get audioContext() { return this._ctx }
  get voiceGain()    { return this._gains.voice }

  // ── Interne ───────────────────────────────────────────────────────────────

  async _preload() {
    for (const [id, def] of Object.entries(SOUNDS)) {
      if (!def.url) continue
      try {
        const res     = await fetch(def.url)
        if (!res.ok) continue
        const arr     = await res.arrayBuffer()
        const decoded = await this._ctx.decodeAudioData(arr)
        this._buffers.set(id, decoded)
      } catch {
        // Fichier absent — le SoundManager l'ignore silencieusement (play() logguera un warning).
      }
    }
  }

  _setupDebug() {
    if (!this.experience.debug.active) return
    const f = this.experience.debug.gui.addFolder('Sound')
    const p = { master: 1, interaction: 1, ambient: 0.4, voice: 0.8 }
    f.add(p, 'master',      0, 1, 0.01).onChange(v => this.setVolume('master',      v)).name('Master')
    f.add(p, 'interaction', 0, 1, 0.01).onChange(v => this.setVolume('interaction', v)).name('Interaction')
    f.add(p, 'ambient',     0, 1, 0.01).onChange(v => this.setVolume('ambient',     v)).name('Ambient')
    f.add(p, 'voice',       0, 1, 0.01).onChange(v => this.setVolume('voice',       v)).name('Voice')
    f.close()
    this._debugFolder = f
  }

  dispose() {
    clearTimeout(this._fadeTimer)
    document.removeEventListener('click',   this._resumeHandler)
    document.removeEventListener('keydown', this._resumeHandler)
    this._active.forEach(set => set.forEach(s => { try { s.stop() } catch (_) {} }))
    this._active.clear()
    this._debugFolder?.destroy()
    this._ctx?.close()
    this._ctx = null
  }
}
