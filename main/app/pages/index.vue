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

    <CinematicHud
      :active="cinematic.active.value"
      :is-paused="cinematic.isPaused.value"
      :current-time="cinematic.currentTime.value"
      :duration="cinematic.duration.value"
      @pause="cinematic.pause()"
      @resume="cinematic.resume()"
      @skip="cinematic.skip()"
      @seek="cinematic.seek($event)"
    />
  </template>

  <TextCinematicHud
    :active="textCinematic.active.value"
    :visible="textCinematic.visible.value"
    :card="textCinematic.card.value"
  />

  <LoadingHud :visible="isLoadingScene" :progress="loadingProgress" />

  <!-- Overlay de transition fade-to-black -->
  <div class="fade-overlay" :class="{ 'fade-overlay--visible': isFading }" />
</template>

<script setup>
import Experience    from '~/utils/three/Experience.js'
import SceneManager  from '~/utils/three/SceneManager.js'
import FlowManager   from '~/utils/three/FlowManager.js'
import { SCENES, SCENE_NAMES } from '~/utils/three/world/SCENES.js'
import { useQuestState }      from '~/composables/useQuestState.js'
import { useDialogueState }   from '~/composables/useDialogueState.js'
import { useCinematicState }  from '~/composables/useCinematicState.js'
import { useTextCinematic }   from '~/composables/useTextCinematic.js'

const canvas         = useTemplateRef('canvas')
const quest          = useQuestState()
const dialogue       = useDialogueState()
const cinematic      = useCinematicState()
const textCinematic  = useTextCinematic()
const isFading       = ref(false)
const isStarted      = ref(false)
const isLoadingScene = ref(false)
const loadingProgress = ref(0)

const FADE_MS = 400

let experience   = null
let sceneManager = null

function makeCallbacks() {
  return {
    onQuestReady:    (mgr) => quest.bind(mgr),
    onDialogueReady: (mgr) => dialogue.bind(mgr),
    onFpsReady:      (fps) => fps.lock(),
    transitionTo,
    onLoadProgress:  (pct) => { loadingProgress.value = pct },
  }
}

function transitionTo(name) {
  const scene = SCENES[name]
  if (!scene) return
  experience?.sound.fadeOutAndStop(FADE_MS)
  isFading.value = true
  setTimeout(() => {
    experience.flow.run(scene.flow, name)
  }, FADE_MS)
}

function startExperience() {
  isStarted.value = true

  experience   = new Experience(canvas.value)
  sceneManager = new SceneManager(experience)

  experience.flow = new FlowManager(experience, sceneManager)
  cinematic.bind(experience.cinematic)

  experience.flow.bindTextHandler(cards => textCinematic.play(cards))
  experience.flow.bindSceneResolver(name => ({
    World:     SCENES[name].World,
    sources:   SCENES[name].sources,
    callbacks: makeCallbacks(),
  }))

  experience.flow.on('flow_start', ({ hasCinematic }) => {
    isLoadingScene.value  = !hasCinematic
    loadingProgress.value = 0
  })
  experience.flow.on('preload_progress', pct => {
    loadingProgress.value = pct   // silencieux : loader caché pendant les cinématiques
  })
  experience.flow.on('flow_end', () => {
    isLoadingScene.value = false
    isFading.value = false
  })

  if (experience.debug.active) _registerDebugSceneSwitcher()

  experience.flow.run(SCENES['scene_1'].flow, 'scene_1')
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
  z-index: 750;
}

.fade-overlay--visible {
  opacity: 1;
}
</style>
