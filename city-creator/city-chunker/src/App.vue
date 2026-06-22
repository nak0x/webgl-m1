<script setup>
import { ref } from 'vue'
import DropZone from './components/DropZone.vue'
import ChunkConfig from './components/ChunkConfig.vue'
import PreviewCanvas from './components/PreviewCanvas.vue'
import ProgressPanel from './components/ProgressPanel.vue'
import ToastStack from './components/ToastStack.vue'
import { useChunker } from './composables/useChunker.js'

// Colour palette — must match PreviewCanvas DISTRICT_COLORS order
const DISTRICT_COLORS = ['#3d9eff', '#f0a742', '#2ea043', '#e25555', '#c9a0ff']

const districts       = ref([])
const districtOffsets = ref([])   // [{ x, z }, …] — parallel to districts

// Persist offsets by filename so reorder/re-add keeps the last known position
const _offsetByName = new Map()

const config = ref({
  chunkSize:   64,
  lodRatios:   [1.0, 0.25, 0.06],
  lodErrors:   [0, 0.01, 0.05],
  previewOnly: false,
  collisionMap: {
    enabled:    true,
    resolution: 1024,
    minY:       0,
    maxY:       2,
    sliceCount: 10,
  },
})

const { isRunning, error, manifest, collisions, districtProgress, lodProgress, start, cancel } = useChunker()
const showCollisionMap = ref(false)

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
      <ChunkConfig @update:config="cfg => config = cfg" />

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

      <label v-if="collisions.length" class="collision-overlay-toggle">
        <input type="checkbox" v-model="showCollisionMap" />
        <span>Show collision overlay</span>
      </label>
    </aside>

    <main class="canvas-panel">
      <PreviewCanvas
        :districts="districts"
        :offsets="districtOffsets"
        :chunk-size="config.chunkSize"
        :manifest="manifest"
        :collisions="collisions"
        :show-collision-map="showCollisionMap"
        @offset-changed="onOffsetChanged"
      />

      <!-- Offset legend — editable XZ + rotation per district -->
      <div v-if="districts.length" class="offset-legend">
        <div v-for="(d, i) in districts" :key="d.name" class="legend-row">
          <span class="legend-dot" :style="{ background: DISTRICT_COLORS[i % DISTRICT_COLORS.length] }"></span>
          <span class="legend-name" :title="d.name">{{ d.name }}</span>
          <span class="legend-fields">
            <label class="legend-field">
              <span class="legend-field-label">X</span>
              <input
                class="legend-input"
                type="number"
                :value="Math.round(districtOffsets[i]?.x ?? 0)"
                @change="e => onOffsetChanged({ index: i, x: +e.target.value, z: districtOffsets[i]?.z ?? 0, angle: districtOffsets[i]?.angle ?? 0 })"
                @keydown.enter="e => e.target.blur()"
              />
            </label>
            <label class="legend-field">
              <span class="legend-field-label">Z</span>
              <input
                class="legend-input"
                type="number"
                :value="Math.round(districtOffsets[i]?.z ?? 0)"
                @change="e => onOffsetChanged({ index: i, x: districtOffsets[i]?.x ?? 0, z: +e.target.value, angle: districtOffsets[i]?.angle ?? 0 })"
                @keydown.enter="e => e.target.blur()"
              />
            </label>
            <label class="legend-field">
              <span class="legend-field-label">R°</span>
              <input
                class="legend-input"
                type="number"
                :value="Math.round(((districtOffsets[i]?.angle ?? 0) * 180 / Math.PI + 360) % 360)"
                @change="e => onOffsetChanged({ index: i, x: districtOffsets[i]?.x ?? 0, z: districtOffsets[i]?.z ?? 0, angle: +e.target.value * Math.PI / 180 })"
                @keydown.enter="e => e.target.blur()"
              />
            </label>
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

.collision-overlay-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 12px;
  color: #8b949e;
}
.collision-overlay-toggle input[type="checkbox"] {
  accent-color: #3d9eff;
}

/* Offset legend — bottom-left of the 3D canvas */
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
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend-fields {
  display: flex;
  gap: 4px;
  margin-left: 4px;
}

.legend-field {
  display: flex;
  align-items: center;
  gap: 2px;
}

.legend-field-label {
  font-size: 10px;
  color: #6e7681;
  white-space: nowrap;
}

.legend-input {
  width: 52px;
  background: rgba(22, 27, 34, 0.9);
  border: 1px solid #30363d;
  border-radius: 3px;
  color: #e6edf3;
  font-size: 11px;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  padding: 1px 4px;
  text-align: right;
  pointer-events: all;
}

.legend-input:focus {
  outline: none;
  border-color: #3d9eff;
  background: rgba(13, 17, 23, 0.95);
}
</style>
