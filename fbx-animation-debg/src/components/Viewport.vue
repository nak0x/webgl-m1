<template>
  <div class="viewport-wrap" @dragover.prevent="onDragOver" @dragleave="onDragLeave" @drop.prevent="onDrop">
    <canvas ref="canvasRef" class="gl-canvas" />

    <!-- Drop overlay: shown when no model loaded OR dragging a new file -->
    <Transition name="fade">
      <div v-if="showOverlay" class="drop-overlay" :class="{ dragging: isDragging }">
        <div class="drop-box">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p class="drop-title">{{ isDragging ? 'Release to load FBX' : 'Drop an FBX file here' }}</p>
          <p class="drop-sub">Animations will appear in the side panel</p>
        </div>
      </div>
    </Transition>

    <!-- Replace hint when model loaded and dragging -->
    <Transition name="fade">
      <div v-if="hasModel && isDragging" class="replace-overlay">
        <div class="replace-box">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p>Drop to replace model</p>
        </div>
      </div>
    </Transition>

    <div v-if="loading" class="loading-overlay">
      <div class="spinner" />
      <p>Loading FBX…</p>
    </div>

    <div v-if="error" class="error-toast">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  hasModel: Boolean,
  loading: Boolean,
})

const emit = defineEmits(['file-dropped'])

const canvasRef = ref(null)
const isDragging = ref(false)
const error = ref('')
let cleanup = null
let errorTimer = null

const showOverlay = computed(() => !props.hasModel && !props.loading)

function onDragOver() {
  isDragging.value = true
}

function onDragLeave() {
  isDragging.value = false
}

function onDrop(e) {
  isDragging.value = false
  const file = e.dataTransfer.files[0]
  if (!file) return
  if (!file.name.toLowerCase().endsWith('.fbx')) {
    showError('Only .fbx files are supported')
    return
  }
  emit('file-dropped', file)
}

function showError(msg) {
  error.value = msg
  clearTimeout(errorTimer)
  errorTimer = setTimeout(() => (error.value = ''), 3000)
}

onUnmounted(() => {
  if (cleanup) cleanup()
  clearTimeout(errorTimer)
})

defineExpose({ canvasRef })
</script>

<style scoped>
.viewport-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.gl-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.drop-overlay,
.replace-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.drop-overlay {
  background: #141418;
}

.drop-overlay.dragging .drop-box {
  border-color: #7c6af7;
  background: rgba(124, 106, 247, 0.08);
  color: #c4b9ff;
}

.drop-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 64px;
  border: 2px dashed #2e2e3a;
  border-radius: 16px;
  color: #5a5a72;
  background: rgba(255,255,255,0.02);
  transition: border-color 0.2s, background 0.2s, color 0.2s;
}

.drop-title {
  font-size: 16px;
  font-weight: 500;
  color: inherit;
}

.drop-sub {
  font-size: 12px;
  color: #3e3e52;
}

.replace-overlay {
  background: rgba(10, 10, 16, 0.7);
  backdrop-filter: blur(4px);
}

.replace-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 48px;
  border: 2px dashed #7c6af7;
  border-radius: 12px;
  color: #c4b9ff;
  font-size: 15px;
  font-weight: 500;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background: rgba(14, 14, 18, 0.75);
  backdrop-filter: blur(3px);
  color: #9a9ab8;
  font-size: 14px;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #2a2a38;
  border-top-color: #7c6af7;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-toast {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 20px;
  background: #3a1a1a;
  border: 1px solid #7a3030;
  border-radius: 8px;
  color: #ff8a8a;
  font-size: 13px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
