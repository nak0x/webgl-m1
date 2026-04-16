<!--
  DoorHud — HUD de la scène Porte interactive (FPS).
  Lit son état depuis useSceneManager().sceneState.
  Appelle world.lock() via getWorld() sur le clic canvas.
-->
<template>
  <!-- Bouton retour (visible uniquement quand pas en mode pointer-lock) -->
  <button v-if="!sceneState.locked" class="back-btn" @click="goToScene('start')">
    ← Retour
  </button>

  <!-- Overlay d'entrée -->
  <div v-if="!sceneState.locked" class="fps-overlay" @click="onEnterClick">
    <div class="fps-prompt">
      <p class="fps-prompt__title">Porte interactive</p>
      <p class="fps-prompt__hint">Cliquer pour entrer</p>
      <p class="fps-prompt__keys">ZQSD · Espace · E pour interagir · Échap pour sortir</p>
    </div>
  </div>

  <!-- Réticule -->
  <div
    v-if="sceneState.locked"
    class="crosshair"
    :class="{ 'crosshair--active': !!sceneState.prompt }"
  />

  <!-- Prompt d'action -->
  <Transition name="fade">
    <div v-if="sceneState.locked && sceneState.prompt" class="action-prompt">
      {{ sceneState.prompt }}
    </div>
  </Transition>

  <!-- Message feedback -->
  <Transition name="fade">
    <div v-if="sceneState.locked && sceneState.message" class="message-box">
      {{ sceneState.message }}
    </div>
  </Transition>
</template>

<script setup>
const { sceneState, goToScene, getWorld } = useSceneManager()

function onEnterClick() {
  getWorld()?.lock()
}
</script>

<style scoped>
/* ── Bouton retour ───────────────────────────────────────────── */
.back-btn {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  padding: 0.35rem 1rem;
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.78rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: color 0.2s, background 0.2s;
}
.back-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

/* ── Overlay d'entrée ────────────────────────────────────────── */
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

/* ── Réticule ────────────────────────────────────────────────── */
.crosshair {
  position: fixed;
  top: 50%; left: 50%;
  width: 6px; height: 6px;
  border: 1.5px solid rgba(255,255,255,0.7);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 50;
  transition: all 0.15s;
}
.crosshair--active {
  width: 10px; height: 10px;
  border-color: #fff;
  box-shadow: 0 0 8px rgba(255,255,255,0.5);
}

/* ── Prompt d'action ─────────────────────────────────────────── */
.action-prompt {
  position: fixed;
  bottom: 30%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.55);
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

/* ── Message feedback ────────────────────────────────────────── */
.message-box {
  position: fixed;
  bottom: 20%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,180,100,0.75);
  backdrop-filter: blur(6px);
  border-radius: 10px;
  padding: 0.6rem 1.4rem;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  pointer-events: none;
  z-index: 60;
}

/* ── Transitions ─────────────────────────────────────────────── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to       { opacity: 0; }
</style>
