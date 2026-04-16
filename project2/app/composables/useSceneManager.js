/**
 * useSceneManager — état réactif global du SceneManager.
 *
 * Singleton : une seule instance partagée entre tous les composants.
 * Expose goToScene(name) et transitionTo(name) depuis n'importe où.
 *
 * Usage :
 *   const { currentScene, isLoading, isTransitioning, sceneState, goToScene, getWorld } = useSceneManager()
 *   goToScene('carXray')         // switch instantané
 *   transitionTo('carXray')      // switch avec fade noir
 *   goToScene('start')           // retour au StartScreen
 */
import SceneManager      from '~/utils/three/SceneManager.js'
import CarXrayWorld      from '~/utils/three/world/CarXrayWorld.js'
import CarXraySources    from '~/utils/three/world/CarXraySources.js'
import DoorWorld         from '~/utils/three/world/DoorWorld.js'
import DoorSources       from '~/utils/three/world/DoorSources.js'
import CinematicPlayer   from '~/utils/three/world/CinematicPlayer.js'
import CinematicSources  from '~/utils/three/world/CinematicSources.js'
import { XRAY_DEFAULTS } from '~/utils/three/materials/createXray.js'

// ── Singleton state ─────────────────────────────────────────────
let _manager = null

const currentScene    = ref('start')
const isLoading       = ref(false)
const isTransitioning = ref(false)
const sceneState      = reactive({})

// ── Registry des scènes ─────────────────────────────────────────
// Ajouter une scène ici suffit : le StartScreen la liste automatiquement.
// buildCallbacks reçoit (state, actions) — actions expose transitionTo.
const SCENES = {
  carXray: {
    label:       'Car X-Ray',
    description: 'Diagnostic radiographique du véhicule',
    World:   CarXrayWorld,
    sources: CarXraySources,
    initialState: () => ({
      parts:       [],
      hoveredPart: null,
      shader:      { ...XRAY_DEFAULTS },
    }),
    buildCallbacks: (state, _actions) => ({
      onPartsReady: (list) => { state.parts       = list },
      onHighlight:  (name) => { state.hoveredPart = name },
    }),
  },

  cinematic: {
    label:       'Cinématique',
    description: 'Lecture d\'une cinématique glTF multi-caméras',
    World:   CinematicPlayer,
    sources: CinematicSources,
    initialState: () => ({
      cameraName: null,
    }),
    buildCallbacks: (state, _actions) => ({
      onCameraChange: (name) => { state.cameraName = name },
      onReady:        ()     => {},
    }),
  },

  door: {
    label:       'Porte interactive',
    description: 'Simulation FPS avec interaction de porte',
    World:   DoorWorld,
    sources: DoorSources,
    initialState: () => ({
      locked:  false,
      prompt:  null,
      message: null,
    }),
    buildCallbacks: (state, actions) => ({
      onLockChange:   (v) => { state.locked  = v },
      onPromptChange: (t) => { state.prompt  = t },
      onMessage:      (t) => { state.message = t },
      onTransition:   (name) => actions.transitionTo(name),
    }),
  },
}

export const SCENE_LIST = Object.entries(SCENES).map(([id, def]) => ({
  id,
  label:       def.label,
  description: def.description,
}))

// ── Composable ──────────────────────────────────────────────────
export function useSceneManager() {
  /** Appelé une fois depuis app.vue après création de l'Experience. */
  function init(experience) {
    _manager = new SceneManager(experience)
  }

  async function goToScene(name) {
    if (name === 'start') {
      _manager?.unload()
      _clearState()
      currentScene.value = 'start'
      return
    }

    const def = SCENES[name]
    if (!def || !_manager) return

    isLoading.value = true
    _clearState()
    Object.assign(sceneState, def.initialState())

    const callbacks = def.buildCallbacks(sceneState, { transitionTo })
    await _manager.load(def.World, def.sources, callbacks)

    currentScene.value = name
    isLoading.value    = false
  }

  /**
   * Transition avec fade noir :
   * 1. Fade in (overlay noir visible)
   * 2. Charge la scène
   * 3. Fade out
   */
  async function transitionTo(name) {
    isTransitioning.value = true
    await _wait(500)           // laisse le fade-in se terminer (CSS 400ms + marge)
    await goToScene(name)
    await _wait(80)            // micro-pause avant le fade-out
    isTransitioning.value = false
  }

  /** Accès direct au World courant pour appeler ses méthodes (ex: setPartDamage). */
  function getWorld() {
    return _manager?.world ?? null
  }

  return {
    currentScene:    readonly(currentScene),
    isLoading:       readonly(isLoading),
    isTransitioning: readonly(isTransitioning),
    sceneState,
    init,
    goToScene,
    transitionTo,
    getWorld,
    SCENE_LIST,
  }
}

// ── Helpers ─────────────────────────────────────────────────────
function _clearState() {
  Object.keys(sceneState).forEach(k => delete sceneState[k])
}

function _wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
