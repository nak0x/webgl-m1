/**
 * useQuestState — état réactif Vue du QuestManager.
 *
 * Usage :
 *   const quest = useQuestState()
 *   quest.bind(questManagerInstance)
 *
 *   // Dans le template :
 *   <QuestHud :step="quest.currentStep.value" />
 */

let _manager = null

const currentStep = ref(null)    // { id, label, hint }
const stepIndex   = ref(0)
const totalSteps  = ref(0)
const completed   = ref(false)

export function useQuestState() {
  function bind(manager) {
    _manager          = manager
    totalSteps.value  = manager.totalSteps
    completed.value   = false

    manager.on('step:active', ({ step, index }) => {
      currentStep.value = step
      stepIndex.value   = index
    })

    manager.on('step:complete', ({ index }) => {
      stepIndex.value = index
    })

    manager.on('quest:complete', () => {
      currentStep.value = null
      completed.value   = true
    })
  }

  return { currentStep, stepIndex, totalSteps, completed, bind }
}
