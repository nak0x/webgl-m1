<template>
  <canvas ref="canvas" />

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

<script setup>
import Experience     from '~/utils/three/Experience.js'
import AtelierWorld   from '~/utils/three/world/AtelierWorld.js'
import AtelierSources from '~/utils/three/world/AtelierSources.js'
import { useQuestState }    from '~/composables/useQuestState.js'
import { useDialogueState } from '~/composables/useDialogueState.js'

const canvas   = useTemplateRef('canvas')
const quest    = useQuestState()
const dialogue = useDialogueState()

let experience = null

onMounted(() => {
  experience = new Experience(canvas.value, AtelierSources)

  const world = new AtelierWorld(experience, {
    // Bind les composables Vue dès que les managers sont prêts
    onQuestReady:    (mgr) => quest.bind(mgr),
    onDialogueReady: (mgr) => dialogue.bind(mgr),

    // Ouvrir une page web (step PC)
    onOpenWebPage: () => {
      // ex: window.open('https://...', '_blank')
    },

    // Changer de scène (step porte finale)
    transitionTo: (name) => {
      // ex: navigateTo(`/${name}`)
    },
  })

  experience.setWorld(world)
})

onUnmounted(() => {
  experience?.dispose()
  experience = null
})
</script>
