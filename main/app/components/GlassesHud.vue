<template>
  <div class="glasses-overlay">

    <div class="glasses-filter" />

    <div class="glasses-ui">
      <div class="glasses-status">
        <div class="glasses-battery">
          <svg width="28" height="14" viewBox="0 0 28 14" fill="none">
            <rect x="0.5" y="0.5" width="24" height="13" rx="2.5" stroke="#1a2a3a" stroke-width="1"/>
            <rect x="25" y="4" width="3" height="6" rx="1" fill="#1a2a3a"/>
            <rect x="2" y="2" :width="Math.round(20 * batteryLevel / 100)" height="10" rx="1.5" fill="#1a2a3a"/>
          </svg>
          <span>{{ batteryLevel }}%</span>
        </div>
        <div class="glasses-time">{{ currentTime }}</div>
      </div>

      <div v-if="collectibles.length > 0" class="glasses-card">
        <div class="collect-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a2a3a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
  background: rgba(110, 165, 215, 0.16);
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
  gap: 10px;
}

.glasses-battery {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #1a2a3a;
}

.glasses-time {
  background: #1a2a3a;
  color: #fff;
  padding: 4px 14px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
}

.glasses-card {
  background: rgba(195, 220, 240, 0.72);
  backdrop-filter: blur(10px);
  border-radius: 4px;
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
  color: #1a2a3a;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.collect-sep {
  border: none;
  border-top: 1px solid rgba(26, 42, 58, 0.2);
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
  border: 1.5px solid #1a2a3a;
  border-radius: 3px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, border-color 0.2s;
}

.collect-item--done .collect-checkbox {
  background: #1a2a3a;
  border-color: #1a2a3a;
}

.collect-label {
  font-size: 13px;
  color: #1a2a3a;
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
  gap: 10px;
  width: 100%;
}

.notif-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #1a2a3a;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.notif-body {
  font-size: 12px;
  color: #1a2a3a;
  line-height: 1.55;
}

.notif-enter-active { transition: opacity 0.35s ease, transform 0.35s ease; }
.notif-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.notif-enter-from   { opacity: 0; transform: translateX(40px); }
.notif-leave-to     { opacity: 0; transform: translateX(40px); }
</style>
