<template>
  <Transition name="cinematic">
    <div v-if="active" class="cinematic-root">
      <div class="cinematic-bar">

        <button class="cinematic-icon-btn" @click="togglePause" :aria-label="isPaused ? 'Reprendre' : 'Pause'">
          <svg v-if="isPaused" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2.5l9 5.5-9 5.5z"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="2.5" y="2" width="4" height="12"/>
            <rect x="9.5" y="2" width="4" height="12"/>
          </svg>
        </button>

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

        <button class="cinematic-icon-btn cinematic-skip-btn" @click="skip" aria-label="Passer">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 2.5l8 5.5-8 5.5z"/>
            <rect x="12" y="2.5" width="2" height="11" rx="1"/>
          </svg>
        </button>

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

let _wasPaused = false
function onSeekStart() {
  _wasPaused = props.isPaused
  if (!props.isPaused) emit('pause')
}
function onSeekEnd(e) {
  emit('seek', parseFloat(e.target.value))
  if (!_wasPaused) emit('resume')
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
  padding: 0 0 24px;
  z-index: 600;
  pointer-events: none;
}

.cinematic-bar {
  pointer-events: all;
  width: min(680px, 88vw);
  background: #000;
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 8px;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.cinematic-icon-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  border-radius: 4px;
  transition: color 0.15s;
  padding: 0;
}

.cinematic-icon-btn:hover {
  color: #fff;
}

.cinematic-seek {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 3px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  accent-color: #fff;
}

.cinematic-seek::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
  transition: transform 0.15s;
}

.cinematic-seek:hover::-webkit-slider-thumb {
  transform: scale(1.35);
}

/* Transition */
.cinematic-enter-active { transition: opacity 0.3s, transform 0.3s; }
.cinematic-leave-active { transition: opacity 0.2s, transform 0.2s; }
.cinematic-enter-from   { opacity: 0; transform: translateY(10px); }
.cinematic-leave-to     { opacity: 0; transform: translateY(6px); }
</style>
