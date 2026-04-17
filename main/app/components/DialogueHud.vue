<template>
  <Transition name="dialogue">
    <div v-if="active" class="dialogue-root">
      <div class="dialogue-box">

        <!-- Speaker -->
        <p class="dialogue-speaker">{{ current?.speaker }}</p>

        <!-- Text -->
        <p class="dialogue-text">{{ current?.text }}</p>

        <!-- Footer -->
        <div class="dialogue-footer">
          <span class="dialogue-dots">
            <span
              v-for="i in total"
              :key="i"
              class="dot"
              :class="{ 'dot--active': i - 1 === index }"
            />
          </span>
          <button class="dialogue-btn" @click="next">
            {{ isLast ? 'Terminer' : 'Suivant' }}
            <span class="dialogue-key">[ Espace ]</span>
          </button>
        </div>

      </div>
    </div>
  </Transition>
</template>

<script setup>
const props = defineProps({
  active:  { type: Boolean, required: true },
  current: { type: Object,  default: null  },
  index:   { type: Number,  default: 0     },
  total:   { type: Number,  default: 0     },
  isLast:  { type: Boolean, default: false },
})

const emit = defineEmits(['next'])

function next() {
  emit('next')
}

// Espace / Entrée pour avancer
function onKey(e) {
  if (!props.active) return
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault()
    next()
  }
}

onMounted(()  => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.dialogue-root {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  padding: 0 0 40px;
  z-index: 500;
  pointer-events: none;
}

.dialogue-box {
  pointer-events: all;
  width: min(680px, 90vw);
  background: rgba(8, 8, 12, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 20px 24px 16px;
  backdrop-filter: blur(8px);
}

.dialogue-speaker {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #88aaff;
  margin-bottom: 10px;
}

.dialogue-text {
  font-size: 15px;
  line-height: 1.65;
  color: #e8e8e8;
  min-height: 48px;
}

.dialogue-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
}

.dialogue-dots {
  display: flex;
  gap: 5px;
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  transition: background 0.2s;
}

.dot--active {
  background: #fff;
}

.dialogue-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  padding: 6px 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.dialogue-btn:hover {
  background: rgba(255,255,255,0.14);
}

.dialogue-key {
  font-size: 10px;
  color: rgba(255,255,255,0.4);
}

/* Transition */
.dialogue-enter-active { transition: opacity 0.2s, transform 0.2s; }
.dialogue-leave-active { transition: opacity 0.15s, transform 0.15s; }
.dialogue-enter-from   { opacity: 0; transform: translateY(12px); }
.dialogue-leave-to     { opacity: 0; transform: translateY(8px); }
</style>
