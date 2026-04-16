<!--
  CinematicHud — HUD de la scène cinématique.
  Affiche la caméra active et un bouton pour passer la cinématique.
-->
<template>
  <div class="cam-badge">
    CAM · {{ sceneState.cameraName ?? '—' }}
  </div>

  <button class="skip-btn" @click="goToScene('start')">
    Passer ›
  </button>
</template>

<script setup>
const { sceneState, goToScene } = useSceneManager()
</script>

<style scoped>
.cam-badge {
  position: fixed;
  bottom: 1.5rem;
  left: 1.5rem;
  z-index: 80;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.35);
  pointer-events: none;
}

.skip-btn {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 80;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  padding: 0.35rem 1rem;
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.78rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: color 0.2s, background 0.2s;
}

.skip-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}
</style>
