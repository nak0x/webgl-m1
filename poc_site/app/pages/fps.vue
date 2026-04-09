<template>
  <canvas ref="canvas" @click="onCanvasClick" />

  <UiAppNav />

  <!-- Overlay : invite à cliquer -->
  <div v-if="!locked" class="fps-overlay" @click="onCanvasClick">
    <div class="fps-prompt">
      <p class="fps-prompt__title">First Person</p>
      <p class="fps-prompt__hint">Cliquer pour entrer</p>
      <p class="fps-prompt__keys">ZQSD / WASD — Espace pour sauter — Échap pour sortir</p>
    </div>
  </div>

  <!-- Réticule -->
  <div v-if="locked" class="fps-crosshair" />
</template>

<script setup>
import Experience  from '~/utils/three/Experience.js'
import FpsWorld    from '~/utils/three/world/FpsWorld.js'
import FpsSources  from '~/utils/three/world/FpsSources.js'

const canvas = useTemplateRef('canvas')
const locked = ref(false)

let experience = null
let world      = null

function onCanvasClick() {
  world?.lock()
}

onMounted(() => {
  experience = new Experience(canvas.value, FpsSources)

  world = new FpsWorld(experience, {
    onLockChange: (state) => { locked.value = state },
  })

  experience.setWorld(world)
})

onUnmounted(() => {
  experience?.dispose()
  experience = null
  world      = null
})
</script>

<style scoped>
.fps-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
  z-index: 50;
  cursor: pointer;
}

.fps-prompt {
  text-align: center;
  color: #fff;
}

.fps-prompt__title {
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  margin-bottom: 0.5rem;
}

.fps-prompt__hint {
  font-size: 0.9rem;
  opacity: 0.7;
  margin-bottom: 1rem;
}

.fps-prompt__keys {
  font-size: 0.72rem;
  opacity: 0.4;
  letter-spacing: 0.04em;
}

.fps-crosshair {
  position: fixed;
  top: 50%;
  left: 50%;
  width: 2px;
  height: 2px;
  background: #fff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 4px rgba(255, 255, 255, 0.6);
  pointer-events: none;
  z-index: 50;
}
</style>
