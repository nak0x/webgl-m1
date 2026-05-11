<script setup>
import { computed } from 'vue'

const props = defineProps({
  districtProgress: { type: Array, default: () => [] },
  lodProgress:      { type: Array, default: () => [] },
  isRunning:        { type: Boolean, default: false },
})

const LOD_COLORS  = ['#3d9eff', '#f0a742', '#e25555']

const totalChunks = computed(() => props.lodProgress[0]?.total ?? 0)

const chunksExported = computed(() =>
  props.lodProgress.reduce((s, l) => s + l.done, 0)
)

const visible = computed(() =>
  props.isRunning || totalChunks.value > 0 || chunksExported.value > 0
)
</script>

<template>
  <div v-if="visible" class="section">
    <div class="section-title">Progress</div>

    <!-- Per-district merge/clip progress -->
    <div v-for="d in districtProgress" :key="d.name" class="progress-row">
      <div class="row-label">
        <span class="row-name">{{ d.name }}</span>
        <span class="row-stage">{{ d.stage }}</span>
        <span class="row-pct">{{ Math.round(d.pct * 100) }}%</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" :style="{ width: (d.pct * 100).toFixed(1) + '%' }"></div>
      </div>
    </div>

    <div v-if="districtProgress.length" class="divider"></div>

    <!-- Chunk export summary -->
    <div class="chunk-summary">
      Chunks exported:
      <strong>{{ chunksExported }}</strong>
      <span v-if="totalChunks > 0"> / {{ totalChunks }}</span>
    </div>

    <!-- Per-LOD progress bars -->
    <div v-for="(lp, i) in lodProgress" :key="lp.lod" class="progress-row">
      <div class="row-label">
        <span class="row-name lod-tag">LOD{{ lp.lod }}</span>
        <span class="row-pct">
          {{ lp.done }}<span v-if="lp.total > 0"> / {{ lp.total }}</span>
        </span>
      </div>
      <div class="bar-track">
        <div
          class="bar-fill"
          :style="{
            width:      lp.total > 0 ? ((lp.done / lp.total) * 100).toFixed(1) + '%' : '0%',
            background: LOD_COLORS[i],
          }"
        ></div>
      </div>
    </div>
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

.progress-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.row-label {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.row-name {
  font-size: 12px;
  color: #c9d1d9;
  flex: 1;
}

.row-stage {
  font-size: 10px;
  color: #6e7681;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.row-pct {
  font-size: 11px;
  color: #6e7681;
  min-width: 40px;
  text-align: right;
}

.bar-track {
  height: 4px;
  background: #21262d;
  border-radius: 2px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: #3d9eff;
  border-radius: 2px;
  transition: width 0.15s linear;
}

.divider {
  height: 1px;
  background: #21262d;
  margin: 2px 0;
}

.chunk-summary {
  font-size: 12px;
  color: #8b949e;
}

.chunk-summary strong {
  color: #c9d1d9;
}

.lod-tag {
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}
</style>
