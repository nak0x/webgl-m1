<script setup>
import { ref, computed } from 'vue'
import DropZone from './components/DropZone.vue'
import ChunkConfig from './components/ChunkConfig.vue'
import PreviewCanvas from './components/PreviewCanvas.vue'
import ProgressPanel from './components/ProgressPanel.vue'
import ToastStack from './components/ToastStack.vue'
import { useChunker } from './composables/useChunker.js'

const DISTRICT_COLORS = ['#3d9eff', '#f0a742', '#2ea043', '#e25555', '#c9a0ff']

const districts       = ref([])
const districtOffsets = ref([])
const _offsetByName   = new Map()

const config = ref({
  chunkSize:   64,
  lodRatios:   [1.0, 0.25, 0.06],
  lodErrors:   [0, 0.01, 0.05],
  previewOnly: false,
  collisionMap: {
    enabled:         false,
    minY:            0,
    maxY:            2,
    sliceCount:      10,
    precisionFactor: 5,
  },
})

const { isRunning, error, manifest, collisionData, districtProgress, lodProgress, start, cancel } = useChunker()

const showCollisionMap = ref(false)

// World bounds derived from manifest chunk AABBs (available after processing)
const worldBounds = computed(() => {
  if (!manifest.value?.chunks?.length) return null
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity
  for (const c of manifest.value.chunks) {
    if (c.aabb.min[0] < minX) minX = c.aabb.min[0]
    if (c.aabb.min[2] < minZ) minZ = c.aabb.min[2]
    if (c.aabb.max[0] > maxX) maxX = c.aabb.max[0]
    if (c.aabb.max[2] > maxZ) maxZ = c.aabb.max[2]
  }
  return { minX, minZ, maxX, maxZ }
})

const collisionMapSizeEstimate = computed(() => {
  if (!worldBounds.value) return null
  const { minX, minZ, maxX, maxZ } = worldBounds.value
  const f = config.value.collisionMap.precisionFactor
  const w = Math.ceil((maxX - minX) * f)
  const h = Math.ceil((maxZ - minZ) * f)
  const binKB = Math.ceil((w * h) / 8 / 1024)
  return { w, h, binKB }
})

const collisionMapTooLarge = computed(() => {
  const est = collisionMapSizeEstimate.value
  return est && est.w * est.h > 16_000_000
})

function onFilesAdded(files) {
  districts.value = files
  districtOffsets.value = files.map(f => {
    if (!_offsetByName.has(f.name)) _offsetByName.set(f.name, { x: 0, z: 0 })
    return _offsetByName.get(f.name)
  })
}

function onOffsetChanged({ index, x, z, angle }) {
  const off  = { x, z, angle: angle ?? 0 }
  const file = districts.value[index]
  if (file) _offsetByName.set(file.name, off)
  districtOffsets.value = districtOffsets.value.map((o, i) => i === index ? off : o)
}

function onChunkConfigUpdate(cfg) {
  config.value = { ...config.value, ...cfg }
}

function onProcess() {
  if (!districts.value.length) return
  start(districts.value, config.value, districtOffsets.value)
}
</script>

<template>
  <div class="app-layout">
    <aside class="left-panel">
      <div class="logo">City Chunker</div>
      <DropZone @files-added="onFilesAdded" />
      <ChunkConfig @update:config="onChunkConfigUpdate" />

      <!-- Collision Map settings -->
      <div class="section">
        <div class="section-title">Collision Map</div>

        <label class="toggle-row">
          <input type="checkbox" v-model="config.collisionMap.enabled" />
          <span>Generate collision map</span>
        </label>

        <template v-if="config.collisionMap.enabled">
          <div class="field">
            <label>Min Y (m)</label>
            <input type="number" step="0.1" min="-50" max="50"
              v-model.number="config.collisionMap.minY" />
          </div>
          <div class="field">
            <label>Max Y (m)</label>
            <input type="number" step="0.1" min="-50" max="50"
              v-model.number="config.collisionMap.maxY" />
          </div>
          <div class="field">
            <label>Slices</label>
            <input type="number" step="1" min="1" max="64"
              v-model.number="config.collisionMap.sliceCount" />
          </div>
          <div class="field">
            <label>Precision</label>
            <input type="number" step="0.5" min="0.1" max="20"
              v-model.number="config.collisionMap.precisionFactor" />
          </div>
          <p v-if="collisionMapSizeEstimate" class="cmap-estimate">
            {{ collisionMapSizeEstimate.w }} × {{ collisionMapSizeEstimate.h }} px —
            .bin ≈ {{ collisionMapSizeEstimate.binKB }} KB
          </p>
          <p v-if="collisionMapTooLarge" class="cmap-warning">
            ⚠ Bitmap exceeds 16 Mpx — consider reducing precision.
          </p>
        </template>

        <label v-if="collisionData" class="toggle-row">
          <input type="checkbox" v-model="showCollisionMap" />
          <span>Show collision overlay</span>
        </label>
      </div>

      <div class="action-row">
        <button v-if="!isRunning" class="process-btn" :disabled="!districts.length" @click="onProcess">
          Process
        </button>
        <button v-else class="cancel-btn" @click="cancel">Cancel</button>
      </div>

      <div v-if="error" class="error-banner">{{ error }}</div>

      <ProgressPanel
        :district-progress="districtProgress"
        :lod-progress="lodProgress"
        :is-running="isRunning"
      />
    </aside>

    <main class="canvas-panel">
      <PreviewCanvas
        :districts="districts"
        :offsets="districtOffsets"
        :chunk-size="config.chunkSize"
        :manifest="manifest"
        :collision-data="collisionData"
        :show-collision-map="showCollisionMap"
        @offset-changed="onOffsetChanged"
      />

      <div v-if="districts.length" class="offset-legend">
        <div v-for="(d, i) in districts" :key="d.name" class="legend-row">
          <span class="legend-dot" :style="{ background: DISTRICT_COLORS[i % DISTRICT_COLORS.length] }"></span>
          <span class="legend-name" :title="d.name">{{ d.name }}</span>
          <span class="legend-pos">
            X&nbsp;{{ Math.round(districtOffsets[i]?.x ?? 0) }}&nbsp;
            Z&nbsp;{{ Math.round(districtOffsets[i]?.z ?? 0) }}&nbsp;
            R&nbsp;{{ Math.round(((districtOffsets[i]?.angle ?? 0) * 180 / Math.PI + 360) % 360) }}°
          </span>
        </div>
      </div>
    </main>
  </div>
  <ToastStack />
</template>

<style>
.app-layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  width: 100%;
  height: 100%;
  background: #0f0f0f;
}

.left-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: #0d1117;
  border-right: 1px solid #21262d;
  overflow-y: auto;
  height: 100%;
}

.logo {
  font-size: 15px;
  font-weight: 600;
  color: #e6edf3;
  letter-spacing: 0.05em;
  padding-bottom: 8px;
  border-bottom: 1px solid #21262d;
}

.canvas-panel {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.action-row {
  display: flex;
  gap: 8px;
}

.process-btn,
.cancel-btn {
  flex: 1;
  padding: 7px 0;
  border: none;
  border-radius: 5px;
  font-size: 12px;
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.process-btn {
  background: #238636;
  color: #ffffff;
}
.process-btn:hover:not(:disabled) { background: #2ea043; }
.process-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.cancel-btn {
  background: #b62324;
  color: #ffffff;
}
.cancel-btn:hover { background: #d1373a; }

.error-banner {
  padding: 6px 10px;
  background: rgba(248, 81, 73, 0.12);
  border: 1px solid #f85149;
  border-radius: 5px;
  color: #f85149;
  font-size: 11px;
  word-break: break-word;
}

/* Collision map section */
.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #6e7681;
}

.field {
  display: grid;
  grid-template-columns: 80px 1fr;
  align-items: center;
  gap: 8px;
}

.field label {
  color: #8b949e;
  font-size: 12px;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 12px;
  color: #8b949e;
}

.toggle-row input[type="checkbox"] {
  accent-color: #3d9eff;
}

.cmap-estimate {
  margin: 0;
  font-size: 11px;
  color: #6e7681;
}

.cmap-warning {
  margin: 0;
  font-size: 11px;
  color: #e3b341;
}

/* Offset legend */
.offset-legend {
  position: absolute;
  bottom: 12px;
  left: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  pointer-events: none;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(13, 17, 23, 0.78);
  border: 1px solid #21262d;
  border-radius: 4px;
  padding: 3px 8px;
  backdrop-filter: blur(4px);
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-name {
  font-size: 11px;
  color: #8b949e;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend-pos {
  font-size: 11px;
  color: #e6edf3;
  font-variant-numeric: tabular-nums;
  margin-left: 4px;
  white-space: nowrap;
}
</style>
