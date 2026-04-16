<template>
  <!-- Canvas unique, persistant entre toutes les scènes -->
  <canvas ref="canvas" />

  <!-- StartScreen -->
  <StartScreen v-if="currentScene === 'start'" />

  <!-- HUDs de scènes -->
  <CinematicHud v-else-if="currentScene === 'cinematic'" />
  <CarXrayHud   v-else-if="currentScene === 'carXray'"   />
  <DoorHud      v-else-if="currentScene === 'door'"      />

  <!-- Loading overlay -->
  <Transition name="fade">
    <div v-if="isLoading && !isTransitioning" class="loading-overlay">
      <span class="loading-dot" />
    </div>
  </Transition>

  <!-- Fade de transition entre scènes -->
  <div class="scene-fade" :class="{ 'scene-fade--active': isTransitioning }" />
</template>

<script setup>
import Experience from '~/utils/three/Experience.js'

const canvas = useTemplateRef('canvas')
const { currentScene, isLoading, isTransitioning, init } = useSceneManager()

let experience = null

onMounted(() => {
  experience = new Experience(canvas.value, [])
  init(experience)
})

onUnmounted(() => {
  experience?.dispose()
  experience = null
})
</script>

<style>
/* ── Loading ─────────────────────────────────────────────────── */
.loading-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 200;
}

.loading-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fff;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.2; transform: scale(0.8); }
  50%       { opacity: 1;   transform: scale(1.2); }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from,   .fade-leave-to     { opacity: 0; }

/* ── Transition de scène ─────────────────────────────────────── */
.scene-fade {
  position: fixed;
  inset: 0;
  background: #000;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.4s ease;
  z-index: 500;
}
.scene-fade--active {
  opacity: 1;
  pointer-events: all;
}
</style>
