<template>
  <Transition name="interact-prompt">
    <div v-if="visible" class="interact-prompt">
      <span class="interact-prompt__key">E</span>
      <span class="interact-prompt__text">{{ text }}</span>
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  text:    { type: String,  default: '' },
})
</script>

<style scoped>
.interact-prompt {
  position: fixed;
  left: 50%;
  bottom: 18%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px 10px 12px;
  background: rgba(10, 10, 20, 0.82);
  backdrop-filter: blur(8px);
  border-radius: 8px;
  pointer-events: none;
  z-index: 420;
}

.interact-prompt__key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 30px;
  padding: 0 6px;
  background: var(--color-orange, #ff6038);
  color: #1a1a1a;
  font-family: 'Fira Sans', system-ui, sans-serif;
  font-size: 1rem;
  font-weight: 700;
  border-radius: 5px;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.35);
}

.interact-prompt__text {
  color: #fff;
  font-size: 0.86rem;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.interact-prompt-enter-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.interact-prompt-leave-active { transition: opacity 0.15s ease; }
.interact-prompt-enter-from   { opacity: 0; transform: translate(-50%, 6px); }
.interact-prompt-leave-to     { opacity: 0; }
</style>
