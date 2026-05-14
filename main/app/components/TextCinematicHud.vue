<template>
  <Transition name="overlay">
    <div v-if="active" class="text-cinematic">
      <Transition name="card">
        <div v-if="visible && card" :key="card.title ?? card.text" class="text-cinematic__card">
          <p v-if="card.title" class="text-cinematic__title">{{ card.title }}</p>
          <p v-if="card.subtitle" class="text-cinematic__subtitle">{{ card.subtitle }}</p>
          <p v-if="card.text" class="text-cinematic__text" style="white-space: pre-line">{{ card.text }}</p>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  active:  { type: Boolean, required: true },
  visible: { type: Boolean, default: false },
  card:    { type: Object,  default: null  },
})
</script>

<style scoped>
.text-cinematic {
  position: fixed;
  inset: 0;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 800;
}

.text-cinematic__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 0 clamp(24px, 8vw, 120px);
  text-align: center;
  max-width: 820px;
}

.text-cinematic__title {
  font-size: clamp(1.4rem, 4vw, 2.8rem);
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #fff;
}

.text-cinematic__subtitle {
  font-size: clamp(0.85rem, 2vw, 1.1rem);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.45);
}

.text-cinematic__text {
  font-size: clamp(0.95rem, 2.2vw, 1.2rem);
  line-height: 1.75;
  color: rgba(255, 255, 255, 0.80);
  max-width: 60ch;
}

/* Overlay — apparaît instantanément, disparaît avec fondu */
.overlay-leave-active { transition: opacity 0.4s ease; }
.overlay-leave-to     { opacity: 0; }

/* Card — fade de chaque carte */
.card-enter-active { transition: opacity 0.4s ease; }
.card-leave-active { transition: opacity 0.4s ease; }
.card-enter-from,
.card-leave-to     { opacity: 0; }
</style>
