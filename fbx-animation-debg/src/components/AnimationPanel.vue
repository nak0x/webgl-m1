<template>
  <aside class="panel">
    <div class="panel-header">
      <span class="panel-title">Animations</span>
      <span class="anim-count">{{ animations.length }}</span>
    </div>

    <div v-if="animations.length === 0" class="panel-empty">
      <p>No animations found</p>
      <p class="empty-sub">Drop an FBX with embedded animations</p>
    </div>

    <ul v-else class="anim-list">
      <li
        v-for="anim in animations"
        :key="anim.index"
        class="anim-item"
        :class="{ active: activeClip?.index === anim.index }"
        @click="emit('play', anim)"
      >
        <div class="anim-icon">
          <svg v-if="activeClip?.index === anim.index && playing" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        </div>
        <div class="anim-info">
          <span class="anim-name" :title="anim.name">{{ anim.name }}</span>
          <span class="anim-dur">{{ formatDuration(anim.duration) }}</span>
        </div>
        <div v-if="activeClip?.index === anim.index" class="active-dot" />
      </li>
    </ul>
  </aside>
</template>

<script setup>
const props = defineProps({
  animations: { type: Array, default: () => [] },
  activeClip: { type: Object, default: null },
  playing: Boolean,
})

const emit = defineEmits(['play'])

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(2).padStart(5, '0')
  return m > 0 ? `${m}:${s}` : `${s}s`
}
</script>

<style scoped>
.panel {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #111115;
  border-left: 1px solid #1e1e28;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #1e1e28;
}

.panel-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6a6a88;
}

.anim-count {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 10px;
  background: #1e1e2a;
  color: #5a5a78;
}

.panel-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #3e3e52;
  padding: 24px;
  text-align: center;
  font-size: 13px;
}

.empty-sub {
  font-size: 11px;
  color: #2e2e3e;
}

.anim-list {
  flex: 1;
  overflow-y: auto;
  list-style: none;
  padding: 6px 0;
}

.anim-list::-webkit-scrollbar {
  width: 4px;
}
.anim-list::-webkit-scrollbar-track {
  background: transparent;
}
.anim-list::-webkit-scrollbar-thumb {
  background: #2a2a38;
  border-radius: 2px;
}

.anim-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  cursor: pointer;
  border-radius: 6px;
  margin: 1px 6px;
  transition: background 0.15s;
  position: relative;
}

.anim-item:hover {
  background: #1a1a24;
}

.anim-item.active {
  background: rgba(124, 106, 247, 0.12);
}

.anim-icon {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  background: #1e1e2a;
  color: #5a5a78;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}

.anim-item.active .anim-icon {
  background: rgba(124, 106, 247, 0.2);
  color: #a89af7;
}

.anim-item:hover:not(.active) .anim-icon {
  background: #252535;
  color: #8a8aaa;
}

.anim-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.anim-name {
  font-size: 12px;
  font-weight: 500;
  color: #c0c0d8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.anim-item.active .anim-name {
  color: #d4ccff;
}

.anim-dur {
  font-size: 10px;
  color: #4a4a62;
  font-variant-numeric: tabular-nums;
}

.active-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #7c6af7;
  flex-shrink: 0;
}
</style>
