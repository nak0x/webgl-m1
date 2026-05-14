<template>
  <canvas ref="canvas" />

  <StartHud v-if="!isStarted" @start="startExperience" />

  <template v-if="isStarted">
    <QuestHud
      :act-label="quest.actLabel.value"
      :current-step="quest.currentStep.value"
      :step-index="quest.stepIndex.value"
      :total-steps="quest.totalSteps.value"
    />

    <GlassesHud
      v-if="glasses.glassesActive.value"
      :battery-level="glasses.batteryLevel.value"
      :notifications="glasses.notifications.value"
      :collectibles="glasses.collectibles.value"
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

    <QuestArrowHud
      :arrow-visible="indicator.arrowVisible.value"
      :arrow-angle="indicator.arrowAngle.value"
    />
  </template>

  <TextCinematicHud
    :active="textCinematic.active.value"
    :visible="textCinematic.visible.value"
    :card="textCinematic.card.value"
  />

  <PauseHud
    :visible="pause.isPaused.value"
    :volume="volume"
    @close="closePause"
    @return-home="returnToHome"
    @volume-change="onVolumeChange"
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
import { useQuestState }          from '~/composables/useQuestState.js'
import { useDialogueState }       from '~/composables/useDialogueState.js'
import { useGlassesState }        from '~/composables/useGlassesState.js'
import { usePauseState }          from '~/composables/usePauseState.js'
import { useQuestIndicatorState } from '~/composables/useQuestIndicatorState.js'
import { useCinematicState }      from '~/composables/useCinematicState.js'
import { useTextCinematic }       from '~/composables/useTextCinematic.js'

const canvas        = useTemplateRef('canvas')
const quest         = useQuestState()
const dialogue      = useDialogueState()
const glasses       = useGlassesState()
const pause         = usePauseState()
const cinematic     = useCinematicState()
const textCinematic = useTextCinematic()
const indicator     = useQuestIndicatorState()
const isFading  = ref(false)
const isStarted = ref(false)
const volume    = ref(1)

const isLoadingScene  = ref(false)
const loadingProgress = ref(0)

const FADE_MS = 400

let experience   = null
let sceneManager = null
let _fps         = null

function makeCallbacks() {
  return {
    onQuestReady:    (mgr, meta) => quest.bind(mgr, meta),
    onDialogueReady: (mgr) => dialogue.bind(mgr),
    onGlassesReady:  (mgr) => glasses.bind(mgr),
    onFpsReady:      (fps) => { _fps = fps; fps.lock() },
    onIndicatorReady: (ind) => {
      indicator.bindCamera(experience.camera.instance)
      ind.setArrowCallback(indicator.setArrow)
    },
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

function openPause() {
  pause.open()
}

function closePause() {
  pause.close()
  if (!dialogue.active.value) _fps?.lock()
}

function returnToHome() {
  pause.close()
  sceneManager?.dispose()
  experience?.dispose()
  sceneManager = null
  experience   = null
  _fps         = null
  isStarted.value = false
}

function onVolumeChange(v) {
  volume.value = v
  experience?.sound.setVolume('master', v)
}

function _onKeyDown(e) {
  if (e.code !== 'Escape' || !isStarted.value || dialogue.active.value) return
  if (pause.isPaused.value) closePause()
  else openPause()
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

onMounted(()        => window.addEventListener('keydown', _onKeyDown))
onBeforeUnmount(()  => window.removeEventListener('keydown', _onKeyDown))

onUnmounted(() => {
  sceneManager?.dispose()
  experience?.dispose()
  sceneManager = null
  experience   = null
  _fps         = null
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
