<!--
  MaterialLabel — label CSS projeté sur une sphère 3D.

  Reçoit des coordonnées écran (x, y) calculées par la page
  via `vector.project(camera)` et affiche le nom + description
  du matériau.

  Usage :
    <MaterialLabel
      v-for="lbl in labels"
      :key="lbl.name"
      :x="lbl.x"
      :y="lbl.y"
      :name="lbl.name"
      :description="lbl.description"
    />
-->
<template>
  <div
    class="material-label"
    :style="{ left: `${x}px`, top: `${y}px` }"
  >
    <span class="material-label__name">{{ name }}</span>
    <span class="material-label__desc">{{ description }}</span>
  </div>
</template>

<script setup>
defineProps({
  /** Position X en pixels (screen space) */
  x: Number,
  /** Position Y en pixels (screen space) */
  y: Number,
  /** Nom du matériau (ex: "Plexiglass") */
  name: String,
  /** Courte description (ex: "Acrylique · IOR 1.48") */
  description: String,
})
</script>

<style scoped>
.material-label {
  position: fixed;
  transform: translate(-50%, 0);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  pointer-events: none;
  text-align: center;
  z-index: 50;
}

.material-label__name {
  color: #ffffff;
  font-size: 0.88rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.9);
}

.material-label__desc {
  color: rgba(200, 220, 255, 0.7);
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.9);
}
</style>
