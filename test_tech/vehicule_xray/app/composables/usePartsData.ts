export interface VehiclePart {
  id: string
  name: string
  icon: string
  usage: number // 0-100
  status: 'good' | 'warn' | 'critical'
  description: string
  lastInspected: string
  // 3D positioning for the part on the car
  position: { x: number; y: number; z: number }
  // Scale of the highlighted region
  scale: { x: number; y: number; z: number }
  // Whether this part has an indicator on the car
  hasIndicator: boolean
}

export function usePartsData() {
  const parts = ref<VehiclePart[]>([
    {
      id: 'engine',
      name: 'Engine Block',
      icon: '⚙️',
      usage: 72,
      status: 'warn',
      description: 'Cylinder head showing early signs of carbon buildup. Oil temp slightly elevated.',
      lastInspected: '3 days ago',
      position: { x: 0, y: 0.55, z: 1.1 },
      scale: { x: 1.0, y: 0.7, z: 1.0 },
      hasIndicator: true,
    },
    {
      id: 'battery',
      name: 'Battery Pack',
      icon: '🔋',
      usage: 88,
      status: 'critical',
      description: 'Cell degradation at 12%. Charge cycles approaching replacement threshold.',
      lastInspected: '1 day ago',
      position: { x: 0, y: 0.25, z: 0 },
      scale: { x: 1.8, y: 0.3, z: 0.9 },
      hasIndicator: true,
    },
    {
      id: 'front-suspension',
      name: 'Front Suspension',
      icon: '🔧',
      usage: 45,
      status: 'good',
      description: 'Shock absorbers and struts within normal operating parameters.',
      lastInspected: '1 week ago',
      position: { x: 0, y: 0.25, z: 1.6 },
      scale: { x: 1.6, y: 0.4, z: 0.5 },
      hasIndicator: false,
    },
    {
      id: 'rear-axle',
      name: 'Rear Axle',
      icon: '🛞',
      usage: 35,
      status: 'good',
      description: 'Differential fluid clean. Bearings show no wear patterns.',
      lastInspected: '2 weeks ago',
      position: { x: 0, y: 0.25, z: -1.5 },
      scale: { x: 1.6, y: 0.4, z: 0.5 },
      hasIndicator: false,
    },
    {
      id: 'brakes',
      name: 'Brake System',
      icon: '🛑',
      usage: 60,
      status: 'warn',
      description: 'Front brake pads at 40% life. Recommend inspection within 5000 km.',
      lastInspected: '5 days ago',
      position: { x: 0, y: 0.3, z: 1.5 },
      scale: { x: 2.0, y: 0.35, z: 0.4 },
      hasIndicator: true,
    },
    {
      id: 'transmission',
      name: 'Transmission',
      icon: '⚡',
      usage: 30,
      status: 'good',
      description: 'Gear shifting smooth. Transmission fluid recently replaced.',
      lastInspected: '2 weeks ago',
      position: { x: 0, y: 0.4, z: 0.5 },
      scale: { x: 0.7, y: 0.5, z: 0.8 },
      hasIndicator: false,
    },
    {
      id: 'cooling',
      name: 'Cooling System',
      icon: '❄️',
      usage: 52,
      status: 'good',
      description: 'Radiator functioning. Coolant levels nominal. Thermostat responsive.',
      lastInspected: '4 days ago',
      position: { x: 0, y: 0.7, z: 1.5 },
      scale: { x: 1.2, y: 0.4, z: 0.3 },
      hasIndicator: false,
    },
    {
      id: 'exhaust',
      name: 'Exhaust System',
      icon: '💨',
      usage: 55,
      status: 'good',
      description: 'Catalytic converter efficient. No leaks detected in manifold.',
      lastInspected: '1 week ago',
      position: { x: 0, y: 0.22, z: -0.8 },
      scale: { x: 0.5, y: 0.3, z: 1.6 },
      hasIndicator: false,
    },
  ])

  const activePart = ref<string | null>(null)

  const stats = computed(() => {
    const total = parts.value.length
    const good = parts.value.filter(p => p.status === 'good').length
    const warn = parts.value.filter(p => p.status === 'warn').length
    const critical = parts.value.filter(p => p.status === 'critical').length
    return { total, good, warn, critical }
  })

  const partsWithIssues = computed(() =>
    parts.value.filter(p => p.hasIndicator && p.status !== 'good')
  )

  function selectPart(id: string | null) {
    activePart.value = activePart.value === id ? null : id
  }

  function getActivePart() {
    return parts.value.find(p => p.id === activePart.value) || null
  }

  return {
    parts,
    activePart,
    stats,
    partsWithIssues,
    selectPart,
    getActivePart,
  }
}
