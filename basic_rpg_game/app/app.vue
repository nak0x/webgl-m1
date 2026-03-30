<template>
  <div id="game-root">
    <ThreeScene
      :started="started"
      @mode-change="onModeChange"
      @lens-toggle="onLensToggle"
    />

    <!-- Start Screen Overlay -->
    <Transition name="fade-out">
      <div v-if="!started" class="start-overlay" @click="onStart">
        <div class="start-content">
          <div class="start-title-group">
            <span class="start-title">solarpunk</span>
            <span class="start-subtitle">city walk</span>
          </div>
          <button id="start-button" class="start-button" @click.stop="onStart">
            Click to Start
          </button>
          <div class="start-hint">
            <span>WASD to move · Mouse to look around · 1 to toggle view</span>
          </div>
        </div>
      </div>
    </Transition>

    <!-- HUD Overlay (visible after start) -->
    <Transition name="fade-in">
      <div v-if="started" class="hud">
        <!-- Mode indicator -->
        <div class="hud-mode" :class="{ 'first-person': cameraMode === 'first' }">
          <div class="mode-dot" />
          <span>{{ cameraMode === 'first' ? 'First Person' : 'Third Person' }}</span>
        </div>

        <!-- Lens mode indicator -->
        <div v-if="lensEnabled" class="hud-lens">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5" />
            <circle cx="7" cy="7" r="2" fill="currentColor" />
          </svg>
          <span>Wide Lens</span>
        </div>

        <!-- Controls hint -->
        <div class="hud-controls">
          <div class="control-row">
            <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>
            <span class="control-label">Move</span>
          </div>
          <div class="control-row">
            <kbd>1</kbd>
            <span class="control-label">Toggle View</span>
          </div>
          <div class="control-row">
            <kbd>2</kbd>
            <span class="control-label">Wide Lens</span>
          </div>
        </div>

        <!-- Title -->
        <div class="hud-title">
          <span class="title-text">solarpunk</span>
          <span class="title-accent">city walk</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const started = ref(false)
const cameraMode = ref<string>('third')
const lensEnabled = ref(false)

const onStart = () => {
  started.value = true
  // Request pointer lock on the canvas for orbit controls
  const canvas = document.querySelector('canvas')
  if (canvas) {
    canvas.requestPointerLock()
  }
}

const onModeChange = (mode: string) => {
  cameraMode.value = mode
}

const onLensToggle = (enabled: boolean) => {
  lensEnabled.value = enabled
}
</script>

<style>
/* ── Reset ───────────────────────────────────────────── */
*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background: #f0ece4;
  -webkit-font-smoothing: antialiased;
}

#game-root {
  position: relative;
  width: 100vw;
  height: 100vh;
}

/* ── Start Overlay ───────────────────────────────────── */
.start-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(240, 236, 228, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  cursor: pointer;
}

.start-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  animation: startFadeIn 0.8s ease;
}

.start-title-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.start-title {
  font-size: 14px;
  font-weight: 300;
  color: rgba(138, 132, 125, 0.5);
  letter-spacing: 6px;
  text-transform: uppercase;
}

.start-subtitle {
  font-size: 48px;
  font-weight: 600;
  color: #88b87a;
  letter-spacing: 2px;
  text-transform: lowercase;
}

.start-button {
  padding: 14px 40px;
  background: rgba(136, 184, 122, 0.12);
  border: 1.5px solid rgba(136, 184, 122, 0.4);
  border-radius: 32px;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 500;
  color: #5a8a4c;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: all 0.3s ease;
  pointer-events: auto;
}

.start-button:hover {
  background: rgba(136, 184, 122, 0.22);
  border-color: rgba(136, 184, 122, 0.7);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(136, 184, 122, 0.15);
}

.start-button:active {
  transform: translateY(0);
}

.start-hint {
  font-size: 12px;
  font-weight: 400;
  color: rgba(138, 132, 125, 0.45);
  letter-spacing: 0.3px;
}

/* ── HUD Overlay ─────────────────────────────────────── */
.hud {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
}

/* ── Mode Indicator ──────────────────────────────────── */
.hud-mode {
  position: absolute;
  top: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(245, 242, 237, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(212, 207, 199, 0.5);
  border-radius: 24px;
  font-size: 12px;
  font-weight: 500;
  color: #6b6560;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  transition: all 0.3s ease;
}

.hud-mode.first-person {
  background: rgba(136, 184, 122, 0.15);
  border-color: rgba(136, 184, 122, 0.4);
  color: #5a8a4c;
}

.mode-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #b8b3aa;
  transition: background 0.3s ease;
}

.hud-mode.first-person .mode-dot {
  background: #88b87a;
  box-shadow: 0 0 6px rgba(136, 184, 122, 0.5);
}

/* ── Lens Mode Indicator ─────────────────────────────── */
.hud-lens {
  position: absolute;
  top: 68px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(136, 184, 122, 0.12);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(136, 184, 122, 0.3);
  border-radius: 24px;
  font-size: 11px;
  font-weight: 500;
  color: #5a8a4c;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  animation: fadeIn 0.3s ease;
}

/* ── Controls Hint ───────────────────────────────────── */
.hud-controls {
  position: absolute;
  bottom: 24px;
  left: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  background: rgba(245, 242, 237, 0.75);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(212, 207, 199, 0.5);
  border-radius: 6px;
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 600;
  color: #8a847d;
  line-height: 1;
}

.control-label {
  margin-left: 8px;
  font-size: 11px;
  font-weight: 400;
  color: rgba(138, 132, 125, 0.7);
  letter-spacing: 0.2px;
}

/* ── Title ───────────────────────────────────────────── */
.hud-title {
  position: absolute;
  top: 24px;
  left: 24px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.title-text {
  font-size: 14px;
  font-weight: 300;
  color: rgba(138, 132, 125, 0.6);
  letter-spacing: 3px;
  text-transform: uppercase;
}

.title-accent {
  font-size: 20px;
  font-weight: 600;
  color: #88b87a;
  letter-spacing: 1px;
  text-transform: lowercase;
}

/* ── Animations & Transitions ────────────────────────── */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes startFadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.fade-out-leave-active {
  transition: opacity 0.5s ease;
}
.fade-out-leave-to {
  opacity: 0;
}

.fade-in-enter-active {
  transition: opacity 0.5s ease 0.3s;
}
.fade-in-enter-from {
  opacity: 0;
}
</style>
