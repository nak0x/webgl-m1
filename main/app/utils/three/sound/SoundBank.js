import { assetPath } from '../../assetPath.js'

export const SOUNDS = {
  // ── Interactions ──────────────────────────────────────────────────────────
  clic: {
    url:      assetPath('/sounds/interaction/clic.mp3'),
    category: 'interaction',
    volume:   0.6,
  },
  pick_glasses: {
    url:      assetPath('/sounds/interaction/lunettes-prise.mp3'),
    category: 'interaction',
    volume:   0.8,
  },
  glasses_rest: {
    url:      assetPath('/sounds/interaction/lunettes-repos.mp3'),
    category: 'interaction',
    volume:   0.6,
  },
  door: {
    url:      assetPath('/sounds/interaction/porte.mp3'),
    category: 'interaction',
    volume:   0.8,
  },
  pick_object: {
    url:      assetPath('/sounds/interaction/prise-objet.mp3'),
    category: 'interaction',
    volume:   0.7,
  },
  keyboard: {
    url:      assetPath('/sounds/interaction/touches-ordinateur.mp3'),
    category: 'interaction',
    volume:   0.5,
  },
  tools: {
    url:      assetPath('/sounds/interaction/outils-entrechoquent.mp3'),
    category: 'interaction',
    volume:   0.6,
  },
  send_report: {
    url:      assetPath('/sounds/interaction/envoie-rapport.mp3'),
    category: 'interaction',
    volume:   0.7,
  },

  // ── Voix ──────────────────────────────────────────────────────────────────
  proximity_npc: {
    url:      assetPath('/sounds/interaction/animal-crossing-isabelle-voice-clips-no-background-music-youtubemp3free.mp3'),
    category: 'voice',
    volume:   0.4,
  },

  // ── Ambiance ──────────────────────────────────────────────────────────────
  walk: {
    url:      assetPath('/sounds/ambient/pas-marche.mp3'),
    category: 'ambient',
    volume:   0.6,
    loop:     true,
  },
  repair_ambient: {
    url:      assetPath('/sounds/ambient/fond-reparation.mp3'),
    category: 'ambient',
    volume:   0.4,
    loop:     true,
  },
  car_rolling: {
    url:      assetPath('/sounds/ambient/voiture-roule.mp3'),
    category: 'ambient',
    volume:   0.4,
    loop:     true,
  },

  // ── UI ────────────────────────────────────────────────────────────────────
  notification: {
    url:      assetPath('/sounds/ui/notification.mp3'),
    category: 'interaction',
    volume:   0.7,
  },
  ar_transition: {
    url:      assetPath('/sounds/ui/transition-ar.mp3'),
    category: 'interaction',
    volume:   0.8,
  },
  quest_complete: {
    url:      assetPath('/sounds/ui/validation-quete.mp3'),
    category: 'interaction',
    volume:   0.8,
  },
  ring: {
    url:      assetPath('/sounds/sonnerie-son.mp3'),
    category: 'interaction',
    volume:   0.7,
  },
  vibrate: {
    url:      assetPath('/sounds/sonnerie-vibreur.mp3'),
    category: 'interaction',
    volume:   0.6,
  },
}
