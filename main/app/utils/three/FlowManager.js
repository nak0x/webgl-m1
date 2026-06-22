import EventEmitter     from './EventEmitter.js'
import CinematicWorld   from './world/cinematic/CinematicWorld.js'
import CinematicSources from './world/cinematic/CinematicSources.js'

/**
 * FlowManager — séquenceur data-driven de cinématiques et de scènes.
 *
 * Exécute une séquence de steps dans l'ordre :
 *   { type: 'text',  src: '/cinematics/intro.json' }   — cinématique textuelle (Vue)
 *   { type: 'text',  cards: [...] }                    — cinématique textuelle inline
 *   { type: 'video', src: '/videos/intro.mp4' }        — CinematicWorld (GPU minimal)
 *   { type: 'scene', name: 'scene_1' }                 — charge le World cible
 *
 * Évènements émis :
 *   flow_start        — début d'une séquence
 *   flow_end          — séquence terminée (après le dernier step)
 *   step_change       — { type, ... }  à chaque nouveau step
 *   scene_loading     — { name }  juste avant de charger un World
 *   preload_progress  — pct ∈ [0,1]  progression du preload en parallèle
 *
 * Usage :
 *   experience.flow = new FlowManager(experience, sceneManager)
 *   experience.flow.bindTextHandler(cards => textCinematic.play(cards))
 *   experience.flow.bindSceneResolver(name => ({ World, sources, callbacks }))
 *   experience.flow.run(steps, 'scene_1')
 */
export default class FlowManager extends EventEmitter {
  constructor(experience, sceneManager) {
    super()
    this._experience    = experience
    this._sceneManager  = sceneManager
    this._textHandler   = null   // (cards: Array) => Promise<void>
    this._sceneResolver = null   // (name: string) => { World, sources, callbacks }
  }

  bindTextHandler(fn)   { this._textHandler   = fn }
  bindSceneResolver(fn) { this._sceneResolver = fn }

  /**
   * Lance une séquence de steps.
   * Si targetScene est fourni, un step { type:'scene', name:targetScene }
   * est automatiquement ajouté à la fin.
   *
   * L'exécution est différée d'un tick pour permettre au World appelant
   * de terminer son callback avant que SceneManager ne le dispose.
   */
  run(steps, targetScene = null) {
    const sequence = [...(steps ?? [])]
    if (targetScene) sequence.push({ type: 'scene', name: targetScene })
    if (!sequence.length) return
    setTimeout(() => this._execute(sequence), 0)
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  async _execute(sequence) {
    const sceneStepIdx = this._findLastSceneIdx(sequence)
    const hasCinematic = sceneStepIdx > 0

    // hasCinematic : true si des steps text/video précèdent la scène finale.
    // Utilisé par index.vue pour cacher la barre de loading pendant les cinématiques.
    this.trigger('flow_start', { hasCinematic })

    // Cherche le dernier step 'scene' — s'il est précédé de steps cinématiques,
    // on lance son preload immédiatement pour charger le GLB en parallèle.
    let preloadedResources = null

    if (sceneStepIdx > 0) {
      const sceneName = sequence[sceneStepIdx].name
      const resolved  = this._sceneResolver?.(sceneName)
      if (resolved?.sources?.length) {
        preloadedResources = this._sceneManager.preload(resolved.sources)
        preloadedResources.on('progress', pct => this.trigger('preload_progress', pct))
      }
    }

    for (let i = 0; i < sequence.length; i++) {
      const step = sequence[i]
      this.trigger('step_change', step)
      await this._runStep(step, i === sceneStepIdx ? preloadedResources : null)
    }

    this.trigger('flow_end')
  }

  async _runStep(step, preloadedResources = null) {
    switch (step.type) {

      case 'text': {
        let cards = step.cards ?? []
        if (!cards.length && step.src) {
          cards = await fetch(step.src).then(r => r.json())
        }
        if (this._textHandler) await this._textHandler(cards, step.options ?? {})
        break
      }

      case 'video': {
        await new Promise(resolve => {
          this._sceneManager.load(CinematicWorld, CinematicSources, {
            cinematicUrl:   step.src,
            onCinematicEnd: resolve,
          })
        })
        break
      }

      case 'scene': {
        const resolved = this._sceneResolver?.(step.name)
        if (!resolved) break
        this.trigger('scene_loading', { name: step.name })
        await this._sceneManager.load(resolved.World, resolved.sources, resolved.callbacks, preloadedResources)
        break
      }
    }
  }

  _findLastSceneIdx(sequence) {
    for (let i = sequence.length - 1; i >= 0; i--) {
      if (sequence[i].type === 'scene') return i
    }
    return -1
  }

  dispose() {
    this._textHandler   = null
    this._sceneResolver = null
  }
}
