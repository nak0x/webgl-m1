import { defineStore } from 'pinia'

const EVENT_DEFAULTS = {
  // ── Existants ─────────────────────────────────────────────────────────────
  cameraCut: (cameras) => ({ camera: cameras[0] ?? 'Camera' }),
  sound:     ()        => ({ file: '', volume: 0.8 }),
  vignette:  ()        => ({ direction: 'in', duration: 30 }),
  shake:     ()        => ({ intensity: 0.5, duration: 20 }),
  custom:    ()        => ({ name: '' }),

  // ── Caméra ────────────────────────────────────────────────────────────────
  fov: () => ({ fov: 60, duration: 0, easing: 'linear', progressive: false }),

  // ── PostFX ────────────────────────────────────────────────────────────────
  bloom:               () => ({ strength: 1.5, radius: 0.4, threshold: 0.85, duration: 0, easing: 'linear', progressive: false }),
  dof:                 () => ({ focus: 5.0, aperture: 0.025, maxblur: 0.01, duration: 0, easing: 'linear', progressive: false }),
  ssao:                () => ({ radius: 8, minDistance: 0.005, maxDistance: 0.1, duration: 0, easing: 'linear', progressive: false }),
  motionBlur:          () => ({ damp: 0.96, duration: 0, easing: 'linear', progressive: false }),
  vignetteGl:          () => ({ offset: 0.95, darkness: 1.6, duration: 0, easing: 'linear', progressive: false }),
  chromaticAberration: () => ({ amount: 0.003, duration: 0, easing: 'linear', progressive: false }),
  filmGrain:           () => ({ nIntensity: 0.35, grayscale: false, duration: 0, easing: 'linear', progressive: false }),
  exposure:            () => ({ ev: -1.64, duration: 0, easing: 'linear', progressive: false }),
  lut:                 () => ({ file: '', intensity: 1.0, duration: 0, easing: 'linear', progressive: false }),
  disableEffect:       () => ({ effectName: 'bloom' }),
}

export const EVENT_TYPES = Object.keys(EVENT_DEFAULTS)

export const EVENT_COLORS = {
  // Existants
  cameraCut:           '#4fc3f7',
  sound:               '#a5d6a7',
  vignette:            '#ce93d8',
  shake:               '#ffb74d',
  custom:              '#f48fb1',
  // Caméra
  fov:                 '#80deea',
  // PostFX
  bloom:               '#fff176',
  dof:                 '#ef9a9a',
  ssao:                '#bcaaa4',
  motionBlur:          '#b0bec5',
  vignetteGl:          '#e1bee7',
  chromaticAberration: '#f8bbd0',
  filmGrain:           '#d7ccc8',
  exposure:            '#ffe082',
  lut:                 '#c8e6c9',
  disableEffect:       '#ff8a65',
}

export const POSTFX_EFFECT_NAMES = [
  'bloom', 'dof', 'ssao', 'motionBlur', 'vignetteGl',
  'chromaticAberration', 'filmGrain', 'lut',
]

export const useCinematicEditorStore = defineStore('cinematicEditor', () => {
  const fps             = ref(24)
  const totalFrames     = ref(240)
  const cameras         = ref([])
  const defaultCamera   = ref('')
  const events          = ref([])
  const assets          = ref([])   // [{ id, name, url, assetType }]  assetType: 'audio'|'lut'
  const currentFrame    = ref(0)
  const isPlaying       = ref(false)
  const selectedEventId = ref(null)

  const selectedEvent = computed(() =>
    events.value.find(e => e.id === selectedEventId.value) ?? null,
  )

  // ─── Mutations ──────────────────────────────────────────────────────────

  function addEvent(type, frame = currentFrame.value) {
    const id    = crypto.randomUUID()
    const event = { id, frame, type, ...EVENT_DEFAULTS[type]?.(cameras.value) }
    events.value.push(event)
    events.value.sort((a, b) => a.frame - b.frame)
    selectedEventId.value = id
    return event
  }

  function updateEvent(id, patch) {
    const idx = events.value.findIndex(e => e.id === id)
    if (idx === -1) return
    events.value[idx] = { ...events.value[idx], ...patch }
    if ('frame' in patch) events.value.sort((a, b) => a.frame - b.frame)
  }

  function deleteEvent(id) {
    events.value = events.value.filter(e => e.id !== id)
    if (selectedEventId.value === id) selectedEventId.value = null
  }

  function duplicateEvent(id) {
    const src = events.value.find(e => e.id === id)
    if (!src) return
    const copy = { ...src, id: crypto.randomUUID(), frame: src.frame + 1 }
    events.value.push(copy)
    events.value.sort((a, b) => a.frame - b.frame)
    selectedEventId.value = copy.id
  }

  // ─── Assets ─────────────────────────────────────────────────────────────

  function addAsset(file, assetType = 'audio') {
    const asset = { id: crypto.randomUUID(), name: file.name, url: URL.createObjectURL(file), assetType }
    assets.value.push(asset)
    return asset
  }

  function removeAsset(id) {
    const idx = assets.value.findIndex(a => a.id === id)
    if (idx === -1) return
    URL.revokeObjectURL(assets.value[idx].url)
    assets.value.splice(idx, 1)
  }

  const audioAssets = computed(() => assets.value.filter(a => a.assetType === 'audio'))
  const lutAssets   = computed(() => assets.value.filter(a => a.assetType === 'lut'))

  // ─── Hydratation ────────────────────────────────────────────────────────

  function hydrateFromGlb({ cameras: cams, totalFrames: frames, fps: f }) {
    cameras.value         = cams
    totalFrames.value     = frames
    fps.value             = f
    defaultCamera.value   = cams[0] ?? ''
    events.value          = []
    currentFrame.value    = 0
    selectedEventId.value = null
  }

  function loadJson(json) {
    fps.value             = json.fps ?? 24
    totalFrames.value     = json.totalFrames ?? 240
    defaultCamera.value   = json.defaultCamera ?? ''
    events.value          = json.events ?? []
    currentFrame.value    = 0
    selectedEventId.value = null
  }

  // ─── Export ─────────────────────────────────────────────────────────────

  function exportJson() {
    const data = {
      fps:           fps.value,
      totalFrames:   totalFrames.value,
      defaultCamera: defaultCamera.value,
      events:        events.value,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'cinematique.json' })
    a.click()
    URL.revokeObjectURL(url)
  }

  function $reset() {
    assets.value.forEach(a => URL.revokeObjectURL(a.url))
    assets.value          = []
    fps.value             = 24
    totalFrames.value     = 240
    cameras.value         = []
    defaultCamera.value   = ''
    events.value          = []
    currentFrame.value    = 0
    isPlaying.value       = false
    selectedEventId.value = null
  }

  return {
    fps, totalFrames, cameras, defaultCamera, events, assets,
    audioAssets, lutAssets,
    currentFrame, isPlaying, selectedEventId, selectedEvent,
    addEvent, updateEvent, deleteEvent, duplicateEvent,
    addAsset, removeAsset,
    hydrateFromGlb, loadJson, exportJson, $reset,
  }
})
