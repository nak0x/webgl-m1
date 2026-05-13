import * as THREE from '/lib/three.js'

/**
 * useQuestIndicatorState — bridge réactif pour la flèche directionnelle de quête.
 *
 * Le QuestIndicatorManager appelle setArrow(worldPos) à chaque frame quand une porte est active.
 * Le composant QuestArrowHud lit arrowVisible et arrowAngle.
 */

const arrowVisible = ref(false)
const arrowAngle   = ref(0)

const _ndc    = new THREE.Vector3()
const _camera = { instance: null }

export function useQuestIndicatorState() {
  function bindCamera(cameraInstance) {
    _camera.instance = cameraInstance
  }

  function setArrow(worldPos) {
    if (!worldPos) {
      arrowVisible.value = false
      return
    }

    if (!_camera.instance) return

    _ndc.copy(worldPos).project(_camera.instance)

    // Si la cible est dans le frustum visible → pas de flèche
    if (_ndc.z <= 1 && Math.abs(_ndc.x) <= 1 && Math.abs(_ndc.y) <= 1) {
      arrowVisible.value = false
      return
    }

    // Calcul de l'angle depuis le centre de l'écran vers le bord
    arrowAngle.value   = Math.atan2(_ndc.x, _ndc.y) * (180 / Math.PI)
    arrowVisible.value = true
  }

  return { arrowVisible, arrowAngle, setArrow, bindCamera }
}
