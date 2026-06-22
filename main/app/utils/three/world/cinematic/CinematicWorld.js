/**
 * CinematicWorld — World minimal dédié à la lecture vidéo.
 *
 * Aucun objet 3D, aucune lumière. Le GPU ne rend qu'un quad VideoTexture
 * (via CinematicManager) sur fond noir.
 *
 * Reçoit via callbacks :
 *   cinematicUrl   : string          — chemin de la vidéo à jouer
 *   onCinematicEnd : () => void      — appelé quand la vidéo se termine ou est skippée
 */
export default class CinematicWorld {
  // SceneManager lit ce flag pour différer le dispose() après que le World
  // suivant soit prêt — garantit que l'overlay reste visible pendant le setup.
  deferDispose = true

  constructor(experience, callbacks = {}) {
    this.experience = experience
    this._callbacks = callbacks
    this._onEnd     = null

    experience.resources.on('ready', () => this._setup())
  }

  _setup() {
    const { cinematicUrl, onCinematicEnd } = this._callbacks
    if (!cinematicUrl) {
      onCinematicEnd?.()
      return
    }

    this._onEnd = () => {
      this.experience.cinematic.off('end', this._onEnd)
      onCinematicEnd?.()
    }
    this.experience.cinematic.on('end', this._onEnd)
    this.experience.cinematic.play(cinematicUrl)
  }

  update()  {}
  resize()  {}

  dispose() {
    if (this._onEnd) {
      this.experience.cinematic.off('end', this._onEnd)
      this._onEnd = null
    }
    // Arrête proprement la vidéo si le World est disposé avant la fin
    this.experience.cinematic.skip()
  }
}
