let _manager  = null
let _handlers = {}

const activeRepair  = ref(null)
const xrayRepairId  = ref(null)
const vehicleInfo   = ref(null)
const vehicleMeta   = ref(null)
const doneRepairs   = ref(new Set())

export function useRepairState() {
  function bind(manager, repairData) {
    if (repairData) {
      vehicleInfo.value = repairData.vehicle
      vehicleMeta.value = repairData.meta
    }

    if (manager) {
      _manager = manager

      _handlers.open  = ({ repair }) => { activeRepair.value = repair }
      _handlers.close = ()           => { activeRepair.value = null }
      _handlers.done  = ({ id })     => {
        doneRepairs.value = new Set([...doneRepairs.value, id])
        activeRepair.value = null
      }

      manager.on('inspect:open',  _handlers.open)
      manager.on('inspect:close', _handlers.close)
      manager.on('repair:done',   _handlers.done)
    }
  }

  function confirmRepair(id, action) {
    _manager?.confirmRepair(id, action)
  }

  function unbind() {
    if (_manager && _handlers.open) {
      _manager.off('inspect:open',  _handlers.open)
      _manager.off('inspect:close', _handlers.close)
      _manager.off('repair:done',   _handlers.done)
    }
    _manager       = null
    _handlers      = {}
    activeRepair.value  = null
    xrayRepairId.value  = null
    vehicleInfo.value   = null
    vehicleMeta.value   = null
    doneRepairs.value   = new Set()
  }

  return {
    activeRepair,
    xrayRepairId,
    vehicleInfo,
    vehicleMeta,
    doneRepairs,
    bind,
    confirmRepair,
    unbind,
  }
}
