<template>
  <canvas ref="canvas" @click="onCanvasClick" />

  <UiAppNav />

  <!-- Overlay : invite à cliquer -->
  <div v-if="!locked" class="fps-overlay" @click="onCanvasClick">
    <div class="fps-prompt">
      <p class="fps-prompt__title">Interactions</p>
      <p class="fps-prompt__hint">Cliquer pour entrer</p>
      <p class="fps-prompt__keys">ZQSD — Espace — E pour interagir — Échap pour sortir</p>
    </div>
  </div>

  <!-- Réticule -->
  <div v-if="locked" class="crosshair" :class="{ 'crosshair--active': !!prompt }" />

  <!-- Prompt d'action (ex: "[E] Lire le panneau") -->
  <Transition name="fade">
    <div v-if="locked && prompt" class="action-prompt">
      {{ prompt }}
    </div>
  </Transition>

  <!-- Message overlay (texte, info…) -->
  <Transition name="fade">
    <div v-if="locked && message" class="message-box" @click="message = null">
      <pre class="message-box__text">{{ message }}</pre>
      <span class="message-box__dismiss">cliquer pour fermer</span>
    </div>
  </Transition>
</template>

<script setup>
import Experience      from '~/utils/three/Experience.js'
import InteractWorld   from '~/utils/three/world/InteractWorld.js'
import InteractSources from '~/utils/three/world/InteractSources.js'

const canvas  = useTemplateRef('canvas')
const locked  = ref(false)
const prompt  = ref(null)
const message = ref(null)

let experience = null
let world      = null

function onCanvasClick() {
  world?.lock()
}

onMounted(() => {
  experience = new Experience(canvas.value, InteractSources)

  world = new InteractWorld(experience, {
    onLockChange:   (state) => { locked.value = state },
    onPromptChange: (text)  => { prompt.value = text },
    onMessage:      (text)  => { message.value = text },
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
/* ── Overlay d'entrée ────────────────────────────────────── */
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

.fps-prompt { text-align: center; color: #fff; }

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

/* ── Réticule ────────────────────────────────────────────── */
.crosshair {
  position: fixed;
  top: 50%;
  left: 50%;
  width: 6px;
  height: 6px;
  border: 1.5px solid rgba(255, 255, 255, 0.7);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 50;
  transition: all 0.15s;
}

.crosshair--active {
  width: 10px;
  height: 10px;
  border-color: #fff;
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
}

/* ── Prompt d'action ─────────────────────────────────────── */
.action-prompt {
  position: fixed;
  bottom: 30%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 0.5rem 1.2rem;
  border-radius: 8px;
  pointer-events: none;
  z-index: 50;
}

/* ── Message box ─────────────────────────────────────────── */
.message-box {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 2rem 2.5rem;
  max-width: 440px;
  text-align: center;
  z-index: 60;
  cursor: pointer;
}

.message-box__text {
  color: #fff;
  font-family: inherit;
  font-size: 0.88rem;
  line-height: 1.6;
  white-space: pre-wrap;
  margin: 0 0 1rem;
}

.message-box__dismiss {
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.68rem;
  letter-spacing: 0.06em;
}

/* ── Transition fade ─────────────────────────────────────── */
.fade-enter-active,
.fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from,
.fade-leave-to     { opacity: 0; }
</style>
