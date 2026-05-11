<template>
  <canvas ref="canvas" />

  <StartHud v-if="!isStarted" @start="startExperience" />

  <template v-if="isStarted">
    <QuestHud
      :current-step="quest.currentStep.value"
      :step-index="quest.stepIndex.value"
      :total-steps="quest.totalSteps.value"
    />

    <DialogueHud
      :active="dialogue.active.value"
      :current="dialogue.current.value"
      :index="dialogue.index.value"
      :total="dialogue.total.value"
      :is-last="dialogue.isLast.value"
      @next="dialogue.next()"
    />
  </template>

  <LoadingHud :visible="isLoadingScene" :progress="loadingProgress" />

  <!-- Overlay de transition fade-to-black -->
  <div class="fade-overlay" :class="{ 'fade-overlay--visible': isFading }" />
</template>

<script setup>
import Experience            from '~/utils/three/Experience.js'
import SceneManager          from '~/utils/three/SceneManager.js'
import AtelierWorld          from '~/utils/three/world/atelier/AtelierWorld.js'
import AtelierSources        from '~/utils/three/world/atelier/AtelierSources.js'
import { SCENES, SCENE_NAMES } from '~/utils/three/world/SCENES.js'
import { useQuestState }    from '~/composables/useQuestState.js'
import { useDialogueState } from '~/composables/useDialogueState.js'

const canvas    = useTemplateRef('canvas')
const quest     = useQuestState()
const dialogue  = useDialogueState()
const isFading  = ref(false)
const isStarted = ref(false)

const isLoadingScene  = ref(false)
const loadingProgress = ref(0)

const FADE_MS = 400

let experience    = null
let sceneManager  = null

function makeCallbacks() {
  return {
    onQuestReady:    (mgr) => quest.bind(mgr),
    onDialogueReady: (mgr) => dialogue.bind(mgr),
    onFpsReady:      (fps) => fps.lock(),
    transitionTo,
    onLoadProgress:  (pct) => { loadingProgress.value = pct },
  }
}

async function transitionTo(name) {
  const scene = SCENES[name]
  if (!scene) return

  isLoadingScene.value  = true
  loadingProgress.value = 0
  isFading.value = true

  await new Promise(r => setTimeout(r, FADE_MS))
  await sceneManager.load(scene.World, scene.sources, makeCallbacks())
  await nextTick()

  // Hide loading bar before fading the scene back in
  isLoadingScene.value = false
  isFading.value = false
}

function startExperience() {
  isStarted.value       = true
  isLoadingScene.value  = true
  loadingProgress.value = 0

  experience   = new Experience(canvas.value)
  sceneManager = new SceneManager(experience)
  sceneManager.load(AtelierWorld, AtelierSources, makeCallbacks()).then(() => {
    isLoadingScene.value = false
  })

  if (experience.debug.active) {
    _registerDebugSceneSwitcher()
  }
}

function _registerDebugSceneSwitcher() {
  const state  = { scene: SCENE_NAMES[0] }
  const folder = experience.debug.gui.addFolder('Scènes')
  folder.add(state, 'scene', SCENE_NAMES).name('Aller à').onChange(transitionTo)
}

onUnmounted(() => {
  sceneManager?.dispose()
  experience?.dispose()
  sceneManager = null
  experience   = null
})
</script>

<style scoped>
.fade-overlay {
  position: fixed;
  inset: 0;
  background: #000;
  pointer-events: none;
  opacity: 0;
  transition: opacity 400ms ease;
  z-index: 1000;
}

.fade-overlay--visible {
  opacity: 1;
}
</style>
