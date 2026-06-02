<template>
  <Transition name="vehicle-panel">
    <div v-if="vehicle" class="vehicle-hud">

      <!-- Reservation / delay bar -->
      <div v-if="meta?.repair_delay_days > 0" class="vehicle-hud__reservation">
        <div class="vehicle-hud__delay-block">
          <img src="/images/Picto/Temps-estime.svg" class="vehicle-hud__delay-icon" alt="" aria-hidden="true" />
          <span class="vehicle-hud__delay-days">
            {{ meta.repair_delay_days }} jour{{ meta.repair_delay_days > 1 ? 's' : '' }}
          </span>
        </div>
        <div class="vehicle-hud__appointment-block">
          <p class="vehicle-hud__appointment-title">
            {{ meta.appointment_title ?? 'Délai estimé' }}
          </p>
          <p class="vehicle-hud__appointment-sub">
            {{ meta.appointment_sub ?? 'Voir planning' }}
          </p>
        </div>
      </div>

      <!-- Boîte à pièce -->
      <div v-if="meta?.available_parts?.length" class="vehicle-hud__panel">
        <div
          v-for="part in meta.available_parts"
          :key="part.id ?? part.name"
          class="vehicle-hud__part-row"
        >
          <div class="vehicle-hud__part-left">
            <img :src="PART_ICONS[part.id] ?? '/images/Picto/Stock-sans-F.svg'" class="vehicle-hud__part-icon" alt="" aria-hidden="true" />
            <span class="vehicle-hud__part-name">{{ part.name }}</span>
          </div>
          <div class="vehicle-hud__part-right">
            <template v-if="part.available">
              <div class="vehicle-hud__part-badge vehicle-hud__part-badge--ok">
                <span>Disponible</span>
                <img src="/images/Picto/Reussi-fait.svg" class="vehicle-hud__part-check" alt="" aria-hidden="true" />
              </div>
            </template>
            <template v-else>
              <div class="vehicle-hud__part-delivery">
                <div class="vehicle-hud__part-badge vehicle-hud__part-badge--ko">
                  <span>Commander</span>
                  <img src="/images/Picto/commander.svg" class="vehicle-hud__part-check" alt="" aria-hidden="true" />
                </div>
                <span v-if="part.delivery_days" class="vehicle-hud__part-delivery-days">
                  Livré sous {{ part.delivery_days }} jour{{ part.delivery_days > 1 ? 's' : '' }}
                </span>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- ID véhicule -->
      <div class="vehicle-hud__panel">
        <div class="vehicle-hud__panel-header">
          <span class="vehicle-hud__panel-title">{{ vehicle.name }}</span>
          <div class="vehicle-hud__fuel-tag">
            <img :src="FUEL_ICONS[vehicle.fuel_type] ?? FUEL_ICONS.gasoline" class="vehicle-hud__fuel-icon" alt="" aria-hidden="true" />
            <span class="vehicle-hud__fuel-value">{{ vehicle.fuel_level }} L</span>
          </div>
        </div>
        <div class="vehicle-hud__sep" />
        <table class="vehicle-hud__table">
          <tbody>
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
          </tbody>
        </table>
      </div>

      <!-- Historique de réparation -->
      <div v-if="meta?.repair_history?.length" class="vehicle-hud__panel">
        <p class="vehicle-hud__panel-title">Historique de réparation</p>
        <div class="vehicle-hud__sep" />
        <div class="vehicle-hud__history-list">
          <div
            v-for="(entry, i) in meta.repair_history"
            :key="i"
            class="vehicle-hud__history-row"
          >
            <span class="vehicle-hud__history-date">{{ entry.date }}</span>
            <div class="vehicle-hud__history-badge" :class="`vehicle-hud__history-badge--${historyColor(entry.type)}`">
              <img :src="HISTORY_ICONS[entry.type?.toLowerCase()] ?? '/images/Picto/Reparation-sans-F.svg'" class="vehicle-hud__history-icon" alt="" aria-hidden="true" />
              <span>{{ entry.type }}</span>
            </div>
            <span class="vehicle-hud__history-dot" :class="`vehicle-hud__history-dot--${entry.severity}`" />
          </div>
        </div>
      </div>

      <!-- Service button -->
      <button
        class="vehicle-hud__service-btn"
        :disabled="!canComplete"
        @click="$emit('complete')"
      >
        {{ canComplete ? 'Voiture en service' : 'Réparations en cours…' }}
      </button>

    </div>
  </Transition>
</template>

<script setup>
const FUEL_ICONS = {
  hydrogen: '/images/Picto/Regulateur-hydrogene.svg',
  electric:  '/images/Picto/Batterie.svg',
  gasoline:  '/images/Picto/Essence.svg',
  diesel:    '/images/Picto/Essence.svg',
}

const PART_ICONS = {
  filtre_hydrogene:    '/images/Picto/Filtre.svg',
  regulateur_hydrogene: '/images/Picto/Regulateur-hydrogene.svg',
}

const HISTORY_ICONS = {
  moteur:  '/images/Picto/Reparation-sans-F.svg',
  frein:   '/images/Picto/Frein.svg',
  freins:  '/images/Picto/Frein.svg',
  batterie: '/images/Picto/Batterie.svg',
}

const HISTORY_TYPE_COLORS = {
  moteur:   'orange',
  frein:    'teal',
  freins:   'teal',
  batterie: 'teal',
}

function historyColor(type) {
  return HISTORY_TYPE_COLORS[type?.toLowerCase()] ?? 'orange'
}

defineProps({
  vehicle:     { type: Object,  default: null },
  meta:        { type: Object,  default: null },
  canComplete: { type: Boolean, default: false },
})
defineEmits(['complete'])
</script>

<style scoped>
.vehicle-hud {
  position: fixed;
  right: 24px;
  top: 50%;
  transform: translateY(-50%);
  width: 341px;
  max-height: 88vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0;
  pointer-events: all;
  z-index: 400;
  font-family: 'Fira Sans', system-ui, sans-serif;
}

/* ── Reservation bar ── */

.vehicle-hud__reservation {
  display: flex;
  align-items: stretch;
  background: #ff6038;
  height: 50px;
}

.vehicle-hud__delay-block {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 9px 11px;
  background: #2d1d1b;
  width: 114px;
  flex-shrink: 0;
}

.vehicle-hud__delay-icon {
  width: 31px;
  height: 32px;
  display: block;
  flex-shrink: 0;
  filter: invert(0.9) brightness(1.2);
}

.vehicle-hud__delay-days {
  font-size: 16px;
  font-weight: 500;
  line-height: normal;
  color: #efeadf;
  text-align: right;
  flex: 1;
}

.vehicle-hud__appointment-block {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  padding: 4px 10px;
  background: #8eb8b8;
  flex: 1;
  overflow: hidden;
}

.vehicle-hud__appointment-title {
  font-size: 16px;
  font-weight: 700;
  line-height: 15px;
  color: #fff;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vehicle-hud__appointment-sub {
  font-size: 16px;
  font-weight: 400;
  line-height: 15px;
  color: #fff;
  margin: 0;
  white-space: nowrap;
}

/* ── Panels ── */

.vehicle-hud__panel {
  background: #efeadf;
  box-shadow: 0 4px 10px rgba(142, 184, 184, 0.75);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
  overflow: hidden;
}

.vehicle-hud__panel:first-child {
  margin-top: 0;
}

.vehicle-hud__panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.vehicle-hud__panel-title {
  font-size: 16px;
  font-weight: 500;
  line-height: 20px;
  color: #2d1d1b;
  text-transform: uppercase;
  margin: 0;
  white-space: nowrap;
}

.vehicle-hud__sep {
  height: 1px;
  background: rgba(45, 29, 27, 0.2);
  border: none;
  flex-shrink: 0;
}

/* ── Fuel tag ── */

.vehicle-hud__fuel-tag {
  background: #2d1d1b;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 9px;
  height: 36px;
}

.vehicle-hud__fuel-icon {
  width: 18px;
  height: 18px;
  display: block;
  flex-shrink: 0;
  filter: invert(0.9) sepia(0.2) saturate(0.5);
}

.vehicle-hud__fuel-value {
  font-size: 16px;
  font-weight: 500;
  line-height: normal;
  color: #efeadf;
  text-align: right;
}

/* ── Vehicle table ── */

.vehicle-hud__table {
  width: 100%;
  border-collapse: collapse;
}

.vehicle-hud__table tr + tr td { padding-top: 8px; }

.vehicle-hud__key {
  font-size: 16px;
  font-weight: 500;
  line-height: 20px;
  color: #2d1d1b;
  white-space: nowrap;
  padding-right: 12px;
}

.vehicle-hud__val {
  font-size: 16px;
  font-weight: 400;
  line-height: 20px;
  color: #2d1d1b;
  text-align: right;
}

/* ── Parts list ── */

.vehicle-hud__part-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 23px;
}

.vehicle-hud__part-left {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
}

.vehicle-hud__part-icon {
  width: 21px;
  height: 17px;
  display: block;
  flex-shrink: 0;
  opacity: 0.75;
}

.vehicle-hud__part-name {
  font-size: 12px;
  font-weight: 400;
  line-height: 15px;
  color: #2d1d1b;
  white-space: nowrap;
}

.vehicle-hud__part-right {
  flex-shrink: 0;
}

.vehicle-hud__part-delivery {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.vehicle-hud__part-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 400;
  line-height: 15px;
  width: 105px;
  box-sizing: border-box;
  justify-content: space-between;
}

.vehicle-hud__part-badge--ok {
  background: #e2f9f9;
  color: #46b2b2;
}

.vehicle-hud__part-badge--ko {
  background: #f2bfb3;
  color: #ff6038;
}

.vehicle-hud__part-check {
  width: 17px;
  height: 13px;
  display: block;
  flex-shrink: 0;
}

.vehicle-hud__part-delivery-days {
  font-size: 8px;
  font-weight: 400;
  line-height: 15px;
  color: #ff6038;
  text-align: right;
  white-space: nowrap;
}

/* ── History list ── */

.vehicle-hud__history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.vehicle-hud__history-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px solid #2d1d1b;
  padding: 9px 9px 9px 10px;
  min-height: 36px;
}

.vehicle-hud__history-date {
  font-size: 16px;
  font-weight: 400;
  line-height: 15px;
  color: #2d1d1b;
  white-space: nowrap;
}

.vehicle-hud__history-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 5px;
  font-size: 12px;
  font-weight: 400;
  line-height: 15px;
  border: 1px solid currentColor;
  width: 96px;
  box-sizing: border-box;
  text-align: right;
  justify-content: flex-end;
}

.vehicle-hud__history-badge--orange { color: #f34c22; }
.vehicle-hud__history-badge--teal   { color: #46b2b2; }

.vehicle-hud__history-icon {
  width: 21px;
  height: 16px;
  display: block;
  flex-shrink: 0;
  opacity: 0.8;
}

.vehicle-hud__history-dot {
  width: 23px;
  height: 23px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.vehicle-hud__history-dot::after {
  content: '';
  display: block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.vehicle-hud__history-dot--critique::after,
.vehicle-hud__history-dot--endommage::after {
  background: #f34c22;
}

.vehicle-hud__history-dot--use::after,
.vehicle-hud__history-dot--bon::after {
  background: #46b2b2;
}

/* ── Service button ── */

.vehicle-hud__service-btn {
  background: #ff6038;
  color: #2d1d1b;
  border: none;
  padding: 10px 12px;
  font-family: 'Fira Sans', system-ui, sans-serif;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  text-align: center;
  cursor: pointer;
  width: 100%;
  margin-top: 4px;
  box-shadow: 0 0 3px rgba(45, 29, 27, 0.25);
  transition: filter 0.15s;
}

.vehicle-hud__service-btn:hover:not(:disabled) { filter: brightness(0.9); }

.vehicle-hud__service-btn:disabled {
  background: #8eb8b8;
  color: rgba(45, 29, 27, 0.5);
  cursor: not-allowed;
}

/* ── Transition ── */

.vehicle-panel-enter-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.vehicle-panel-leave-active { transition: opacity 0.2s ease; }
.vehicle-panel-enter-from   { opacity: 0; transform: translateX(10px) translateY(-50%); }
.vehicle-panel-leave-to     { opacity: 0; }
</style>
