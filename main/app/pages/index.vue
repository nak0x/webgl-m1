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

  <!-- Overlay de transition fade-to-black -->
  <div class="fade-overlay" :class="{ 'fade-overlay--visible': isFading }" />
</template>

<script setup>
import Experience            from '~/utils/three/Experience.js'
import SceneManager          from '~/utils/three/SceneManager.js'
import AtelierWorld          from '~/utils/three/world/AtelierWorld.js'
import AtelierSources        from '~/utils/three/world/AtelierSources.js'
import AtelierScene2World    from '~/utils/three/world/AtelierScene2World.js'
import AtelierScene2Sources  from '~/utils/three/world/AtelierScene2Sources.js'
import { useQuestState }    from '~/composables/useQuestState.js'
import { useDialogueState } from '~/composables/useDialogueState.js'

const canvas    = useTemplateRef('canvas')
const quest     = useQuestState()
const dialogue  = useDialogueState()
const isFading  = ref(false)
const isStarted = ref(false)

const FADE_MS = 400

let experience    = null
let sceneManager  = null

function makeCallbacks() {
  return {
    onQuestReady:    (mgr) => quest.bind(mgr),
    onDialogueReady: (mgr) => dialogue.bind(mgr),
    onFpsReady:      (fps) => fps.lock(),
    transitionTo,
  }
}

async function transitionTo(name) {
  isFading.value = true
  await new Promise(r => setTimeout(r, FADE_MS))

  if (name === 'scene2') {
    await sceneManager.load(AtelierScene2World, AtelierScene2Sources, makeCallbacks())
  }

  await nextTick()
  isFading.value = false
}

function startExperience() {
  isStarted.value = true
  experience   = new Experience(canvas.value)
  sceneManager = new SceneManager(experience)
  sceneManager.load(AtelierWorld, AtelierSources, makeCallbacks())
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
