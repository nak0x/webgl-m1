<template>
  <Transition name="loading">
    <div v-if="visible" class="loading-hud">
      <div class="loading-hud__track">
        <div class="loading-hud__fill" :style="{ width: `${progress * 100}%` }" />
      </div>
      <p class="loading-hud__pct">{{ Math.round(progress * 100) }}%</p>
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  visible:  { type: Boolean, default: false },
  progress: { type: Number,  default: 0 },
})
</script>

<style scoped>
.loading-hud {
  position: fixed;
  bottom: 48px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  z-index: 1001;
}

.loading-hud__track {
  width: 260px;
  height: 1px;
  background: rgba(255, 255, 255, 0.15);
  overflow: hidden;
}

.loading-hud__fill {
  height: 100%;
  background: rgba(136, 170, 255, 0.8);
  transition: width 150ms ease-out;
}

.loading-hud__pct {
  font-size: 10px;
  font-family: monospace;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 0.1em;
}

.loading-enter-active,
.loading-leave-active {
  transition: opacity 250ms ease;
}

.loading-enter-from,
.loading-leave-to {
  opacity: 0;
}
</style>
