/**
 * Utilitaires d'interpolation pour les effets cinématiques.
 * Fonctions pures — aucun état, aucune dépendance Three.js.
 */

export function easeLinear(t)  { return t }
export function easeIn(t)      { return t * t }
export function easeOut(t)     { return t * (2 - t) }
export function easeInOut(t)   { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t }

export function applyEasing(t, easing) {
  switch (easing) {
    case 'easeIn':    return easeIn(t)
    case 'easeOut':   return easeOut(t)
    case 'easeInOut': return easeInOut(t)
    default:          return t
  }
}

/**
 * Trouve le dernier event d'un type donné avant ou à `frame`.
 * Retourne { event, progress, t } ou null.
 *
 * `progress` = progression [0..1] dans la durée de l'event.
 * Si l'event n'a pas de `duration`, progress = 1 (instantané).
 */
export function interpolateEffect(events, type, frame) {
  if (!events?.length) return null

  const candidates = events
    .filter(e => e.type === type && e.frame <= frame)
    .sort((a, b) => b.frame - a.frame)

  if (!candidates.length) return null

  const last = candidates[0]
  const duration = last.duration ?? 0

  if (duration <= 0) return { event: last, progress: 1, t: 1 }

  const raw      = Math.min((frame - last.frame) / duration, 1)
  const t        = applyEasing(raw, last.easing ?? 'linear')
  return { event: last, progress: raw, t }
}

/**
 * Lerp linéaire entre deux nombres.
 */
export function lerp(a, b, t) { return a + (b - a) * t }

/**
 * Lerp avec fallback : si `from` est undefined, retourne `to` (pas d'interpolation).
 * Permet d'avoir des champs `*From` optionnels dans les events JSON.
 */
export function lerpParam(from, to, t) {
  if (from === undefined || from === null) return to
  return from + (to - from) * t
}
