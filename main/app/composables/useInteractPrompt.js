const visible = ref(false)
const text    = ref('')

export function useInteractPrompt() {
  function show(message) {
    text.value    = message ?? 'Appuyez sur E'
    visible.value = true
  }

  function hide() {
    visible.value = false
  }

  return { visible, text, show, hide }
}
