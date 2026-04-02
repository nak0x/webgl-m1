<template>
  <div class="app-layout">
    <!-- 3D Viewport -->
    <div class="viewport" ref="viewportRef">
      <!-- Header overlay -->
      <div class="viewport-header">
        <h1>Vehicle X-Ray</h1>
        <p>Click a part to inspect · Drag to orbit</p>
      </div>

      <!-- Status badge -->
      <div class="viewport-badge">
        <span class="dot"></span>
        <span>Live Diagnostics</span>
      </div>

      <!-- Indicator markers projected from 3D -->
      <div
        v-for="ind in carScene.indicatorScreenPositions.value"
        :key="ind.id"
        v-show="ind.visible"
        class="indicator-marker"
        :class="ind.status"
        :style="{ left: ind.x + 'px', top: ind.y + 'px' }"
        @click.stop="onIndicatorClick(ind.id)"
      >
        !
        <span class="indicator-tooltip">{{ getPartName(ind.id) }}</span>
      </div>

      <!-- X-Ray info overlay -->
      <Transition name="fade">
        <div v-if="activePartData" class="xray-overlay">
          <button class="xray-close" @click="selectPart(null)">✕</button>
          <div class="xray-title">
            <span class="icon">{{ activePartData.icon }}</span>
            {{ activePartData.name }}
          </div>
          <div class="xray-detail">
            <p><strong>Status:</strong>
              <span
                :class="{
                  'status-badge': true,
                  'good': activePartData.status === 'good',
                  'warn': activePartData.status === 'warn',
                  'critical': activePartData.status === 'critical',
                }"
                style="margin-left: 6px;"
              >
                <span class="status-dot" :class="activePartData.status"></span>
                {{ activePartData.status === 'good' ? 'Good' : activePartData.status === 'warn' ? 'Warning' : 'Critical' }}
              </span>
            </p>
            <p style="margin-top: 8px;">{{ activePartData.description }}</p>
            <p style="margin-top: 6px;"><strong>Usage:</strong> {{ activePartData.usage }}%</p>
            <p><strong>Last inspected:</strong> {{ activePartData.lastInspected }}</p>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Side Panel -->
    <aside class="side-panel">
      <div class="panel-header">
        <h2>Parts Inspector</h2>
        <p class="panel-subtitle">{{ stats.total }} components monitored</p>
      </div>

      <!-- Stats Row -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-value good">{{ stats.good }}</div>
          <div class="stat-label">Healthy</div>
        </div>
        <div class="stat-card">
          <div class="stat-value warn">{{ stats.warn }}</div>
          <div class="stat-label">Warning</div>
        </div>
        <div class="stat-card">
          <div class="stat-value danger">{{ stats.critical }}</div>
          <div class="stat-label">Critical</div>
        </div>
      </div>

      <!-- Parts List -->
      <div class="parts-list-wrapper">
        <div class="section-label">All Components</div>
        <div
          v-for="part in parts"
          :key="part.id"
          class="part-item"
          :class="{ active: activePart === part.id }"
          @click="selectPart(part.id)"
        >
          <div class="part-icon">{{ part.icon }}</div>
          <div class="part-info">
            <div class="part-name">{{ part.name }}</div>
            <div class="part-meta">
              <span class="part-usage">{{ part.usage }}% used</span>
            </div>
            <div class="usage-bar-track">
              <div
                class="usage-bar-fill"
                :class="part.status"
                :style="{ width: part.usage + '%' }"
              ></div>
            </div>
          </div>
          <span
            class="status-badge"
            :class="part.status"
          >
            <span class="status-dot" :class="part.status"></span>
            {{ part.status === 'good' ? 'OK' : part.status === 'warn' ? 'Warn' : 'Crit' }}
          </span>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
const {
  parts,
  activePart,
  stats,
  partsWithIssues,
  selectPart: _selectPart,
  getActivePart,
} = usePartsData()

const carScene = useCarScene()
const viewportRef = ref<HTMLElement | null>(null)

const activePartData = computed(() => getActivePart())

function selectPart(id: string | null) {
  _selectPart(id)
  const part = getActivePart()
  carScene.showXray(part)
}

function onIndicatorClick(partId: string) {
  selectPart(partId)
}

function getPartName(id: string) {
  return parts.value.find(p => p.id === id)?.name || id
}

onMounted(() => {
  if (viewportRef.value) {
    carScene.init(viewportRef.value)
    carScene.setIndicatorParts(partsWithIssues.value)
  }
})

onUnmounted(() => {
  carScene.dispose()
})


</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.96);
}
</style>
