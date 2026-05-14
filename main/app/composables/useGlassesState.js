let _manager = null

const glassesActive = ref(false)
const batteryLevel  = ref(100)
const notifications = ref([])
const collectibles  = ref([])   // [{ id, label, collected }]

export function useGlassesState() {
  function bind(manager) {
    _manager = manager
    collectibles.value  = []
    notifications.value = []

    manager.on('glasses:on',  () => { glassesActive.value = true })
    manager.on('glasses:off', () => { glassesActive.value = false })

    manager.on('battery', ({ level }) => { batteryLevel.value = level })

    manager.on('notification', (notif) => {
      notifications.value = [...notifications.value, notif]
      if (!notif.permanent && notif.duration > 0) {
        setTimeout(() => _removeById(notif.id), notif.duration)
      }
    })

    manager.on('notification:remove', ({ id }) => _removeById(id))

    manager.on('collectible:add', ({ id, label }) => {
      if (collectibles.value.some(c => c.id === id)) return
      collectibles.value = [...collectibles.value, { id, label, collected: false }]
    })

    manager.on('collectible:done', ({ id }) => {
      collectibles.value = collectibles.value.map(c =>
        c.id === id ? { ...c, collected: true } : c
      )
    })
  }

  function _removeById(id) {
    notifications.value = notifications.value.filter(n => n.id !== id)
  }

  return { glassesActive, batteryLevel, notifications, collectibles, bind }
}
