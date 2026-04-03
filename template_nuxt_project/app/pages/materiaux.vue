<template>
  <canvas ref="canvas" />

  <UiAppNav />

  <UiMaterialLabel
    v-for="lbl in labels"
    :key="lbl.name"
    :x="lbl.x"
    :y="lbl.y"
    :name="lbl.name"
    :description="lbl.description"
  />
</template>

<script setup>
import Experience    from '~/utils/three/Experience.js'
import MateriauxWorld from '~/utils/three/world/MateriauxWorld.js'

const canvas = useTemplateRef('canvas')

const labels = ref([
  { name: 'Plexiglass', description: 'Acrylique · IOR 1.48', x: 0, y: 0 },
  { name: 'Verre',      description: 'Crystal · IOR 1.52',   x: 0, y: 0 },
  { name: 'Bois',       description: 'Chêne · PBR naturel',  x: 0, y: 0 },
  { name: 'Eau',        description: 'Fresnel · IOR 1.33',   x: 0, y: 0 },
])

let experience = null

onMounted(() => {
  experience = new Experience(canvas.value)
  const world = new MateriauxWorld(experience, (positions) => {
    positions.forEach((pos, i) => {
      labels.value[i].x = pos.x
      labels.value[i].y = pos.y
    })
  })
  experience.setWorld(world)
})

onUnmounted(() => {
  experience?.dispose()
  experience = null
})
</script>
