/**
 * useTextCinematic — cinématique textuelle (cartes noires).
 *
 * Lit un tableau de cartes JSON et les affiche en séquence.
 * Chaque carte se fait fade-in → hold → fade-out automatiquement.
 *
 * Format d'une carte :
 *   { text: "...", duration: 3000 }
 *   { title: "CHAPITRE I", subtitle: "L'Atelier", duration: 4000 }
 *   { title: "...", text: "...", duration: 5000 }  // title + texte combinés
 *
 * Usage :
 *   const textCinematic = useTextCinematic()
 *   await textCinematic.play(cards)   // resolve quand toutes les cartes sont passées
 *   // ou depuis un World via import JSON :
 *   const cards = await fetch('/cinematics/intro.json').then(r => r.json())
 *   await textCinematic.play(cards)
 */

const FADE_MS = 400

const active  = ref(false)
const card    = ref(null)   // { title?, subtitle?, text?, duration }
const visible = ref(false)  // contrôle le fade CSS

export function useTextCinematic() {
  function play(cards) {
    if (!cards?.length) return Promise.resolve()

    return new Promise(resolve => {
      active.value  = true
      visible.value = false
      card.value    = null

      let index = 0

      async function showNext() {
        if (index >= cards.length) {
          visible.value = false
          await delay(FADE_MS)
          active.value = false
          card.value   = null
          resolve()
          return
        }

        const current = cards[index++]
        card.value    = current
        visible.value = true

        const holdMs  = Math.max((current.duration ?? 3000) - FADE_MS * 2, 100)
        await delay(holdMs)
        visible.value = false
        await delay(FADE_MS)
        showNext()
      }

      showNext()
    })
  }

  function skip() {
    // Coupe immédiatement — la Promise ne resolve pas, le caller doit gérer
    visible.value = false
    active.value  = false
    card.value    = null
  }

  return { active, card, visible, play, skip }
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}
