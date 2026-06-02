<template>
  <Transition name="cinematic">
    <div v-if="active" class="cinematic-root">
      <div class="cinematic-bar">

        <button class="cinematic-btn" @click="togglePause" :aria-label="isPaused ? 'Reprendre' : 'Pause'">
          <svg v-if="isPaused" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21"/>
          </svg>
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <rect x="5" y="3" width="4" height="18" rx="1"/>
            <rect x="15" y="3" width="4" height="18" rx="1"/>
          </svg>
        </button>

        <div class="cinematic-track">
          <div class="cinematic-fill" :style="{ width: fillPct + '%' }" />
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
        </div>

        <button class="cinematic-btn" @click="skip" aria-label="Passer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 17,12 5,21"/>
            <rect x="18" y="3" width="3" height="18" rx="1"/>
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

const fillPct = computed(() =>
  props.duration > 0 ? (props.currentTime / props.duration) * 100 : 0
)

function togglePause() {
  props.isPaused ? emit('resume') : emit('pause')
}

function skip() { emit('skip') }

function onSeek(e) { emit('seek', parseFloat(e.target.value)) }

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
  background: var(--color-black);
  box-shadow: 0 0 5px rgba(142, 184, 184, 0.75);
  padding: 12px 24px;
  display: flex;
  align-items: center;
  gap: 24px;
}

/* ── Boutons icône ── */

.cinematic-btn {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--color-white);
  cursor: pointer;
  border-radius: 50%;
  transition: opacity 0.15s;
  padding: 0;
}

.cinematic-btn:hover { opacity: 0.75; }

/* ── Barre de progression ── */

.cinematic-track {
  flex: 1 0 0;
  position: relative;
  height: 6px;
  background: rgba(255, 96, 56, 0.25);
  min-width: 1px;
}

.cinematic-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 6px;
  background: var(--color-orange);
  pointer-events: none;
  transition: width 0.1s linear;
}

.cinematic-seek {
  position: absolute;
  inset: -10px 0;
  width: 100%;
  height: 26px;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  outline: none;
  cursor: pointer;
  margin: 0;
}

.cinematic-seek::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 0;
  height: 0;
}

.cinematic-seek::-moz-range-thumb {
  width: 0;
  height: 0;
  border: none;
  background: transparent;
}

/* ── Transition ── */
.cinematic-enter-active { transition: opacity 0.3s, transform 0.3s; }
.cinematic-leave-active { transition: opacity 0.2s, transform 0.2s; }
.cinematic-enter-from   { opacity: 0; transform: translateY(10px); }
.cinematic-leave-to     { opacity: 0; transform: translateY(6px); }
</style>
