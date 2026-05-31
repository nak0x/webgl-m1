import { assetPath } from '../../assetPath.js'

export const SOUNDS = {
  // ── Interactions ─────────────────────────────────────────────────────────
  interact_confirm: {
    url:      assetPath('/sounds/interaction/confirm.mp3'),
    category: 'interaction',
    volume:   0.8,
  },
  hover_tick: {
    url:      assetPath('/sounds/interaction/hover.mp3'),
    category: 'interaction',
    volume:   0.4,
  },
  proximity_enter: {
    url:      assetPath('/sounds/interaction/animal-crossing-isabelle-voice-clips-no-background-music-youtubemp3free.mp3'),
    category: 'interaction',
    volume:   0.5,
  },

  // ── Ambiance ─────────────────────────────────────────────────────────────
  atelier_ambient: {
    url:      assetPath('/sounds/ambient/atelier.mp3'),
    category: 'ambient',
    volume:   0.5,
    loop:     true,
  },
}
