<template>
  <div class="glasses-overlay">

    <div class="glasses-filter" />

    <div class="glasses-ui">

      <div class="glasses-status">
        <div class="glasses-battery">
          <svg class="battery-icon" width="52" height="24" viewBox="0 0 52 24" fill="none">
            <rect x="1" y="1" width="44" height="22" rx="3" stroke="#2d1d1b" stroke-width="2"/>
            <rect x="47" y="8" width="4" height="8" rx="1.5" fill="#2d1d1b"/>
            <rect x="4" y="4" :width="Math.max(0, Math.round(36 * batteryLevel / 100))" height="16" rx="1.5" fill="#2d1d1b"/>
          </svg>
          <span>{{ batteryLevel }}%</span>
        </div>
        <div class="glasses-time">{{ currentTime }}</div>
      </div>

      <div v-if="collectibles.length > 0" class="glasses-card">
        <div class="card-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2d1d1b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          <span>Outils requis</span>
        </div>
        <div class="collect-list">
          <div
            v-for="item in collectibles"
            :key="item.id"
            class="collect-item"
            :class="{ 'collect-item--done': item.collected }"
          >
            <div class="collect-checkbox">
              <svg v-if="item.collected" width="10" height="10" viewBox="0 0 10 10" fill="none">
                <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="#efeadf" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <span class="collect-label">{{ item.label }}</span>
          </div>
        </div>
      </div>

      <TransitionGroup name="notif" tag="div" class="glasses-notifs">
        <div
          v-for="notif in notifications"
          :key="notif.id"
          class="notif-card"
        >
          <div class="notif-info">
            <div class="notif-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2d1d1b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              <span>{{ notif.title }}</span>
            </div>
            <span v-if="notif.time" class="notif-time">{{ notif.time }}</span>
          </div>
          <div class="notif-body">{{ notif.text }}</div>
        </div>
      </TransitionGroup>

    </div>
  </div>
</template>

<script setup>
defineProps({
  batteryLevel:  { type: Number, default: 100 },
  notifications: { type: Array,  default: () => [] },
  collectibles:  { type: Array,  default: () => [] },
})

const currentTime = ref('')

function _updateTime() {
  const now = new Date()
  const h   = String(now.getHours()).padStart(2, '0')
  const m   = String(now.getMinutes()).padStart(2, '0')
  currentTime.value = `${h}:${m}`
}

let _interval = null

onMounted(() => {
  _updateTime()
  _interval = setInterval(_updateTime, 30_000)
})

onBeforeUnmount(() => {
  clearInterval(_interval)
})
</script>

<style scoped>
.glasses-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 300;
}

.glasses-filter {
  position: absolute;
  inset: 0;
  background-image: url('/images/filtre-vue-ar.jpg');
  background-size: cover;
  background-position: center;
  opacity: 0.15;
}

.glasses-ui {
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 20px;
  width: 328px;
}

/* ── Batterie + Heure ── */

.glasses-status {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 40px;
  width: 100%;
}

.glasses-battery {
  display: flex;
  align-items: center;
  gap: 12px;
  opacity: 0.8;
}

.battery-icon { display: block; }

.glasses-battery span {
  font-size: 18px;
  font-weight: 500;
  line-height: 20px;
  color: var(--color-black);
  font-variant-numeric: tabular-nums;
}

.glasses-time {
  background: var(--color-black);
  border: 1px solid var(--color-black);
  opacity: 0.8;
  width: 127px;
  height: 31px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 12px;
  font-size: 18px;
  font-weight: 500;
  line-height: 20px;
  color: var(--color-white);
  font-variant-numeric: tabular-nums;
}

/* ── Carte outils requis ── */

.glasses-card {
  background: rgba(255, 255, 255, 0.5);
  border: 1.5px solid #8eb8b8;
  border-right-width: 7px;
  opacity: 0.9;
  padding: 13.5px 13.5px 13.5px 13.5px;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 18px;
  font-weight: 500;
  line-height: 20px;
  color: var(--color-black);
}

.collect-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.collect-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.collect-checkbox {
  width: 18px;
  height: 18px;
  border: 1.5px solid var(--color-black);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, border-color 0.2s;
}

.collect-item--done .collect-checkbox {
  background: var(--color-orange);
  border-color: var(--color-orange);
}

.collect-label {
  font-size: 16px;
  font-weight: 400;
  line-height: 20px;
  color: var(--color-black);
  transition: opacity 0.2s;
}

.collect-item--done .collect-label {
  text-decoration: line-through;
  opacity: 0.45;
}

/* ── Notifications ── */

.glasses-notifs {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}

.notif-card {
  background: rgba(255, 255, 255, 0.5);
  border: 1.5px solid #8eb8b8;
  border-right-width: 7px;
  opacity: 0.9;
  padding: 13.5px 39px 13.5px 13.5px;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.notif-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.notif-title {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 18px;
  font-weight: 500;
  line-height: 20px;
  color: var(--color-black);
}

.notif-time {
  font-size: 12px;
  font-weight: 400;
  line-height: 15px;
  color: rgba(45, 29, 27, 0.75);
  white-space: nowrap;
}

.notif-body {
  font-size: 16px;
  font-weight: 400;
  line-height: 20px;
  color: var(--color-black);
}

.notif-enter-active { transition: opacity 0.35s ease, transform 0.35s ease; }
.notif-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.notif-enter-from   { opacity: 0; transform: translateX(40px); }
.notif-leave-to     { opacity: 0; transform: translateX(40px); }
</style>
