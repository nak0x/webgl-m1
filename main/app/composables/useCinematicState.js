/**
 * useCinematicState — état réactif Vue du CinematicManager.
 *
 * Usage :
 *   const cinematic = useCinematicState()
 *   cinematic.bind(experience.cinematic)
 *
 *   // Dans le template :
 *   <CinematicHud v-if="cinematic.active.value" />
 */

let _manager = null

const active      = ref(false)
const isPaused    = ref(false)
const currentTime = ref(0)
const duration    = ref(0)

export function useCinematicState() {
  function bind(manager) {
    _manager = manager

    manager.on('start', ({ duration: d }) => {
      active.value   = true
      isPaused.value = false
      duration.value = d
    })

    manager.on('end', () => {
      active.value      = false
      isPaused.value    = false
      currentTime.value = 0
      duration.value    = 0
    })

    manager.on('pause',  () => { isPaused.value = true  })
    manager.on('resume', () => { isPaused.value = false })

    manager.on('progress', ({ current, total }) => {
      currentTime.value = current
      duration.value    = total
    })
  }

  function pause()        { _manager?.pause()   }
  function resume()       { _manager?.resume()  }
  function skip()         { _manager?.skip()    }
  function seek(seconds)  { _manager?.seek(seconds) }

  return { active, isPaused, currentTime, duration, bind, pause, resume, skip, seek }
}
