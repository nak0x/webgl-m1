/**
 * useTextCinematic — cinématique textuelle.
 *
 * Format d'une carte :
 *   { text: "...", duration: 3000 }
 *   { title: "CHAPITRE I", subtitle: "L'Atelier", duration: 4000 }
 *   { title: "...", text: "...", duration: 5000 }
 *
 * play(cards, { theme: 'voiture', position: 'left', textColor: '#efeadf' })
 *   theme           — 'voiture' | 'ville' | 'ville-soir' | null (fond libre via backgroundImage)
 *   backgroundImage — image de fond libre (si theme est null)
 *   position        — 'left' | 'center' | 'right' (défaut : 'center')
 *   textColor       — couleur CSS du texte (défaut : couleur du thème)
 */

const FADE_MS = 400

const active          = ref(false)
const card            = ref(null)
const visible         = ref(false)
const backgroundImage = ref(null)
const position        = ref('center')
const textColor       = ref(null)
const theme           = ref(null)

export function useTextCinematic() {
  function play(cards, options = {}) {
    if (!cards?.length) return Promise.resolve()

    return new Promise(resolve => {
      active.value          = true
      visible.value         = false
      card.value            = null
      backgroundImage.value = options.backgroundImage ?? null
      position.value        = options.position  ?? 'center'
      textColor.value       = options.textColor ?? null
      theme.value           = options.theme     ?? null

      let index = 0

      async function showNext() {
        if (index >= cards.length) {
          visible.value = false
          await delay(FADE_MS)
          active.value          = false
          card.value            = null
          backgroundImage.value = null
          position.value        = 'center'
          textColor.value       = null
          theme.value           = null
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
    position.value        = 'center'
    textColor.value       = null
    theme.value           = null
  }

  return { active, card, visible, backgroundImage, position, textColor, theme, play, skip }
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}
