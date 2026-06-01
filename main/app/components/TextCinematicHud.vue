<template>
  <Transition name="overlay">
    <div v-if="active" class="text-cinematic">

      <!-- Fond : image optionnelle + overlay beige -->
      <div class="text-cinematic__bg" aria-hidden="true">
        <img v-if="backgroundImage" :src="backgroundImage" alt="" class="text-cinematic__bg-img" />
        <div class="text-cinematic__bg-overlay" :class="{ 'text-cinematic__bg-overlay--solid': !backgroundImage }" />
      </div>

      <!-- Texte centré -->
      <Transition name="card">
        <div v-if="visible && card" :key="card.title ?? card.text" class="text-cinematic__card">
          <p v-if="card.title"    class="text-cinematic__title">{{ card.title }}</p>
          <p v-if="card.subtitle" class="text-cinematic__subtitle">{{ card.subtitle }}</p>
          <p v-if="card.text"     class="text-cinematic__text" style="white-space: pre-line">{{ card.text }}</p>
        </div>
      </Transition>

    </div>
  </Transition>
</template>

<script setup>
defineProps({
  active:          { type: Boolean, required: true },
  visible:         { type: Boolean, default: false },
  card:            { type: Object,  default: null  },
  backgroundImage: { type: String,  default: null  },
})
</script>

<style scoped>
.text-cinematic {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 800;
}

/* ── Fond ── */

.text-cinematic__bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.text-cinematic__bg-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.text-cinematic__bg-overlay {
  position: absolute;
  inset: 0;
  background: rgba(239, 234, 223, 0.75);
}

.text-cinematic__bg-overlay--solid {
  background: #efeadf;
}

/* ── Carte texte ── */

.text-cinematic__card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: min(672px, 90vw);
  text-align: center;
  padding: 0 24px;
}

.text-cinematic__title {
  font-family: 'Fira Sans', system-ui, sans-serif;
  font-size: 32px;
  font-weight: 700;
  line-height: 32px;
  color: var(--color-black);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.text-cinematic__subtitle {
  font-family: 'Fira Sans', system-ui, sans-serif;
  font-size: 16px;
  font-weight: 400;
  line-height: 20px;
  color: rgba(45, 29, 27, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.text-cinematic__text {
  font-family: 'Fira Sans', system-ui, sans-serif;
  font-size: 16px;
  font-weight: 400;
  line-height: 20px;
  color: var(--color-black);
  max-width: 60ch;
}

/* ── Transitions ── */

.overlay-enter-active { transition: opacity 0.5s ease; }
.overlay-leave-active { transition: opacity 0.5s ease; }
.overlay-enter-from,
.overlay-leave-to     { opacity: 0; }

.card-enter-active { transition: opacity 0.4s ease; }
.card-leave-active { transition: opacity 0.3s ease; }
.card-enter-from,
.card-leave-to     { opacity: 0; }
</style>
