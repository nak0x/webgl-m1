<template>
  <canvas ref="canvas" />

  <!-- Click-to-start overlay (FPV mode only, when pointer not locked) -->
  <div v-if="cameraMode === 'fpv' && !isLocked" class="fpv-overlay" @click="requestLock">
    <div class="fpv-overlay__content">
      <h2>NPC City</h2>
      <p>Click to explore</p>
      <span class="fpv-overlay__hint">WASD to move · Mouse to look · ESC to release · V to toggle camera</span>
    </div>
  </div>

  <!-- Crosshair (FPV mode only, when locked) -->
  <div v-if="cameraMode === 'fpv' && isLocked" class="fpv-crosshair" />

  <!-- Camera mode badge -->
  <div class="camera-badge" @click="toggleCamera">
    <span class="camera-badge__icon">{{ cameraMode === 'fpv' ? '👁' : '🌐' }}</span>
    <span class="camera-badge__label">{{ cameraMode === 'fpv' ? 'FPV' : 'Orbit' }}</span>
    <span class="camera-badge__hint">V</span>
  </div>

  <!-- Controls hint (orbit mode) -->
  <div v-if="cameraMode === 'orbit'" class="orbit-hint">
    Left-click drag to orbit · Scroll to zoom · Right-click drag to pan · V for FPV
  </div>
</template>

<script setup>
import Experience  from '~/utils/three/Experience.js'
import CityWorld   from '~/utils/three/world/CityWorld.js'
import citySources from '~/utils/three/world/citySources.js'

const canvas     = useTemplateRef('canvas')
const isLocked   = ref(false)
const cameraMode = ref('fpv')

let experience = null
let world      = null

const requestLock = () => {
  canvas.value?.click()
}

const toggleCamera = () => {
  world?.toggleCamera()
}

onMounted(() => {
  experience = new Experience(canvas.value, citySources)
  world = new CityWorld(experience, {
    onPointerLock:  (val) => { isLocked.value = val },
    onCameraChange: (mode) => { cameraMode.value = mode },
  })
  experience.setWorld(world)
})

onUnmounted(() => {
  experience?.dispose()
  experience = null
  world = null
})
</script>

<style scoped>
.fpv-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 100;
  cursor: pointer;
}

.fpv-overlay__content {
  text-align: center;
  color: #fff;
  font-family: 'Inter', system-ui, sans-serif;
}

.fpv-overlay__content h2 {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  letter-spacing: -0.02em;
}

.fpv-overlay__content p {
  font-size: 1.2rem;
  opacity: 0.8;
  margin-bottom: 1rem;
}

.fpv-overlay__hint {
  font-size: 0.85rem;
  opacity: 0.5;
  display: block;
}

.fpv-crosshair {
  position: fixed;
  top: 50%;
  left: 50%;
  width: 12px;
  height: 12px;
  margin: -6px 0 0 -6px;
  border: 2px solid rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  pointer-events: none;
  z-index: 50;
}

/* Camera toggle badge */
.camera-badge {
  position: fixed;
  top: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  color: #fff;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.85rem;
  cursor: pointer;
  user-select: none;
  z-index: 90;
  transition: background 0.2s, transform 0.15s;
}

.camera-badge:hover {
  background: rgba(0, 0, 0, 0.7);
  transform: scale(1.04);
}

.camera-badge__icon {
  font-size: 1.1rem;
}

.camera-badge__label {
  font-weight: 600;
  letter-spacing: 0.03em;
}

.camera-badge__hint {
  font-size: 0.7rem;
  opacity: 0.4;
  padding: 1px 5px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

/* Orbit mode hint */
.orbit-hint {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 18px;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(6px);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.8rem;
  pointer-events: none;
  z-index: 90;
}
</style>
