<template>
  <Transition name="repair-popup">
    <div v-if="repair" class="repair-hud">

      <template v-if="vehicle">
        <div class="repair-hud__vehicle-row">
          <div class="repair-hud__car-icon">
            <img src="/images/Picto/Voiture.svg" alt="" aria-hidden="true" />
          </div>
          <div class="repair-hud__vehicle-info">
            <div v-if="priority" class="repair-hud__priority-badge" :class="`repair-hud__priority-badge--${priority}`">
              <span class="repair-hud__priority-dot" />
              {{ PRIORITY_LABELS[priority] ?? priority }}
            </div>
            <div class="repair-hud__vehicle-name">{{ vehicle.name }}</div>
          </div>
        </div>
        <div v-if="context" class="repair-hud__location">
          <img src="/images/Picto/Position.svg" class="repair-hud__location-icon" alt="" aria-hidden="true" />
          <span>{{ context }}</span>
        </div>
      </template>

      <p v-if="xrayActive" class="repair-hud__xray-label">Vue X-Ray activée</p>

      <div class="repair-hud__card-wrap">
        <div class="repair-hud__card" :class="`repair-hud__card--${repair.severity}`">
          <div class="repair-hud__card-body">
            <p class="repair-hud__name">{{ repair.name }}</p>
            <p class="repair-hud__desc">{{ repair.description }}</p>
          </div>

          <div v-if="xrayActive && (repair.repairable || repair.replaceable)" class="repair-hud__actions">
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
          <p v-else-if="!xrayActive" class="repair-hud__hint">Appuyez sur E pour activer le mode X-Ray</p>
        </div>

        <div class="repair-hud__accent-bar" :class="`repair-hud__accent-bar--${repair.severity}`">
          <img src="/images/Picto/Alerte.svg" class="repair-hud__alert-icon" alt="" aria-hidden="true" />
        </div>
      </div>

    </div>
  </Transition>
</template>

<script setup>
const PRIORITY_LABELS = {
  urgent: 'Très urgent',
  high:   'Prioritaire',
  normal: 'Normal',
  low:    'Faible priorité',
}

defineProps({
  repair:     { type: Object,  default: null },
  xrayActive: { type: Boolean, default: false },
  vehicle:    { type: Object,  default: null },
  priority:   { type: String,  default: '' },
  context:    { type: String,  default: '' },
})
defineEmits(['confirm'])
</script>

<style scoped>
.repair-hud {
  position: fixed;
  left: 24px;
  top: 80px;
  width: 280px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: all;
  z-index: 400;
  font-family: 'Fira Sans', system-ui, sans-serif;
}

/* ── Vehicle header ── */

.repair-hud__vehicle-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.repair-hud__car-icon {
  width: 50px;
  height: 50px;
  background: #2d1d1b;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.repair-hud__car-icon img {
  width: 32px;
  height: 32px;
  display: block;
  filter: invert(1) brightness(1.5) sepia(0.3) saturate(0.2);
}

.repair-hud__vehicle-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.repair-hud__priority-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 8px;
  font-size: 16px;
  font-weight: 400;
  line-height: 15px;
}

.repair-hud__priority-badge--urgent { background: #efaa9d; color: #f23b1b; }
.repair-hud__priority-badge--high   { background: #f2bfb3; color: #ff6038; }
.repair-hud__priority-badge--normal { background: #e2f9f9; color: #46b2b2; }
.repair-hud__priority-badge--low    { background: #e2f9f9; color: #8eb8b8; }

.repair-hud__priority-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.repair-hud__vehicle-name {
  font-size: 14px;
  font-weight: 400;
  line-height: 16px;
  color: rgba(45, 29, 27, 0.75);
}

/* ── Location ── */

.repair-hud__location {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 400;
  line-height: 16.5px;
  color: rgba(45, 29, 27, 0.54);
  text-decoration: underline;
  text-underline-position: under;
}

.repair-hud__location-icon {
  width: 12px;
  height: 17px;
  display: block;
  flex-shrink: 0;
  transform: scaleY(-1);
  opacity: 0.54;
}

/* ── X-Ray label ── */

.repair-hud__xray-label {
  font-size: 18px;
  font-weight: 500;
  line-height: 20px;
  color: #2d1d1b;
  margin: 0;
}

/* ── Alert card ── */

.repair-hud__card-wrap {
  display: flex;
  align-items: stretch;
}

.repair-hud__card {
  backdrop-filter: blur(5px);
  background: rgba(255, 255, 255, 0.44);
  border-top: 1px solid var(--sev-border, #e02e0e);
  border-bottom: 1px solid var(--sev-border, #e02e0e);
  border-left: 1px solid var(--sev-border, #e02e0e);
  border-right: none;
  padding: 13px 20px 13px 19px;
  display: flex;
  flex-direction: column;
  gap: 15px;
  flex: 1;
}

.repair-hud__card--critique  { --sev-border: #e02e0e; }
.repair-hud__card--endommage { --sev-border: #ff6038; }
.repair-hud__card--use       { --sev-border: #8eb8b8; }
.repair-hud__card--bon       { --sev-border: #46b2b2; }

.repair-hud__card-body {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.repair-hud__name {
  font-size: 18px;
  font-weight: 500;
  line-height: 20px;
  color: #2d1d1b;
  margin: 0;
  text-align: right;
  text-transform: uppercase;
}

.repair-hud__desc {
  font-size: 16px;
  font-weight: 400;
  line-height: 16px;
  color: rgba(45, 29, 27, 0.75);
  margin: 0;
  text-align: right;
}

/* ── Accent bar (right side) ── */

.repair-hud__accent-bar {
  width: 46px;
  min-height: 140px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 18px;
  flex-shrink: 0;
}

.repair-hud__accent-bar--critique  { background: #e02e0e; }
.repair-hud__accent-bar--endommage { background: #ff6038; }
.repair-hud__accent-bar--use       { background: #8eb8b8; }
.repair-hud__accent-bar--bon       { background: #46b2b2; }

.repair-hud__alert-icon {
  width: 30px;
  height: 30px;
  display: block;
  filter: invert(1);
}

/* ── Actions / Hint ── */

.repair-hud__actions {
  display: flex;
  gap: 8px;
}

.repair-hud__btn {
  flex: 1;
  padding: 8px 0;
  border: none;
  font-family: 'Fira Sans', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 500;
  line-height: 15px;
  cursor: pointer;
  transition: filter 0.15s;
}
.repair-hud__btn:hover { filter: brightness(0.9); }

.repair-hud__btn--repair  { background: #2d1d1b; color: #efeadf; }
.repair-hud__btn--replace { background: #ff6038; color: #2d1d1b; }

.repair-hud__hint {
  font-size: 12px;
  font-weight: 400;
  line-height: 15px;
  color: rgba(45, 29, 27, 0.54);
  margin: 0;
  text-align: right;
}

/* ── Transition ── */

.repair-popup-enter-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.repair-popup-leave-active { transition: opacity 0.2s ease; }
.repair-popup-enter-from   { opacity: 0; transform: translateX(-8px); }
.repair-popup-leave-to     { opacity: 0; }
</style>
