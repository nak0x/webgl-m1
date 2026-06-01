/**
 * useTextCinematic — cinématique textuelle.
 *
 * Format d'une carte :
 *   { text: "...", duration: 3000 }
 *   { title: "CHAPITRE I", subtitle: "L'Atelier", duration: 4000 }
 *   { title: "...", text: "...", duration: 5000 }
 *
 * play(cards, { backgroundImage: '/img/atelier.jpg' }) — image de fond optionnelle
 */

const FADE_MS = 400

const active          = ref(false)
const card            = ref(null)
const visible         = ref(false)
const backgroundImage = ref(null)

export function useTextCinematic() {
  function play(cards, options = {}) {
    if (!cards?.length) return Promise.resolve()

    return new Promise(resolve => {
      active.value          = true
      visible.value         = false
      card.value            = null
      backgroundImage.value = options.backgroundImage ?? null

      let index = 0

      async function showNext() {
        if (index >= cards.length) {
          visible.value = false
          await delay(FADE_MS)
          active.value          = false
          card.value            = null
          backgroundImage.value = null
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
    visible.value         = false
    active.value          = false
    card.value            = null
    backgroundImage.value = null
  }

  return { active, card, visible, backgroundImage, play, skip }
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}
