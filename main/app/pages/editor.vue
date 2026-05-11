<template>
  <div class="editor">

    <!-- Toolbar -->
    <div class="editor-toolbar">
      <label class="tb-btn">
        Load .glb
        <input type="file" accept=".glb" style="display:none" @change="onGlbPicked" />
      </label>
      <label class="tb-btn" :class="{ 'tb-btn--disabled': !loaded }">
        Load JSON
        <input v-if="loaded" type="file" accept=".json" style="display:none" @change="onJsonPicked" />
      </label>
      <button class="tb-btn" :disabled="!loaded" @click="store.exportJson()">Export JSON</button>
      <div class="tb-sep" />
      <button class="tb-btn tb-btn--primary" :disabled="!loaded" @click="openAddModal">+ Event</button>
      <div class="tb-sep" />
      <template v-if="loaded">
        <span class="tb-label">Caméra défaut</span>
        <select class="tb-select" :value="store.defaultCamera" @change="onDefaultCameraChange">
          <option v-for="c in store.cameras" :key="c" :value="c">{{ c }}</option>
        </select>
        <div class="tb-sep" />
      </template>
      <span class="tb-info">{{ loaded ? glbName : 'Aucun GLB chargé' }}</span>
    </div>

    <!-- Body : preview + inspector -->
    <div class="editor-body">
      <div ref="previewEl" class="editor-preview">
        <canvas ref="canvas" class="preview-canvas" />
        <div v-if="!loaded" class="preview-placeholder">
          Charge un fichier .glb pour commencer
        </div>
        <div
          class="vignette-overlay"
          :style="{
            opacity: vignetteOpacity,
            transition: vignetteDuration > 0 ? `opacity ${vignetteDuration}ms linear` : 'none',
          }"
        />
      </div>
      <div class="editor-right">
        <EditorInspector class="editor-inspector" />
        <EditorAssets class="editor-assets" />
      </div>
    </div>

    <!-- Timeline -->
    <EditorTimeline class="editor-timeline" :player="player" @seek="onSeek" />

    <!-- Add event modal -->
    <Transition name="modal">
      <div v-if="showModal" class="modal-backdrop" @click.self="showModal = false">
        <div class="modal-box">
          <h3 class="modal-title">Ajouter un événement</h3>
          <div class="modal-field">
            <label>Type</label>
            <select v-model="newEventType">
              <option v-for="t in EVENT_TYPES" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div class="modal-actions">
            <button class="tb-btn tb-btn--primary" @click="confirmAdd">Créer</button>
            <button class="tb-btn" @click="showModal = false">Annuler</button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<script setup>
import { LUTCubeLoader }  from 'three/addons/loaders/LUTCubeLoader.js'
import Experience         from '~/utils/three/Experience.js'
import CinematicPlayer    from '~/utils/three/cinematic/CinematicPlayer.js'
import { useCinematicEditorStore, EVENT_TYPES } from '~/stores/cinematicEditor.js'

const store     = useCinematicEditorStore()
const canvas    = useTemplateRef('canvas')
const previewEl = useTemplateRef('previewEl')

const loaded       = ref(false)
const glbName      = ref('')
const showModal    = ref(false)
const newEventType = ref('cameraCut')

let experience   = null
let player       = null
let blobUrl      = null
let previewRo    = null
let currentAudio = null

const vignetteOpacity  = ref(0)
const vignetteDuration = ref(0)

// ─── Preview sizing ──────────────────────────────────────────────────────

function _syncPreviewSize() {
  if (!experience || !previewEl.value) return
  const { clientWidth: w, clientHeight: h } = previewEl.value
  if (w === 0 || h === 0) return
  experience.sizes.width  = w
  experience.sizes.height = h
  experience.sizes.trigger('resize')
}

// ─── GLB loading ─────────────────────────────────────────────────────────

async function onGlbPicked(e) {
  const file = e.target.files[0]
  if (!file) return
  e.target.value = ''

  glbName.value = file.name
  _disposeExperience()

  if (blobUrl) URL.revokeObjectURL(blobUrl)
  blobUrl = URL.createObjectURL(file)

  const sources = [{ name: 'cinematic', type: 'gltf', path: blobUrl }]
  experience = new Experience(canvas.value, sources)
  _syncPreviewSize()
  previewRo = new ResizeObserver(_syncPreviewSize)
  previewRo.observe(previewEl.value)

  player = new CinematicPlayer(experience, null)
  experience.setWorld(player)

  player.on('ready', (data) => {
    store.hydrateFromGlb(data)
    loaded.value = true
  })

  player.on('frame_change', (frame) => {
    store.currentFrame = frame
  })

  player.on('ended', () => {
    store.isPlaying = false
  })

  player.on('vignette_change', ({ opacity, durationMs }) => {
    vignetteDuration.value = durationMs
    vignetteOpacity.value  = opacity
  })

  player.on('play_sound', ({ file: filename, volume }) => {
    currentAudio?.pause()
    currentAudio = null
    const asset = store.assets.find(a => a.name === filename && a.assetType === 'audio')
    if (!asset) return
    currentAudio = new Audio(asset.url)
    currentAudio.volume = Math.min(1, Math.max(0, volume))
    currentAudio.play()
  })

  player.on('load_lut', ({ file: filename, intensity }) => {
    const asset = store.assets.find(a => a.name === filename && a.assetType === 'lut')
    if (!asset) return
    new LUTCubeLoader().load(asset.url, (result) => {
      player?.setLutTexture(filename, result.texture3D, intensity ?? 1.0)
    })
  })
}

async function onJsonPicked(e) {
  const file = e.target.files[0]
  if (!file) return
  e.target.value = ''
  const text = await file.text()
  const json = JSON.parse(text)
  store.loadJson(json)
  player?.loadConfig(json)
}

function _disposeExperience() {
  currentAudio?.pause()
  currentAudio           = null
  vignetteOpacity.value  = 0
  vignetteDuration.value = 0
  previewRo?.disconnect()
  previewRo = null
  if (player)     { player.dispose();     player     = null }
  if (experience) { experience.dispose(); experience = null }
  loaded.value = false
  store.$reset?.()
}

// ─── Playback ────────────────────────────────────────────────────────────

function onSeek(frame) {
  currentAudio?.pause()
  currentAudio = null
  player?.seek(frame)
}

watch(() => store.isPlaying, (val) => {
  if (!player) return
  if (!val) { currentAudio?.pause(); currentAudio = null }
  val ? player.play() : player.pause()
})

watch(
  () => ({ events: store.events, fps: store.fps, totalFrames: store.totalFrames, defaultCamera: store.defaultCamera }),
  (val) => { player?.syncConfig(toRaw(val)) },
  { deep: true },
)

// ─── Default camera ──────────────────────────────────────────────────────

function onDefaultCameraChange(e) {
  store.defaultCamera = e.target.value
  player?.setDefaultCamera(e.target.value)
}

// ─── Add event modal ─────────────────────────────────────────────────────

function openAddModal() {
  newEventType.value = 'cameraCut'
  showModal.value    = true
}

function confirmAdd() {
  store.addEvent(newEventType.value, store.currentFrame)
  showModal.value = false
}

// Space = play/pause
function onKeyDown(e) {
  if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
    e.preventDefault()
    store.isPlaying = !store.isPlaying
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  _disposeExperience()
  if (blobUrl) URL.revokeObjectURL(blobUrl)
})
</script>

<style scoped>
.editor {
  display: grid;
  grid-template-rows: 44px 1fr 30vh;
  height: 100vh;
  overflow: hidden;
  background: #111;
  color: #ddd;
  font-family: system-ui, sans-serif;
  font-size: 13px;
}

/* ── Toolbar ── */
.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  background: #1e1e1e;
  border-bottom: 1px solid #2a2a2a;
}

.tb-btn {
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  color: #ccc;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}
.tb-btn:hover:not(:disabled) { background: #383838; }
.tb-btn:disabled { opacity: 0.4; cursor: default; }
.tb-btn--primary { background: #1d4ed8; border-color: #2563eb; color: #fff; }
.tb-btn--primary:hover:not(:disabled) { background: #2563eb; }
.tb-btn--disabled { opacity: 0.4; pointer-events: none; cursor: default; }

.tb-sep { width: 1px; height: 20px; background: #333; margin: 0 4px; }

.tb-info  { color: #666; font-size: 11px; margin-left: 4px; }
.tb-label { color: #888; font-size: 11px; }
.tb-select {
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  color: #ccc;
  padding: 3px 6px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

/* ── Body ── */
.editor-body {
  display: grid;
  grid-template-columns: 60fr 40fr;
  overflow: hidden;
  min-height: 0;
}

.editor-preview {
  position: relative;
  overflow: hidden;
  background: #0a0a0a;
}

.preview-canvas {
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  display: block;
}

.preview-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #444;
  font-size: 14px;
  pointer-events: none;
}

.vignette-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.92) 100%);
  opacity: 0;
}

.editor-right {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  border-left: 1px solid #2a2a2a;
}
.editor-inspector { flex: 1; overflow-y: auto; min-height: 0; border-left: none; }
.editor-assets    { flex-shrink: 0; height: 200px; border-top: 1px solid #2a2a2a; }

/* ── Timeline ── */
.editor-timeline { min-height: 0; overflow: hidden; }

/* ── Modal ── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-box {
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 24px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-title { margin: 0; font-size: 15px; color: #eee; font-weight: 600; }

.modal-field { display: flex; flex-direction: column; gap: 6px; }
.modal-field label { color: #888; font-size: 11px; text-transform: uppercase; }
.modal-field select {
  background: #252525;
  border: 1px solid #444;
  color: #ddd;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 13px;
}

.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }

.modal-enter-active, .modal-leave-active { transition: opacity 0.15s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
