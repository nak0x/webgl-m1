const isPaused = ref(false)

export function usePauseState() {
  function open()  { isPaused.value = true  }
  function close() { isPaused.value = false }
  function toggle() { isPaused.value = !isPaused.value }

  return { isPaused, open, close, toggle }
}
