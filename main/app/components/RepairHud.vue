<template>
  <Transition name="repair-popup">
    <div v-if="repair" class="repair-hud" :class="`repair-hud--${repair.severity}`">

      <div class="repair-hud__header">
        <span class="repair-hud__badge" :class="`repair-hud__badge--${repair.severity}`">
          {{ SEVERITY_LABELS[repair.severity] }}
        </span>
        <span v-if="xrayActive" class="repair-hud__xray-tag">Vue X-Ray activée</span>
      </div>

      <div class="repair-hud__name">{{ repair.name }}</div>
      <p class="repair-hud__desc">{{ repair.description }}</p>

      <div v-if="repair.pieces.length" class="repair-hud__pieces">
        <div
          v-for="piece in repair.pieces"
          :key="piece.mesh"
          class="repair-hud__piece"
        >
          {{ piece.name }}
        </div>
      </div>

      <div class="repair-hud__hint">Appuyez sur E pour activer le mode X-Ray</div>

      <div v-if="xrayActive" class="repair-hud__actions">
        <button
          v-if="repair.repairable"
          class="repair-hud__btn repair-hud__btn--repair"
          @click="$emit('confirm', repair.id, 'repair')"
        >
          Réparer
        </button>
        <button
          v-if="repair.replaceable"
          class="repair-hud__btn repair-hud__btn--replace"
          @click="$emit('confirm', repair.id, 'replace')"
        >
          Remplacer
        </button>
      </div>

    </div>
  </Transition>
</template>

<script setup>
const SEVERITY_LABELS = {
  bon:       'Bon état',
  use:       'Usé',
  endommage: 'Endommagé',
  critique:  'Critique',
}

defineProps({
  repair:    { type: Object, default: null },
  xrayActive: { type: Boolean, default: false },
})
defineEmits(['confirm'])
</script>

<style scoped>
.repair-hud {
  position: fixed;
  left: 24px;
  top: 50%;
  transform: translateY(-50%);
  width: 280px;
  background: rgba(10, 10, 20, 0.88);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  padding: 18px 20px;
  pointer-events: all;
  z-index: 400;
  border-left: 3px solid var(--severity-color, #fff);
}

.repair-hud--bon       { --severity-color: #00ff88; }
.repair-hud--use       { --severity-color: #ffcc00; }
.repair-hud--endommage { --severity-color: #ff6600; }
.repair-hud--critique  { --severity-color: #ff0044; }

.repair-hud__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.repair-hud__badge {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 3px;
  color: #000;
}
.repair-hud__badge--bon       { background: #00ff88; }
.repair-hud__badge--use       { background: #ffcc00; }
.repair-hud__badge--endommage { background: #ff6600; color: #fff; }
.repair-hud__badge--critique  { background: #ff0044; color: #fff; }

.repair-hud__xray-tag {
  font-size: 0.6rem;
  font-weight: 600;
  color: #80aaff;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.repair-hud__name {
  font-size: 0.92rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 8px;
  line-height: 1.3;
}

.repair-hud__desc {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.72);
  line-height: 1.55;
  margin: 0 0 12px;
}

.repair-hud__pieces {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.repair-hud__piece {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
  padding-left: 10px;
  position: relative;
}
.repair-hud__piece::before {
  content: '›';
  position: absolute;
  left: 0;
  color: var(--severity-color, #fff);
}

.repair-hud__hint {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.3);
  letter-spacing: 0.04em;
  margin-bottom: 14px;
}

.repair-hud__actions {
  display: flex;
  gap: 8px;
}

.repair-hud__btn {
  flex: 1;
  padding: 8px 0;
  border: none;
  border-radius: 5px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  transition: filter 0.15s;
}
.repair-hud__btn:hover { filter: brightness(1.15); }

.repair-hud__btn--repair  { background: #00cc66; color: #000; }
.repair-hud__btn--replace { background: #0077ff; color: #fff; }

.repair-popup-enter-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.repair-popup-leave-active { transition: opacity 0.2s ease; }
.repair-popup-enter-from   { opacity: 0; transform: translateY(calc(-50% + 8px)); }
.repair-popup-leave-to     { opacity: 0; }
</style>
