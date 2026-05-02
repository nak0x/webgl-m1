<script setup>
import { ref } from 'vue'

const emit = defineEmits(['files-added'])

const isDragOver = ref(false)
const loaded = ref([]) // [{ name, file }]

function processFileList(fileList) {
  const glbs = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith('.glb'))
  if (!glbs.length) return
  const incoming = glbs.filter(f => !loaded.value.some(d => d.name === f.name))
  loaded.value = [...loaded.value, ...incoming.map(f => ({ name: f.name, file: f }))]
  emit('files-added', loaded.value.map(d => d.file))
}

function remove(name) {
  loaded.value = loaded.value.filter(d => d.name !== name)
  emit('files-added', loaded.value.map(d => d.file))
}

function onDrop(e) {
  isDragOver.value = false
  processFileList(e.dataTransfer.files)
}

function onInput(e) {
  processFileList(e.target.files)
  e.target.value = ''
}
</script>

<template>
  <div class="section">
    <div class="section-title">Districts</div>
    <div
      class="dropzone"
      :class="{ 'drag-over': isDragOver }"
      @dragover.prevent="isDragOver = true"
      @dragleave.prevent="isDragOver = false"
      @drop.prevent="onDrop"
    >
      <span class="hint">Drop .glb files here</span>
      <label class="browse-btn">
        Browse
        <input type="file" accept=".glb" multiple hidden @change="onInput" />
      </label>
    </div>
    <ul v-if="loaded.length" class="district-list">
      <li v-for="d in loaded" :key="d.name">
        <span class="district-name" :title="d.name">{{ d.name }}</span>
        <button class="remove-btn" @click="remove(d.name)">✕</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #6e7681;
}

.dropzone {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px dashed #30363d;
  border-radius: 6px;
  padding: 10px 12px;
  transition: border-color 0.15s, background 0.15s;
}

.dropzone.drag-over {
  border-color: #3d9eff;
  background: rgba(61, 158, 255, 0.05);
}

.hint {
  color: #6e7681;
  font-size: 12px;
}

.browse-btn {
  cursor: pointer;
  background: #21262d;
  border: 1px solid #30363d;
  color: #c9d1d9;
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 12px;
  font-family: inherit;
  white-space: nowrap;
  transition: background 0.15s;
}
.browse-btn:hover { background: #30363d; }

.district-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.district-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: #161b22;
  border: 1px solid #21262d;
  border-radius: 4px;
  padding: 4px 8px;
}

.district-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #58a6ff;
  font-size: 12px;
}

.remove-btn {
  flex-shrink: 0;
  background: transparent;
  border: none;
  color: #6e7681;
  font-size: 11px;
  padding: 2px 4px;
}
.remove-btn:hover { color: #f85149; background: transparent; }
</style>
