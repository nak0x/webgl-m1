<template>
  <canvas ref="canvas" />

  <StartHud v-if="!isStarted" @start="startExperience" />

  <template v-if="isStarted && !pc.isActive.value && !uiHidden">
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

    <RepairHud
      :repair="repair.activeRepair.value"
      :xray-active="repair.xrayRepairId.value !== null"
      @confirm="(id, action) => repair.confirmRepair(id, action)"
    />
    <VehicleInfoHud
      :vehicle="repair.vehicleInfo.value"
      :meta="repair.vehicleMeta.value"
      :can-complete="repair.allDone.value"
      @complete="onRepairComplete"
    />

    <InteractPromptHud
      :visible="interactPrompt.visible.value"
      :text="interactPrompt.text.value"
    />
  </template>

  <TextCinematicHud
    :active="textCinematic.active.value"
    :visible="textCinematic.visible.value"
    :card="textCinematic.card.value"
    :background-image="textCinematic.backgroundImage.value"
  />

  <PauseHud
    :visible="pause.isPaused.value"
    :volumes="volumes"
    @close="closePause"
    @return-home="returnToHome"
    @volume-change="onVolumeChange"
  />

  <PcRecapHud
    :visible="isPcRecap"
    @confirm="onGameEnd"
  />

  <EndHud
    :visible="isGameEnded"
    @home="onReturnHome"
    @replay="onReplay"
  />

  <LoadingHud :visible="isLoadingScene" :progress="loadingProgress" />

  <button
    v-if="pc.isActive.value && pc.tutoDone.value && !uiHidden"
    class="pc-exit-btn"
    @click="exitPc"
  >
    Quitter
  </button>

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
import { usePcState }             from '~/composables/usePcState.js'
import { useRepairState }         from '~/composables/useRepairState.js'
import { useInteractPrompt }      from '~/composables/useInteractPrompt.js'

const canvas        = useTemplateRef('canvas')
const quest         = useQuestState()
const dialogue      = useDialogueState()
const glasses       = useGlassesState()
const pause         = usePauseState()
const cinematic     = useCinematicState()
const textCinematic = useTextCinematic()
const indicator     = useQuestIndicatorState()
const pc            = usePcState()
const repair        = useRepairState()
const interactPrompt = useInteractPrompt()
const isFading      = ref(false)
const isStarted     = ref(false)
const uiHidden      = ref(false)
const isPcRecap     = ref(false)
const isGameEnded   = ref(false)
const volumes       = ref({ master: 1, ambient: 0.4, voice: 0.8 })

const isLoadingScene  = ref(false)
const loadingProgress = ref(0)

const endCreditsCards = [
  { title: 'Adoptez le réflexe de demain', duration: 3500 },
  { text: 'Parce que prendre soin de notre flotte citoyenne exige des outils à la hauteur de nos engagements, facilitez vos interventions dès aujourd\'hui : prenez vos lunettes de réalité augmentée, pilotez vos alertes via le CRM et simplifiez votre quotidien au service d\'Altera !', duration: 7000 },
]

const FADE_MS = 400

let experience    = null
let sceneManager  = null
let _fps          = null
let _pendingRepair = null

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
    onWorldReady:    ({ repairData, markerManager }) => repair.bind(markerManager, repairData),
    onXrayChange:    (id) => { repair.xrayRepairId.value = id },
    onRepairDispose: () => repair.unbind(),
    onRepairContext: () => _pendingRepair,
    onPromptShow:    (text) => interactPrompt.show(text),
    onPromptHide:    ()     => interactPrompt.hide(),
    transitionTo,
    onPcRecap:       () => { isPcRecap.value = true },
    onGameEnd,
    onLoadProgress:  (pct) => { loadingProgress.value = pct },
  }
}

function transitionTo(name, { skipFlow = false, repairContext = null } = {}) {
  const scene = SCENES[name]
  if (!scene) return
  if (repairContext) _pendingRepair = repairContext
  interactPrompt.hide()
  _fps?.hideCrosshair()
  experience?.sound.fadeOutAndStop(FADE_MS)
  isFading.value = true
  const steps = skipFlow ? [] : scene.flow
  setTimeout(() => {
    experience.flow.run(steps, name)
  }, FADE_MS)
}

function onRepairComplete() {
  transitionTo('scene_4')
}

function exitPc() {
  window.postMessage({ type: 'pcscreen:exit' }, '*')
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

async function onGameEnd() {
  isPcRecap.value = false
  experience?.sound.fadeOutAndStop(FADE_MS)
  isFading.value = true
  await new Promise(r => setTimeout(r, FADE_MS))
  await textCinematic.play(endCreditsCards)
  isFading.value = false
  isGameEnded.value = true
}

function onReturnHome() {
  isGameEnded.value = false
  returnToHome()
}

function onReplay() {
  isGameEnded.value = false
  sceneManager?.dispose()
  experience?.dispose()
  sceneManager = null
  experience   = null
  _fps         = null
  startExperience()
}

function onVolumeChange({ category, value }) {
  volumes.value[category] = value
  experience?.sound.setVolume(category, value)
}

function _onKeyDown(e) {
  if (!isStarted.value) return

  if (e.code === 'KeyH') {
    uiHidden.value = !uiHidden.value
    return
  }

  if (e.code !== 'Escape' || dialogue.active.value) return
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
  folder.add(state, 'scene', SCENE_NAMES).name('Aller à').onChange(name => transitionTo(name, { skipFlow: true }))
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

.pc-exit-btn {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-orange);
  color: var(--color-black);
  border: none;
  padding: 14px 48px;
  font-family: 'Fira Sans', system-ui, sans-serif;
  font-size: 16px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  box-shadow: 0 0 3px rgba(45, 29, 27, 0.25);
  z-index: 760;
  transition: filter 0.15s;
}

.pc-exit-btn:hover { filter: brightness(1.08); }
</style>
