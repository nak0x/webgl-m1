<script setup>
import { reactive, ref, watch } from 'vue'

const emit = defineEmits(['update:config'])

const cfg = reactive({
  chunkSize:   64,
  lod1Ratio:   0.25,
  lod2Ratio:   0.06,
  lod1Error:   0.01,
  lod2Error:   0.05,
  previewOnly: false,
  collisionEnabled:    true,
  collisionResolution: 1024,
  collisionMinY:       0,
  collisionMaxY:       2,
  collisionSlices:     10,
})

const advancedOpen = ref(false)

watch(cfg, () => {
  emit('update:config', {
    chunkSize:   cfg.chunkSize,
    lodRatios:   [1.0, cfg.lod1Ratio, cfg.lod2Ratio],
    lodErrors:   [0,   cfg.lod1Error, cfg.lod2Error],
    previewOnly: cfg.previewOnly,
    collisionMap: {
      enabled:    cfg.collisionEnabled,
      resolution: cfg.collisionResolution,
      minY:       cfg.collisionMinY,
      maxY:       cfg.collisionMaxY,
      sliceCount: cfg.collisionSlices,
    },
  })
}, { immediate: true })
</script>

<template>
  <div class="section">
    <div class="section-title">Chunk Config</div>

    <div class="field">
      <label for="chunk-size">Chunk size</label>
      <input id="chunk-size" type="number" v-model.number="cfg.chunkSize" min="8" step="8" />
    </div>

    <label class="preview-toggle">
      <input type="checkbox" v-model="cfg.previewOnly" />
      <span>Preview only (LOD0, no export)</span>
    </label>

    <button class="adv-toggle" @click="advancedOpen = !advancedOpen">
      {{ advancedOpen ? '▾' : '▸' }} Advanced
    </button>

    <div v-if="advancedOpen" class="adv-panel">
      <div class="adv-group">
        <div class="adv-label">LOD1</div>
        <div class="field">
          <label>Ratio</label>
          <input type="number" v-model.number="cfg.lod1Ratio" min="0.05" max="0.5" step="0.05" />
        </div>
        <div class="field">
          <label>Error</label>
          <input type="number" v-model.number="cfg.lod1Error" min="0" step="0.001" />
        </div>
      </div>

      <div class="adv-group">
        <div class="adv-label">LOD2</div>
        <div class="field">
          <label>Ratio</label>
          <input type="number" v-model.number="cfg.lod2Ratio" min="0.01" max="0.2" step="0.01" />
        </div>
        <div class="field">
          <label>Error</label>
          <input type="number" v-model.number="cfg.lod2Error" min="0" step="0.001" />
        </div>
      </div>

      <div class="field lod0-row">
        <label>LOD0</label>
        <input type="number" value="1.0" disabled />
        <input type="number" value="0" disabled />
      </div>

    </div>
  </div>

  <div class="section">
    <div class="section-title">Collision Map</div>

    <label class="collision-toggle">
      <input type="checkbox" v-model="cfg.collisionEnabled" />
      <span>Generate collision maps</span>
    </label>

    <template v-if="cfg.collisionEnabled">
      <div class="field">
        <label>Resolution</label>
        <select v-model.number="cfg.collisionResolution">
          <option :value="256">256</option>
          <option :value="512">512</option>
          <option :value="1024">1024</option>
          <option :value="2048">2048</option>
          <option :value="4096">4096</option>
          <option :value="8192">8192</option>
        </select>
      </div>
      <div class="field">
        <label>Min Y</label>
        <input type="number" v-model.number="cfg.collisionMinY" step="0.1" />
      </div>
      <div class="field">
        <label>Max Y</label>
        <input type="number" v-model.number="cfg.collisionMaxY" step="0.1" />
      </div>
      <div class="field">
        <label>Slices</label>
        <input type="number" v-model.number="cfg.collisionSlices" min="1" max="20" step="1" />
      </div>
    </template>
  </div>
</template>

<style scoped>
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

.preview-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 12px;
  color: #8b949e;
}

.preview-toggle input[type="checkbox"],
.collision-toggle input[type="checkbox"] {
  accent-color: #3d9eff;
}

.collision-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 12px;
  color: #8b949e;
}

.adv-toggle {
  background: none;
  border: none;
  color: #6e7681;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  padding: 0;
  text-align: left;
  letter-spacing: 0.04em;
}
.adv-toggle:hover { color: #c9d1d9; }

.adv-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px;
  background: #161b22;
  border: 1px solid #21262d;
  border-radius: 6px;
}

.adv-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.adv-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #6e7681;
}

.lod0-row {
  opacity: 0.4;
  grid-template-columns: 50px 1fr 1fr;
}

input:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

select {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 4px;
  color: #e6edf3;
  font-size: 12px;
  font-family: inherit;
  padding: 3px 6px;
  width: 100%;
}
</style>
