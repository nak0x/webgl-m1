/**
 * SoundBank — catalogue déclaratif de tous les sons du projet.
 *
 * Chaque entrée :
 *   url      : chemin depuis /public (ex: '/sounds/interaction/porte.mp3')
 *   category : 'interaction' | 'ambient' | 'voice'
 *   volume   : gain relatif à la catégorie (0..1)
 *   loop     : true si le son doit boucler
 */

export const SOUNDS = {
  // ── Interaction joueur ────────────────────────────────────────────────────
  pick_object: {
    url:      '/sounds/interaction/prise-objet.mp3',
    category: 'interaction',
    volume:   0.9,
  },
  pick_tool: {
    url:      '/sounds/interaction/outils-entrechoquent.mp3',
    category: 'interaction',
    volume:   0.85,
  },
  door_open: {
    url:      '/sounds/interaction/porte.mp3',
    category: 'interaction',
    volume:   0.9,
  },
  pc_keyboard: {
    url:      '/sounds/interaction/touches-ordinateur.mp3',
    category: 'interaction',
    volume:   0.7,
  },
  pc_send_report: {
    url:      '/sounds/interaction/envoie-rapport.mp3',
    category: 'interaction',
    volume:   0.85,
  },
  click: {
    url:      '/sounds/interaction/clic.mp3',
    category: 'interaction',
    volume:   0.6,
  },
  glasses_pick: {
    url:      '/sounds/interaction/lunettes-prise.mp3',
    category: 'interaction',
    volume:   0.9,
  },
  glasses_put_down: {
    url:      '/sounds/interaction/lunettes-repos.mp3',
    category: 'interaction',
    volume:   0.9,
  },

  // ── UI / Feedback quête ───────────────────────────────────────────────────
  quest_validate: {
    url:      '/sounds/ui/validation-quete.mp3',
    category: 'interaction',
    volume:   0.8,
  },
  notification: {
    url:      '/sounds/ui/notification.mp3',
    category: 'interaction',
    volume:   0.7,
  },
  transition_ar: {
    url:      '/sounds/ui/transition-ar.mp3',
    category: 'interaction',
    volume:   1.0,
  },

  // ── Ambiance ─────────────────────────────────────────────────────────────
  repair_ambient: {
    url:      '/sounds/ambient/fond-reparation.mp3',
    category: 'ambient',
    volume:   0.5,
    loop:     true,
  },
  city_ambient: {
    url:      '/sounds/ambient/voiture-roule.mp3',
    category: 'ambient',
    volume:   0.4,
    loop:     true,
  },
  footsteps: {
    url:      '/sounds/ambient/pas-marche.mp3',
    category: 'ambient',
    volume:   0.5,
  },

  // ── Voix / Réserve ────────────────────────────────────────────────────────
  despair: {
    url:      '/sounds/voice/desespoir.mp3',
    category: 'voice',
    volume:   0.8,
  },
}
