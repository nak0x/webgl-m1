<template>
  <canvas ref="canvas" />

  <UiAppNav />

  <UiHudBadge v-if="isEmbedded" position="bottom-center">
    Vue embarquée · ESC ou clic pour quitter
  </UiHudBadge>

  <UiHudBadge position="bottom-left" color="blue">
    A / Z : changer caméra · Clic cube : vue embarquée
  </UiHudBadge>
</template>

<script setup>
import Experience  from '~/utils/three/Experience.js'
import MainWorld   from '~/utils/three/world/MainWorld.js'
import mainSources from '~/utils/three/world/mainSources.js'

const canvas     = useTemplateRef('canvas')
const isEmbedded = ref(false)

let experience = null

onMounted(() => {
  experience = new Experience(canvas.value, mainSources)
  const world = new MainWorld(experience, {
    onEmbeddedChange: (val) => { isEmbedded.value = val },
  })
  experience.setWorld(world)
})

onUnmounted(() => {
  experience?.dispose()
  experience = null
})
</script>
