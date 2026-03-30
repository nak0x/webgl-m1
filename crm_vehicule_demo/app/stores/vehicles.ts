import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import vehiclesData from '~/data/vehicles.json'

export interface VehiclePosition {
  x: number
  z: number
}

export interface Vehicle {
  id: string
  name: string
  type: string
  typeLabel: string
  status: 'bon_etat' | 'warning' | 'reparation_obligatoire'
  assignedTo: string
  lastMaintenance: string
  nextMaintenance: string
  mileage: number
  position: VehiclePosition
  path: VehiclePosition[]
  parts: string[]
}

const MAX_PATH_LENGTH = 200

export const useVehiclesStore = defineStore('vehicles', () => {
  const vehicles = ref<Vehicle[]>(vehiclesData as Vehicle[])
  const selectedVehicleId = ref<string | null>(null)
  const filterStatus = ref<string>('all')
  const filterType = ref<string>('all')
  const searchQuery = ref<string>('')

  // Getters
  const selectedVehicle = computed(() =>
    vehicles.value.find((v) => v.id === selectedVehicleId.value) ?? null,
  )

  const filteredVehicles = computed(() => {
    let result = vehicles.value

    if (filterStatus.value !== 'all') {
      result = result.filter((v) => v.status === filterStatus.value)
    }

    if (filterType.value !== 'all') {
      result = result.filter((v) => v.type === filterType.value)
    }

    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.assignedTo.toLowerCase().includes(q) ||
          v.typeLabel.toLowerCase().includes(q),
      )
    }

    return result
  })

  const stats = computed(() => {
    const total = vehicles.value.length
    const bonEtat = vehicles.value.filter((v) => v.status === 'bon_etat').length
    const warning = vehicles.value.filter((v) => v.status === 'warning').length
    const reparation = vehicles.value.filter((v) => v.status === 'reparation_obligatoire').length

    return { total, bonEtat, warning, reparation }
  })

  const vehiclesByType = computed(() => {
    const map: Record<string, number> = {}
    vehicles.value.forEach((v) => {
      map[v.typeLabel] = (map[v.typeLabel] || 0) + 1
    })
    return map
  })

  const urgentVehicles = computed(() =>
    vehicles.value.filter((v) => v.status === 'reparation_obligatoire'),
  )

  // Actions
  function selectVehicle(id: string | null) {
    selectedVehicleId.value = id
  }

  function updateVehicleStatus(id: string, status: Vehicle['status']) {
    const vehicle = vehicles.value.find((v) => v.id === id)
    if (vehicle) {
      vehicle.status = status
    }
  }

  function addPathPoint(id: string, point: VehiclePosition) {
    const vehicle = vehicles.value.find((v) => v.id === id)
    if (vehicle) {
      vehicle.path.push(point)
      // Cap path length for performance
      if (vehicle.path.length > MAX_PATH_LENGTH) {
        vehicle.path = vehicle.path.slice(-MAX_PATH_LENGTH)
      }
      vehicle.position = point
    }
  }

  function getVehicleById(id: string): Vehicle | undefined {
    return vehicles.value.find((v) => v.id === id)
  }

  return {
    vehicles,
    selectedVehicleId,
    selectedVehicle,
    filterStatus,
    filterType,
    searchQuery,
    filteredVehicles,
    stats,
    vehiclesByType,
    urgentVehicles,
    selectVehicle,
    updateVehicleStatus,
    addPathPoint,
    getVehicleById,
  }
})
