<template>
  <Transition name="start" @after-leave="onAfterLeave">
    <div v-if="visible" class="start-screen">
      <div class="start-screen__content">
        <p class="start-screen__eyebrow">Une expérience interactive</p>
        <h1 class="start-screen__title">L'Atelier</h1>
        <p class="start-screen__hint">Utilisez WASD pour vous déplacer · E pour interagir</p>
        <button class="start-screen__btn" @click="launch">
          Lancer l'expérience
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
const emit = defineEmits(['start'])

const visible = ref(true)

function launch() {
  visible.value = false
}

function onAfterLeave() {
  emit('start')
}
</script>

<style scoped>
.start-screen {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}

.start-screen__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  text-align: center;
}

.start-screen__eyebrow {
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #88aaff;
  opacity: 0.8;
}

.start-screen__title {
  font-size: clamp(2.5rem, 8vw, 5rem);
  font-weight: 300;
  letter-spacing: 0.1em;
  color: #fff;
  line-height: 1;
}

.start-screen__hint {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 0.05em;
}

.start-screen__btn {
  margin-top: 12px;
  padding: 14px 40px;
  background: transparent;
  border: 1px solid rgba(136, 170, 255, 0.5);
  border-radius: 2px;
  color: #88aaff;
  font-size: 0.85rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 200ms ease, border-color 200ms ease, color 200ms ease;
}

.start-screen__btn:hover {
  background: rgba(136, 170, 255, 0.1);
  border-color: #88aaff;
  color: #fff;
}

.start-transition-leave-active {
  transition: opacity 600ms ease;
}

.start-transition-leave-to {
  opacity: 0;
}
</style>
