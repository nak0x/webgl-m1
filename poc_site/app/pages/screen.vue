<template>
  <canvas ref="canvas" />

  <UiAppNav />

  <!-- Hint de démarrage -->
  <Transition name="fade">
    <div v-if="showHint" class="screen-hint">
      <span class="screen-hint__dot" />
      Cliquez sur l'écran 3D pour interagir
    </div>
  </Transition>

  <!-- Toast item cliqué -->
  <Transition name="slide-up">
    <div v-if="lastItem" class="item-toast">
      <span class="item-toast__label">{{ lastItem }}</span>
    </div>
  </Transition>
</template>

<script setup>
import Experience    from '~/utils/three/Experience.js'
import ScreenWorld   from '~/utils/three/world/ScreenWorld.js'
import ScreenSources from '~/utils/three/world/ScreenSources.js'

const canvas   = useTemplateRef('canvas')
const showHint = ref(true)
const lastItem = ref(null)

let experience   = null
let toastTimeout = null

onMounted(() => {
  experience = new Experience(canvas.value, ScreenSources)

  const world = new ScreenWorld(experience, {
    onItemClick: (label) => {
      showHint.value = false
      lastItem.value = label
      clearTimeout(toastTimeout)
      toastTimeout = setTimeout(() => { lastItem.value = null }, 2500)
    },
    onClose: () => {
      lastItem.value = null
    },
    onCardClose: () => {
      lastItem.value = null
    },
  })

  experience.setWorld(world)
})

onUnmounted(() => {
  clearTimeout(toastTimeout)
  experience?.dispose()
  experience = null
})
</script>

<style scoped>
/* ── Hint ─────────────────────────────────────────────────── */
.screen-hint {
  position: fixed;
  bottom: 2.5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  pointer-events: none;
  z-index: 10;
}

.screen-hint__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #4a80f5;
  animation: dot-pulse 1.8s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes dot-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.35; transform: scale(0.65); }
}

/* ── Toast ────────────────────────────────────────────────── */
.item-toast {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  background: rgba(8, 10, 28, 0.9);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(80, 120, 255, 0.3);
  border-radius: 12px;
  padding: 0.65rem 1.3rem;
  z-index: 10;
}

.item-toast__label {
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

/* ── Transitions ──────────────────────────────────────────── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.4s ease; }
.fade-enter-from, .fade-leave-to       { opacity: 0; }

.slide-up-enter-active, .slide-up-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.slide-up-enter-from, .slide-up-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
