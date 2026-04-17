<template>
  <canvas ref="canvas" />
</template>

<script setup>
import Experience     from '~/utils/three/Experience.js'
import AtelierWorld   from '~/utils/three/world/AtelierWorld.js'
import AtelierSources from '~/utils/three/world/AtelierSources.js'

const canvas = useTemplateRef('canvas')

let experience = null

onMounted(() => {
  experience = new Experience(canvas.value, AtelierSources)
  const world = new AtelierWorld(experience)
  experience.setWorld(world)
})

onUnmounted(() => {
  experience?.dispose()
  experience = null
})
</script>
