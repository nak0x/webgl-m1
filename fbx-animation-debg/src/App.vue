<template>
  <div class="app">
    <!-- Main 3D viewport -->
    <div class="viewport-area">
      <Viewport
        ref="viewportRef"
        :has-model="hasModel"
        :loading="loading"
        @file-dropped="onFileDrop"
      />
      <PlaybackControls
        :playback="playback"
        :active-clip="activeClip"
        @toggle="togglePlayback"
        @seek="seekTo"
      />
    </div>

    <!-- Right side panel (only visible when FBX loaded) -->
    <Transition name="panel-slide">
      <AnimationPanel
        v-if="hasModel"
        :animations="animations"
        :active-clip="activeClip"
        :playing="playback.playing"
        @play="playAnimation"
      />
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import Viewport from './components/Viewport.vue'
import AnimationPanel from './components/AnimationPanel.vue'
import PlaybackControls from './components/PlaybackControls.vue'
import { useFBXScene } from './composables/useFBXScene.js'

const viewportRef = ref(null)
const loading = ref(false)

const {
  animations,
  activeClip,
  playback,
  init,
  loadFBX,
  playAnimation,
  togglePlayback,
  seekTo,
} = useFBXScene()

const modelLoaded = ref(false)
const hasModel = computed(() => modelLoaded.value)

onMounted(() => {
  const canvas = viewportRef.value.canvasRef
  init(canvas)
})

async function onFileDrop(file) {
  loading.value = true
  try {
    await loadFBX(file)
    modelLoaded.value = true
  } catch (err) {
    console.error('FBX load error:', err)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.app {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.viewport-area {
  flex: 1;
  position: relative;
  min-width: 0;
}

.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s;
}
.panel-slide-enter-from,
.panel-slide-leave-to {
  width: 0 !important;
  opacity: 0;
}
</style>
