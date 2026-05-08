<template>
  <div class="assets" @dragover.prevent="onPanelDragOver" @dragleave="dragOver = false" @drop.prevent="onPanelDrop">
    <div class="assets-header">
      <span class="assets-title">Assets</span>
      <div class="assets-actions">
        <label class="assets-add">
          + Audio
          <input type="file" accept="audio/*" multiple style="display:none" @change="onAudioPicked" />
        </label>
        <label class="assets-add assets-add--lut">
          + LUT
          <input type="file" accept=".cube" multiple style="display:none" @change="onLutPicked" />
        </label>
      </div>
    </div>

    <div class="assets-list" :class="{ 'drag-over': dragOver }">
      <div v-if="!store.assets.length" class="assets-empty">
        Glisse des fichiers audio ou .cube ici
      </div>

      <template v-for="asset in store.assets" :key="asset.id">
        <div
          class="asset-item"
          draggable="true"
          @dragstart="onDragStart($event, asset)"
        >
          <span class="asset-icon" :class="asset.assetType === 'lut' ? 'asset-icon--lut' : 'asset-icon--audio'">
            {{ asset.assetType === 'lut' ? '▣' : '♪' }}
          </span>
          <span class="asset-name" :title="asset.name">{{ asset.name }}</span>
          <span v-if="asset.assetType === 'lut'" class="asset-badge">LUT</span>
          <button class="asset-del" @click.stop="store.removeAsset(asset.id)">×</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { useCinematicEditorStore } from '~/stores/cinematicEditor.js'

const store    = useCinematicEditorStore()
const dragOver = ref(false)

function onAudioPicked(e) {
  for (const file of e.target.files) {
    if (file.type.startsWith('audio/')) store.addAsset(file, 'audio')
  }
  e.target.value = ''
}

function onLutPicked(e) {
  for (const file of e.target.files) {
    if (file.name.endsWith('.cube')) store.addAsset(file, 'lut')
  }
  e.target.value = ''
}

function onPanelDragOver(e) {
  if ([...e.dataTransfer.items].some(i => i.kind === 'file')) dragOver.value = true
}

function onPanelDrop(e) {
  dragOver.value = false
  for (const file of e.dataTransfer.files) {
    if (file.type.startsWith('audio/'))    store.addAsset(file, 'audio')
    else if (file.name.endsWith('.cube'))  store.addAsset(file, 'lut')
  }
}

function onDragStart(e, asset) {
  e.dataTransfer.effectAllowed = 'copy'
  const payload = asset.assetType === 'lut'
    ? { type: 'lut-asset',   name: asset.name }
    : { type: 'sound-asset', name: asset.name }
  e.dataTransfer.setData('application/json', JSON.stringify(payload))
}
</script>

<style scoped>
.assets {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1a1a1a;
  overflow: hidden;
}

.assets-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #1e1e1e;
  flex-shrink: 0;
}

.assets-title {
  color: #ccc;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.assets-actions { display: flex; gap: 6px; }

.assets-add {
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  color: #aaa;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}
.assets-add:hover { background: #333; color: #ddd; }
.assets-add--lut { border-color: #3a4a3a; color: #a5d6a7; }
.assets-add--lut:hover { color: #c8e6c9; }

.assets-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
  transition: background 0.1s;
}
.assets-list.drag-over { background: #1f2a1f; }

.assets-empty {
  padding: 16px 12px;
  color: #444;
  font-size: 11px;
  text-align: center;
}

.asset-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  cursor: grab;
  user-select: none;
}
.asset-item:hover { background: #252525; }
.asset-item:active { cursor: grabbing; }

.asset-icon { font-size: 12px; flex-shrink: 0; }
.asset-icon--audio { color: #a5d6a7; }
.asset-icon--lut   { color: #c8e6c9; }

.asset-name {
  flex: 1;
  font-size: 11px;
  color: #ccc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.asset-badge {
  font-size: 9px;
  background: #2a3a2a;
  color: #a5d6a7;
  padding: 1px 5px;
  border-radius: 3px;
  flex-shrink: 0;
}

.asset-del {
  background: none;
  border: none;
  color: #555;
  cursor: pointer;
  font-size: 14px;
  padding: 0 2px;
  line-height: 1;
  flex-shrink: 0;
}
.asset-del:hover { color: #f87171; }
</style>
