<template>
  <div class="glasses-overlay">

    <div class="glasses-filter" />

    <div class="glasses-ui">
      <div class="glasses-status">
        <div class="glasses-battery">
          <svg width="28" height="14" viewBox="0 0 28 14" fill="none">
            <rect x="0.5" y="0.5" width="24" height="13" rx="2.5" stroke="rgba(20, 28, 45, 0.78)" stroke-width="1"/>
            <rect x="25" y="4" width="3" height="6" rx="1" fill="rgba(20, 28, 45, 0.78)"/>
            <rect x="2" y="2" :width="Math.round(20 * batteryLevel / 100)" height="10" rx="1.5" fill="rgba(20, 28, 45, 0.78)"/>
          </svg>
          <span>{{ batteryLevel }}%</span>
        </div>
        <div class="glasses-time">{{ currentTime }}</div>
      </div>

      <div v-if="collectibles.length > 0" class="glasses-card">
        <div class="collect-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0, 0, 0, 0.8)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          <span>Outils requis</span>
        </div>
        <hr class="collect-sep" />
        <div class="collect-list">
          <div
            v-for="item in collectibles"
            :key="item.id"
            class="collect-item"
            :class="{ 'collect-item--done': item.collected }"
          >
            <div class="collect-checkbox">
              <svg v-if="item.collected" width="10" height="10" viewBox="0 0 10 10" fill="none">
                <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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
          class="glasses-card"
        >
          <div class="notif-title">
            <span>ⓘ</span>
            {{ notif.title }}
          </div>
          <hr class="collect-sep" />
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
  gap: 12px;
  width: 240px;
}

.glasses-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.glasses-battery {
  display: flex;
  align-items: center;
  gap: 6px;
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.6);
}

.glasses-time {
  background: rgba(20, 28, 45, 0.78);
  backdrop-filter: blur(6px);
  color: rgba(255, 255, 255);
  padding: 5px 12px;
  width: 100px;
  display: flex;
  justify-content: center;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
}

.glasses-card {
  background: rgba(255, 255, 255, 0.80);
  backdrop-filter: blur(10px);
  padding: 14px 16px;
  width: 100%;
  box-sizing: border-box;
}

/* ── Checklist ── */

.collect-header {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  font-weight: 700;
  color: rgba(20, 28, 45, 0.78);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.collect-sep {
  border: none;
  border-top: 1px solid rgba(20, 28, 45, 0.78);
  margin: 10px 0;
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
  width: 16px;
  height: 16px;
  border: 1.5px solid rgba(20, 28, 45, 0.78);
  border-radius: 3px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, border-color 0.2s;
}

.collect-item--done .collect-checkbox {
  background: rgba(80, 130, 255, 0.7);
  border-color: rgba(80, 130, 255, 0.7);
}

.collect-label {
  font-size: 13px;
  color: rgba(20, 28, 45, 0.78);
  transition: opacity 0.2s;
}

.collect-item--done .collect-label {
  text-decoration: line-through;
  opacity: 0.4;
}

/* ── Notifications ── */

.glasses-notifs {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.notif-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: rgba(20, 28, 45, 0.78);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.notif-body {
  font-size: 12px;
  color: rgba(20, 28, 45, 0.78);
  line-height: 1.55;
}

.notif-enter-active { transition: opacity 0.35s ease, transform 0.35s ease; }
.notif-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.notif-enter-from   { opacity: 0; transform: translateX(40px); }
.notif-leave-to     { opacity: 0; transform: translateX(40px); }
</style>
