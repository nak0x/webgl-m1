<template>
  <Transition name="overlay">
    <div v-if="active" class="text-cinematic" :class="[`text-cinematic--${position}`, theme ? `text-cinematic--${theme}` : '']">

      <!-- Fond -->
      <div class="text-cinematic__bg" aria-hidden="true">
        <div class="text-cinematic__bg-base" />

        <template v-if="theme === 'voiture'">
          <img class="text-cinematic__bg-voiture" src="/images/transitions/voiture-3d.png" alt="" />
          <div class="text-cinematic__bg-overlay-voiture" />
        </template>

        <template v-else-if="theme === 'ville' || theme === 'ville-soir'">
          <img class="text-cinematic__bg-city" src="/images/transitions/immeuble-2.png" alt="" />
          <img class="text-cinematic__bg-city text-cinematic__bg-city--flip" src="/images/transitions/immeuble-2.png" alt="" />
          <img class="text-cinematic__bg-ressources" src="/images/transitions/batiment-ressources.png" alt="" />
          <div class="text-cinematic__bg-overlay-ville" :class="{ 'text-cinematic__bg-overlay-ville--soir': theme === 'ville-soir' }" />
        </template>

        <template v-else-if="theme === 'lunette'">
          <img class="text-cinematic__bg-lunette" src="/images/transitions/Transition7.png" alt="" />
          <div class="text-cinematic__bg-overlay-lunette" />
        </template>

        <template v-else>
          <img v-if="backgroundImage" :src="backgroundImage" alt="" class="text-cinematic__bg-img" />
          <div class="text-cinematic__bg-overlay" :class="{ 'text-cinematic__bg-overlay--solid': !backgroundImage }" />
        </template>
      </div>

      <!-- Texte -->
      <Transition name="card">
        <div v-if="visible && card" :key="card.title ?? card.text" class="text-cinematic__card">
          <p v-if="card.title"    class="text-cinematic__title"    :style="textColor ? { color: textColor } : {}">{{ card.title }}</p>
          <p v-if="card.subtitle" class="text-cinematic__subtitle" :style="textColor ? { color: textColor } : {}">{{ card.subtitle }}</p>
          <p v-if="card.text"     class="text-cinematic__text"     :style="[{ whiteSpace: 'pre-line' }, textColor ? { color: textColor } : {}]">{{ card.text }}</p>
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
  position:        { type: String,  default: 'center', validator: v => ['left', 'center', 'right'].includes(v) },
  textColor:       { type: String,  default: null  },
  theme:           { type: String,  default: null,   validator: v => ['voiture', 'ville', 'ville-soir', 'lunette'].includes(v) },
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
  overflow: hidden;
}

.text-cinematic--left  { justify-content: flex-start; padding-left: 8%; }
.text-cinematic--right { justify-content: flex-end;   padding-right: 8%; }

/* ── Fond commun ── */

.text-cinematic__bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.text-cinematic__bg-base {
  position: absolute;
  inset: 0;
  background: linear-gradient(-55deg, #efeadf 40%, #ffa06d 120%, #ff5020 130%);
}

/* ── Fond fallback (image libre) ── */

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

/* ── Thème voiture ── */

.text-cinematic__bg-voiture {
  position: absolute;
  right: -8%;
  top: -20%;
  width: 75%;
  transform: rotate(-33.49deg);
  transform-origin: center center;
  object-fit: contain;
  pointer-events: none;
}

.text-cinematic__bg-overlay-voiture {
  position: absolute;
  inset: 0;
  background: linear-gradient(71.6deg, rgba(239, 234, 223, 0.241) 51%, rgba(7, 76, 78, 0.632) 101%);
  backdrop-filter: blur(2px);
}

/* ── Thème ville (jour + soir) ── */

.text-cinematic__bg-city {
  position: absolute;
  left: -6%;
  top: 10%;
  width: 115%;
  transform: rotate(5.35deg);
  transform-origin: center center;
  opacity: 0.45;
  object-fit: cover;
  pointer-events: none;
}

.text-cinematic__bg-city--flip {
  left: 24%;
  top: -18%;
  transform: rotate(180deg) scaleY(-1);
  opacity: 0.74;
}

.text-cinematic__bg-ressources {
  position: absolute;
  left: -33%;
  top: 3%;
  width: 107%;
  object-fit: cover;
  pointer-events: none;
}

.text-cinematic__bg-overlay-ville {
  position: absolute;
  inset: 0;
  background: linear-gradient(71.6deg, rgba(239, 234, 223, 0.207) 51%, rgba(7, 76, 78, 0.543) 101%);
}

.text-cinematic__bg-overlay-ville--soir {
  background: linear-gradient(112.4deg, rgba(239, 234, 223, 0.207) 90%, rgba(7, 76, 78, 0.543) 46%);
}

/* ── Thème lunette ── */

.text-cinematic__bg-lunette {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.text-cinematic__bg-overlay-lunette {
  position: absolute;
  inset: 0;
  background: linear-gradient(to left, rgba(7, 76, 78, 0.55) 0%, rgba(7, 76, 78, 0.1) 55%, transparent 100%);
}

/* ── Carte texte ── */

.text-cinematic__card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: min(900px, 80vw);
  text-align: center;
  padding: 0 24px;
}

.text-cinematic--left  .text-cinematic__card { align-items: flex-start; text-align: left; }
.text-cinematic--right .text-cinematic__card { align-items: flex-end;   text-align: right; }

.text-cinematic__title {
  font-family: 'Fira Sans', system-ui, sans-serif;
  font-size: clamp(32px, 3.33vw, 64px);
  font-weight: 700;
  line-height: 0.92;
  color: var(--color-black);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.text-cinematic__subtitle {
  font-family: 'Fira Sans', system-ui, sans-serif;
  font-size: clamp(12px, 0.83vw, 16px);
  font-weight: 400;
  line-height: 1.25;
  color: rgba(45, 29, 27, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.text-cinematic__text {
  font-family: 'Fira Sans', system-ui, sans-serif;
  font-size: clamp(12px, 0.83vw, 16px);
  font-weight: 400;
  line-height: 1.25;
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
