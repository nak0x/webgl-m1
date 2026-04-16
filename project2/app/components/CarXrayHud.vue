<!--
  CarXrayHud — HUD de la scène Car X-Ray.
  Lit son état depuis useSceneManager().sceneState.
  Appelle les méthodes du World via getWorld().
-->
<template>
  <!-- Bouton retour -->
  <button class="back-btn" @click="goToScene('start')">← Retour</button>

  <!-- Tooltip hover -->
  <div v-if="sceneState.hoveredPart" class="xray-tooltip">
    {{ sceneState.hoveredPart }}
  </div>

  <!-- Panel diagnostic (droite) -->
  <aside class="xray-panel xray-panel--right">
    <h2 class="xray-panel__title">Diagnostic X-Ray</h2>

    <div
      v-for="part in sceneState.parts"
      :key="part.name"
      class="xray-part"
      :class="{ 'xray-part--hovered': sceneState.hoveredPart === part.name }"
    >
      <span class="xray-part__name">{{ part.name }}</span>
      <div class="xray-part__levels">
        <button
          v-for="level in damageLevels"
          :key="level"
          class="xray-btn"
          :class="[`xray-btn--${level}`, { 'xray-btn--active': part.damageLevel === level }]"
          @click="setDamage(part.name, level)"
        >
          {{ levelLabels[level] }}
        </button>
      </div>
    </div>
  </aside>

  <!-- Panel debug shader (gauche) -->
  <aside class="xray-panel xray-panel--left">
    <button class="xray-panel__toggle" @click="debugOpen = !debugOpen">
      <span>Shader Debug</span>
      <span class="xray-panel__chevron" :class="{ 'xray-panel__chevron--open': debugOpen }">▾</span>
    </button>

    <div v-if="debugOpen" class="xray-debug">
      <div v-for="ctrl in shaderControls" :key="ctrl.key" class="xray-slider">
        <div class="xray-slider__header">
          <label class="xray-slider__label">{{ ctrl.label }}</label>
          <span class="xray-slider__value">{{ sceneState.shader[ctrl.key].toFixed(2) }}</span>
        </div>
        <input
          type="range"
          :min="ctrl.min"
          :max="ctrl.max"
          :step="ctrl.step"
          :value="sceneState.shader[ctrl.key]"
          class="xray-range"
          @input="onShaderInput(ctrl.key, $event)"
        />
        <div class="xray-slider__bounds">
          <span>{{ ctrl.min }}</span>
          <span>{{ ctrl.max }}</span>
        </div>
      </div>

      <button class="xray-reset" @click="resetShader">Réinitialiser</button>
    </div>
  </aside>
</template>

<script setup>
import { DAMAGE_LEVELS } from '~/utils/three/world/CarXrayWorld.js'
import { XRAY_DEFAULTS } from '~/utils/three/materials/createXray.js'

const { sceneState, goToScene, getWorld } = useSceneManager()

const debugOpen    = ref(false)
const damageLevels = DAMAGE_LEVELS

const levelLabels = {
  bon:       'Bon',
  use:       'Usé',
  endommage: 'Endom.',
  critique:  'Critique',
}

const shaderControls = [
  { key: 'bodyOpacity', label: 'Fill Opacity', min: 0,  max: 0.5, step: 0.005 },
  { key: 'edgeOpacity', label: 'Edge Opacity', min: 0,  max: 1.0, step: 0.01  },
  { key: 'edgeBoost',   label: 'Edge Boost',   min: 1,  max: 20,  step: 0.5   },
  { key: 'fresnel',     label: 'Fresnel',       min: 0,  max: 1.0, step: 0.01  },
]

function setDamage(partName, level) {
  getWorld()?.setPartDamage(partName, level)
  const part = sceneState.parts.find(p => p.name === partName)
  if (part) part.damageLevel = level
}

function onShaderInput(key, e) {
  sceneState.shader[key] = parseFloat(e.target.value)
  getWorld()?.setShaderParams(sceneState.shader)
}

function resetShader() {
  Object.assign(sceneState.shader, XRAY_DEFAULTS)
  getWorld()?.setShaderParams(sceneState.shader)
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

/* ── Tooltip ─────────────────────────────────────────────────── */
.xray-tooltip {
  position: fixed;
  top: 5rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 255, 136, 0.12);
  border: 1px solid rgba(0, 255, 136, 0.3);
  color: #00ff88;
  padding: 0.4rem 1rem;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  pointer-events: none;
  z-index: 50;
}

/* ── Panels ──────────────────────────────────────────────────── */
.xray-panel {
  position: fixed;
  top: 4rem;
  width: 250px;
  max-height: calc(100vh - 5rem);
  overflow-y: auto;
  background: rgba(5, 5, 16, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 0.85rem;
  z-index: 80;
}

.xray-panel--right { right: 1rem; }
.xray-panel--left  { left:  1rem; }

.xray-panel__title {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 0.75rem;
}

/* ── Toggle debug ────────────────────────────────────────────── */
.xray-panel__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
  padding: 0;
}
.xray-panel__toggle:hover { color: rgba(255, 255, 255, 0.7); }
.xray-panel__chevron { display: inline-block; transition: transform 0.2s; }
.xray-panel__chevron--open { transform: rotate(180deg); }

/* ── Debug sliders ───────────────────────────────────────────── */
.xray-debug {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}
.xray-slider__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.2rem;
}
.xray-slider__label { font-size: 0.72rem; color: rgba(255,255,255,0.65); font-weight: 500; }
.xray-slider__value { font-size: 0.7rem; font-variant-numeric: tabular-nums; color: #00ff88; font-weight: 600; }
.xray-range {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 3px;
  background: rgba(255,255,255,0.12);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}
.xray-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px; height: 12px;
  border-radius: 50%;
  background: #00ff88;
  box-shadow: 0 0 6px rgba(0,255,136,0.6);
  cursor: pointer;
}
.xray-range::-moz-range-thumb {
  width: 12px; height: 12px;
  border-radius: 50%;
  background: #00ff88;
  box-shadow: 0 0 6px rgba(0,255,136,0.6);
  border: none;
  cursor: pointer;
}
.xray-slider__bounds {
  display: flex;
  justify-content: space-between;
  font-size: 0.6rem;
  color: rgba(255,255,255,0.2);
  margin-top: 0.15rem;
}
.xray-reset {
  margin-top: 0.2rem;
  width: 100%;
  padding: 0.35rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  color: rgba(255,255,255,0.45);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s;
}
.xray-reset:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); }

/* ── Pièces ──────────────────────────────────────────────────── */
.xray-part {
  margin-bottom: 0.5rem;
  padding: 0.45rem;
  border-radius: 8px;
  border: 1px solid transparent;
  transition: border-color 0.2s, background 0.2s;
}
.xray-part--hovered {
  border-color: rgba(0, 255, 136, 0.3);
  background: rgba(0, 255, 136, 0.04);
}
.xray-part__name {
  display: block;
  font-size: 0.74rem;
  font-weight: 600;
  color: rgba(255,255,255,0.8);
  margin-bottom: 0.3rem;
}
.xray-part__levels { display: flex; gap: 0.2rem; }

/* ── Boutons état ────────────────────────────────────────────── */
.xray-btn {
  flex: 1;
  padding: 0.22rem 0;
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 5px;
  background: transparent;
  color: rgba(255,255,255,0.4);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.xray-btn:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.7); }
.xray-btn--active.xray-btn--bon       { background: rgba(0,255,136,0.15); border-color: #00ff88; color: #00ff88; }
.xray-btn--active.xray-btn--use       { background: rgba(255,204,0,0.15); border-color: #ffcc00; color: #ffcc00; }
.xray-btn--active.xray-btn--endommage { background: rgba(255,102,0,0.15); border-color: #ff6600; color: #ff6600; }
.xray-btn--active.xray-btn--critique  { background: rgba(255,0,68,0.15);  border-color: #ff0044; color: #ff0044; }
</style>
