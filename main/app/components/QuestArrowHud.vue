<template>
  <Transition name="arrow">
    <div v-if="arrowVisible" class="quest-arrow" :style="arrowStyle">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 4L20 18H4L12 4Z" fill="#FFD700" />
      </svg>
    </div>
  </Transition>
</template>

<script setup>
const props = defineProps({
  arrowVisible: { type: Boolean, default: false },
  arrowAngle:   { type: Number,  default: 0     },
})

const EDGE_MARGIN = 48

const arrowStyle = computed(() => {
  const rad    = (props.arrowAngle - 180) * (Math.PI / 180)
  const cos    = Math.cos(rad)
  const sin    = Math.sin(rad)

  // Position sur le bord de l'écran en pourcentage
  const aspect = window.innerWidth / window.innerHeight
  const tx     = Math.max(EDGE_MARGIN, Math.min(window.innerWidth  - EDGE_MARGIN, window.innerWidth  / 2 + sin * (window.innerWidth  / 2 - EDGE_MARGIN)))
  const ty     = Math.max(EDGE_MARGIN, Math.min(window.innerHeight - EDGE_MARGIN, window.innerHeight / 2 - cos * (window.innerHeight / 2 - EDGE_MARGIN)))

  return {
    left:      tx + 'px',
    top:       ty + 'px',
    transform: `translate(-50%, -50%) rotate(${props.arrowAngle}deg)`,
  }
})
</script>

<style scoped>
.quest-arrow {
  position: fixed;
  width: 32px;
  height: 32px;
  pointer-events: none;
  z-index: 500;
  filter: drop-shadow(0 0 6px rgba(255, 215, 0, 0.7));
}

.quest-arrow svg {
  width: 100%;
  height: 100%;
}

.arrow-enter-active { transition: opacity 0.3s; }
.arrow-leave-active { transition: opacity 0.2s; }
.arrow-enter-from,
.arrow-leave-to     { opacity: 0; }
</style>
