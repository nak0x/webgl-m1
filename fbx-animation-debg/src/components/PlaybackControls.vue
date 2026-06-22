<template>
  <Transition name="slide-up">
    <div v-if="visible" class="controls">
      <!-- Play / Pause -->
      <button class="ctrl-btn play-btn" @click="emit('toggle')">
        <svg v-if="playback.playing" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5,3 19,12 5,21" />
        </svg>
      </button>

      <!-- Time display -->
      <span class="time-display">{{ formatTime(playback.currentTime) }}</span>

      <!-- Timeline scrubber -->
      <div class="timeline-wrap">
        <input
          type="range"
          class="timeline"
          :min="0"
          :max="playback.duration || 1"
          :step="0.001"
          :value="playback.currentTime"
          @input="onSeek"
          @mousedown="onScrubStart"
          @mouseup="onScrubEnd"
          @touchstart="onScrubStart"
          @touchend="onScrubEnd"
        />
        <div
          class="timeline-fill"
          :style="{ width: progressPercent + '%' }"
        />
      </div>

      <!-- Duration -->
      <span class="time-display">{{ formatTime(playback.duration) }}</span>

      <!-- Animation name pill -->
      <div v-if="activeClip" class="clip-name">
        <span>{{ activeClip.name }}</span>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  playback: { type: Object, required: true },
  activeClip: { type: Object, default: null },
})

const emit = defineEmits(['toggle', 'seek'])

const visible = computed(() => props.activeClip !== null)

const progressPercent = computed(() => {
  if (!props.playback.duration) return 0
  return (props.playback.currentTime / props.playback.duration) * 100
})

function formatTime(s) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60).toString().padStart(2, '0')
  const ms = Math.floor((s % 1) * 10)
  return `${m}:${sec}.${ms}`
}

let scrubbing = false

function onScrubStart() {
  scrubbing = true
}

function onScrubEnd() {
  scrubbing = false
}

function onSeek(e) {
  emit('seek', parseFloat(e.target.value))
}
</script>

<style scoped>
.controls {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: rgba(16, 16, 22, 0.88);
  backdrop-filter: blur(12px);
  border: 1px solid #252530;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  min-width: 420px;
  max-width: 680px;
  width: 50%;
  z-index: 10;
  user-select: none;
}

.ctrl-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: #1e1e2c;
  border-radius: 8px;
  color: #c0c0d8;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}

.ctrl-btn:hover {
  background: #2a2a40;
  color: #e0e0f0;
}

.play-btn {
  background: #3a2e7a;
  color: #c4b9ff;
}

.play-btn:hover {
  background: #4a3e9a;
  color: #ddd6ff;
}

.time-display {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: #5a5a78;
  white-space: nowrap;
  min-width: 44px;
  text-align: center;
}

.timeline-wrap {
  flex: 1;
  position: relative;
  height: 20px;
  display: flex;
  align-items: center;
}

.timeline {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #222232;
  border-radius: 2px;
  cursor: pointer;
  outline: none;
}

.timeline::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  background: #7c6af7;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.1s;
  box-shadow: 0 0 0 3px rgba(124, 106, 247, 0.2);
}

.timeline::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.timeline::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: #7c6af7;
  border-radius: 50%;
  border: none;
  cursor: pointer;
}

.timeline-fill {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  height: 4px;
  background: #7c6af7;
  border-radius: 2px;
  pointer-events: none;
  z-index: 1;
  transition: width 0.05s linear;
}

.clip-name {
  padding: 3px 10px;
  border-radius: 20px;
  background: rgba(124, 106, 247, 0.12);
  border: 1px solid rgba(124, 106, 247, 0.2);
  font-size: 11px;
  color: #9a8ee8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}
</style>
