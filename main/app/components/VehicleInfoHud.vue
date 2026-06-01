<template>
  <Transition name="vehicle-panel">
    <div v-if="vehicle" class="vehicle-hud">

      <div class="vehicle-hud__top">
        <div class="vehicle-hud__name">{{ vehicle.name }}</div>
        <span class="vehicle-hud__priority" :class="`vehicle-hud__priority--${meta?.priority}`">
          {{ PRIORITY_LABELS[meta?.priority] ?? meta?.priority }}
        </span>
      </div>

      <div class="vehicle-hud__fuel">
        <span class="vehicle-hud__fuel-icon">{{ FUEL_ICONS[vehicle.fuel_type] ?? '⛽' }}</span>
        <div class="vehicle-hud__fuel-bar-wrap">
          <div class="vehicle-hud__fuel-bar" :style="{ width: vehicle.fuel_level + '%' }" />
        </div>
        <span class="vehicle-hud__fuel-value">{{ vehicle.fuel_level }} L</span>
      </div>

      <div class="vehicle-hud__sep" />

      <div v-if="meta?.repair_delay_days" class="vehicle-hud__delay">
        <span class="vehicle-hud__delay-icon">⧖</span>
        <span>{{ meta.repair_delay_days }} jour{{ meta.repair_delay_days > 1 ? 's' : '' }}</span>
        <span class="vehicle-hud__delay-label">délai estimé</span>
      </div>

      <table class="vehicle-hud__table">
        <tr>
          <td class="vehicle-hud__key">Année</td>
          <td class="vehicle-hud__val">{{ vehicle.year }}</td>
        </tr>
        <tr>
          <td class="vehicle-hud__key">Immatriculation</td>
          <td class="vehicle-hud__val">{{ vehicle.immatriculation }}</td>
        </tr>
        <tr>
          <td class="vehicle-hud__key">KM</td>
          <td class="vehicle-hud__val">{{ vehicle.km.toLocaleString('fr-FR') }}</td>
        </tr>
      </table>

      <template v-if="meta?.available_parts?.length">
        <div class="vehicle-hud__sep" />
        <div class="vehicle-hud__section-title">Pièces disponibles</div>
        <div
          v-for="part in meta.available_parts"
          :key="part.id"
          class="vehicle-hud__part"
        >
          <span class="vehicle-hud__part-name">{{ part.name }}</span>
          <span
            class="vehicle-hud__part-status"
            :class="part.available ? 'vehicle-hud__part-status--ok' : 'vehicle-hud__part-status--ko'"
          >
            {{ part.available ? 'Disponible' : `Livraison ${part.delivery_days}j` }}
          </span>
        </div>
      </template>

      <template v-if="meta?.repair_history?.length">
        <div class="vehicle-hud__sep" />
        <div class="vehicle-hud__section-title">Historique</div>
        <div
          v-for="(entry, i) in meta.repair_history"
          :key="i"
          class="vehicle-hud__history-row"
        >
          <span class="vehicle-hud__history-date">{{ entry.date }}</span>
          <span class="vehicle-hud__history-type">{{ entry.type }}</span>
          <span
            class="vehicle-hud__history-dot"
            :class="`vehicle-hud__history-dot--${entry.severity}`"
          />
        </div>
      </template>

      <div class="vehicle-hud__sep" />
      <button class="vehicle-hud__service-btn" @click="$emit('complete')">
        Voiture en service
      </button>

    </div>
  </Transition>
</template>

<script setup>
const PRIORITY_LABELS = {
  urgent:  'Très urgent',
  high:    'Prioritaire',
  normal:  'Normal',
  low:     'Faible priorité',
}

const FUEL_ICONS = {
  hydrogen: '⊕',
  electric: '⚡',
  gasoline: '⛽',
  diesel:   '⛽',
}

defineProps({
  vehicle: { type: Object, default: null },
  meta:    { type: Object, default: null },
})
defineEmits(['complete'])
</script>

<style scoped>
.vehicle-hud {
  position: fixed;
  right: 24px;
  top: 50%;
  transform: translateY(-50%);
  width: 260px;
  max-height: 80vh;
  overflow-y: auto;
  background: rgba(10, 10, 20, 0.88);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  padding: 16px 18px;
  pointer-events: all;
  z-index: 400;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.vehicle-hud__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.vehicle-hud__name {
  font-size: 0.88rem;
  font-weight: 700;
  color: #fff;
  line-height: 1.2;
}

.vehicle-hud__priority {
  flex-shrink: 0;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 3px 7px;
  border-radius: 3px;
  color: #fff;
}
.vehicle-hud__priority--urgent { background: #ff0044; }
.vehicle-hud__priority--high   { background: #ff6600; }
.vehicle-hud__priority--normal { background: #0077ff; }
.vehicle-hud__priority--low    { background: #444; }

.vehicle-hud__fuel {
  display: flex;
  align-items: center;
  gap: 7px;
}

.vehicle-hud__fuel-icon {
  font-size: 1rem;
  color: rgba(255,255,255,0.6);
}

.vehicle-hud__fuel-bar-wrap {
  flex: 1;
  height: 5px;
  background: rgba(255,255,255,0.1);
  border-radius: 3px;
  overflow: hidden;
}

.vehicle-hud__fuel-bar {
  height: 100%;
  background: #00cc66;
  border-radius: 3px;
  transition: width 0.4s ease;
}

.vehicle-hud__fuel-value {
  font-size: 0.7rem;
  font-weight: 700;
  color: rgba(255,255,255,0.7);
  min-width: 28px;
  text-align: right;
}

.vehicle-hud__sep {
  border: none;
  border-top: 1px solid rgba(255,255,255,0.1);
}

.vehicle-hud__delay {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #fff;
}

.vehicle-hud__delay-icon {
  font-size: 0.9rem;
  color: rgba(255,255,255,0.5);
}

.vehicle-hud__delay-label {
  font-weight: 400;
  color: rgba(255,255,255,0.4);
  font-size: 0.68rem;
}

.vehicle-hud__table {
  width: 100%;
  border-collapse: collapse;
}

.vehicle-hud__table tr + tr td { padding-top: 5px; }

.vehicle-hud__key {
  font-size: 0.68rem;
  font-weight: 600;
  color: rgba(255,255,255,0.4);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
  padding-right: 12px;
}

.vehicle-hud__val {
  font-size: 0.78rem;
  font-weight: 700;
  color: #fff;
  text-align: right;
}

.vehicle-hud__section-title {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.35);
}

.vehicle-hud__part {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.vehicle-hud__part-name {
  font-size: 0.72rem;
  color: rgba(255,255,255,0.7);
}

.vehicle-hud__part-status {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 2px 7px;
  border-radius: 3px;
  white-space: nowrap;
}
.vehicle-hud__part-status--ok { background: rgba(0,204,102,0.2); color: #00cc66; }
.vehicle-hud__part-status--ko { background: rgba(255,102,0,0.15); color: #ff8844; }

.vehicle-hud__history-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.vehicle-hud__history-date {
  font-size: 0.66rem;
  color: rgba(255,255,255,0.4);
  min-width: 76px;
}

.vehicle-hud__history-type {
  font-size: 0.7rem;
  font-weight: 600;
  color: rgba(255,255,255,0.7);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex: 1;
}

.vehicle-hud__history-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.vehicle-hud__history-dot--critique  { background: #ff0044; }
.vehicle-hud__history-dot--endommage { background: #ff6600; }
.vehicle-hud__history-dot--use       { background: #ffcc00; }
.vehicle-hud__history-dot--bon       { background: #00ff88; }

.vehicle-hud__service-btn {
  width: 100%;
  padding: 9px 0;
  background: #0055cc;
  color: #fff;
  border: none;
  border-radius: 5px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.15s;
}
.vehicle-hud__service-btn:hover { background: #0066ee; }

.vehicle-panel-enter-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.vehicle-panel-leave-active { transition: opacity 0.2s ease; }
.vehicle-panel-enter-from   { opacity: 0; transform: translate(10px, -50%); }
.vehicle-panel-leave-to     { opacity: 0; }
</style>
