/**
 * useDialogueState — état réactif Vue du DialogueManager.
 *
 * Bind une fois le manager prêt, puis reactive partout.
 *
 * Usage :
 *   const dialogue = useDialogueState()
 *   dialogue.bind(experience.dialogue)
 *
 *   // Dans le template :
 *   <DialogueHud v-if="dialogue.active.value" />
 */

let _manager = null

const active   = ref(false)
const current  = ref(null)    // { speaker, text }
const index    = ref(0)
const total    = ref(0)
const isLast   = computed(() => index.value === total.value - 1)

export function useDialogueState() {
  function bind(manager) {
    _manager = manager

    manager.on('open', ({ line, index: i, total: t }) => {
      current.value = line
      index.value   = i
      total.value   = t
      active.value  = true
    })

    manager.on('line', ({ line, index: i }) => {
      current.value = line
      index.value   = i
    })

    manager.on('complete', () => {
      active.value  = false
      current.value = null
    })
  }

  function next() {
    _manager?.next()
  }

  return { active, current, index, total, isLast, bind, next }
}
