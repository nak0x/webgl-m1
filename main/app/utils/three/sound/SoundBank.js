/**
 * SoundBank — catalogue déclaratif de tous les sons du projet.
 *
 * Chaque entrée :
 *   url      : chemin depuis /public (ex: '/sounds/interaction/confirm.mp3')
 *   category : 'interaction' | 'ambient' | 'voice'
 *   volume   : gain relatif à la catégorie (0..1)
 *   loop     : true si le son doit boucler
 *
 * Ajouter un son = ajouter une entrée ici + déposer le fichier dans public/sounds/.
 * Le SoundManager précharge tout au démarrage et logue un warning si un fichier manque.
 */

export const SOUNDS = {
  // ── Interactions ─────────────────────────────────────────────────────────
  interact_confirm: {
    url:      '/sounds/interaction/confirm.mp3',
    category: 'interaction',
    volume:   0.8,
  },
  hover_tick: {
    url:      '/sounds/interaction/hover.mp3',
    category: 'interaction',
    volume:   0.4,
  },
  proximity_enter: {
    url:      '/sounds/interaction/animal-crossing-isabelle-voice-clips-no-background-music-youtubemp3free.mp3',
    category: 'interaction',
    volume:   0.5,
  },

  // ── Ambiance ─────────────────────────────────────────────────────────────
  atelier_ambient: {
    url:      '/sounds/ambient/atelier.mp3',
    category: 'ambient',
    volume:   0.5,
    loop:     true,
  },
}
