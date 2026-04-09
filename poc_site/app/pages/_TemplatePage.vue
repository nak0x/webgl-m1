<template>
  <!-- Canvas Three.js — toujours présent -->
  <canvas ref="canvas" />

  <!-- Navigation -->
  <UiAppNav />

  <!--
    TODO: UI Vue réactive ici si besoin.
    Les données 3D remontent via les callbacks du World.
    Exemple :
      <div class="overlay">Score : {{ score }}</div>
  -->
</template>

<script setup>
// TODO: remplacer par le nom de ton World et tes sources
import Experience       from '~/utils/three/Experience.js'
import TemplateWorld    from '~/utils/three/world/_TemplateWorld.js'
import templateSources  from '~/utils/three/world/_templateSources.js'

const canvas = useTemplateRef('canvas')

// TODO: déclarer ici les refs Vue que ton World met à jour via callbacks
// const score = ref(0)

let experience = null

onMounted(() => {
  experience = new Experience(canvas.value, templateSources)

  const world = new TemplateWorld(experience /*, callbacks si besoin */)

  // Exemple de callback pour faire remonter des données 3D vers Vue :
  // const world = new TemplateWorld(experience, {
  //   onScoreChange: (val) => { score.value = val },
  // })

  experience.setWorld(world)
})

onUnmounted(() => {
  experience?.dispose()
  experience = null
})
</script>
