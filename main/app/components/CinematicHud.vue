<template>
  <Transition name="cinematic">
    <div v-if="active" class="cinematic-root">
      <div class="cinematic-bar">

        <!-- Progress -->
        <div class="cinematic-progress">
          <span class="cinematic-time">{{ formatTime(currentTime) }}</span>
          <input
            class="cinematic-seek"
            type="range"
            :min="0"
            :max="duration || 1"
            :value="currentTime"
            step="0.01"
            @input="onSeek"
            @mousedown="onSeekStart"
            @mouseup="onSeekEnd"
          />
          <span class="cinematic-time">{{ formatTime(duration) }}</span>
        </div>

        <!-- Controls -->
        <div class="cinematic-controls">
          <button class="cinematic-btn" @click="togglePause" :aria-label="isPaused ? 'Reprendre' : 'Pause'">
            <svg v-if="isPaused" width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M3 2l9 5-9 5z"/>
            </svg>
            <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="2" y="2" width="4" height="10"/>
              <rect x="8" y="2" width="4" height="10"/>
            </svg>
          </button>

          <button class="cinematic-btn cinematic-skip" @click="skip">
            Passer
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M2 2l7 4-7 4zM10 2h1.5v8H10z"/>
            </svg>
          </button>
        </div>

      </div>
    </div>
  </Transition>
</template>

<script setup>
const props = defineProps({
  active:      { type: Boolean, required: true },
  isPaused:    { type: Boolean, default: false },
  currentTime: { type: Number,  default: 0 },
  duration:    { type: Number,  default: 0 },
})

const emit = defineEmits(['pause', 'resume', 'skip', 'seek'])

function togglePause() {
  props.isPaused ? emit('resume') : emit('pause')
}

function skip() { emit('skip') }

function onSeek(e) {
  emit('seek', parseFloat(e.target.value))
}

// Prevent video from resuming until mouseup when scrubbing
let _wasPaused = false
function onSeekStart() {
  _wasPaused = props.isPaused
  if (!props.isPaused) emit('pause')
}
function onSeekEnd(e) {
  emit('seek', parseFloat(e.target.value))
  if (!_wasPaused) emit('resume')
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}
</script>

<style scoped>
.cinematic-root {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  padding: 0 0 28px;
  z-index: 600;
  pointer-events: none;
}

.cinematic-bar {
  pointer-events: all;
  width: min(720px, 90vw);
  background: rgba(8, 8, 12, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 10px;
  padding: 12px 16px;
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cinematic-progress {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cinematic-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  font-variant-numeric: tabular-nums;
  min-width: 28px;
}

.cinematic-seek {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 3px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  accent-color: #fff;
}

.cinematic-seek::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
  transition: transform 0.15s;
}

.cinematic-seek:hover::-webkit-slider-thumb {
  transform: scale(1.3);
}

.cinematic-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cinematic-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
  padding: 5px 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.cinematic-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.cinematic-skip {
  margin-left: auto;
  color: rgba(255, 255, 255, 0.6);
  font-size: 11px;
}

/* Transition */
.cinematic-enter-active { transition: opacity 0.3s, transform 0.3s; }
.cinematic-leave-active { transition: opacity 0.2s, transform 0.2s; }
.cinematic-enter-from   { opacity: 0; transform: translateY(10px); }
.cinematic-leave-to     { opacity: 0; transform: translateY(6px); }
</style>
