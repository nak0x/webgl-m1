const isActive = ref(false)
const tutoDone = ref(false)

export function usePcState() {
  function enter()    { isActive.value = true  }
  function exit()     { isActive.value = false }
  function setTutoDone() { tutoDone.value = true }
  return { isActive, tutoDone, enter, exit, setTutoDone }
}
