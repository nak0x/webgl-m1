<template>
  <Transition name="end">
    <div v-if="visible" class="end-root">

      <header class="end-header">
        <img class="end-header-logo" src="/images/home/logo-small.svg" alt="ad-hoc">
        <div class="end-header-link">
          <span class="end-header-dot"></span>
          <span>A propos</span>
        </div>
      </header>

      <div class="end-credits">
        <div class="end-titre">
          <img class="end-logo" src="/images/home/logo-adhoc.svg" alt="ad-hoc">
          <p class="end-tagline">Artisans de la maintenance</p>
        </div>

        <div class="end-roles">
          <div class="end-role">
            <p class="end-role-title">Design</p>
            <p class="end-role-names">Alice &amp; Xavier</p>
          </div>
          <div class="end-role">
            <p class="end-role-title">Développement</p>
            <p class="end-role-names">Anthony &amp; Théo</p>
          </div>
        </div>

        <div class="end-actions">
          <button class="end-btn" @click="$emit('home')">
            <svg class="end-btn-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M2 6.5 8 2l6 4.5V14a.5.5 0 0 1-.5.5h-3v-4h-5v4h-3A.5.5 0 0 1 2 14V6.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
            </svg>
            Retour à l'accueil
          </button>
          <button class="end-btn" @click="$emit('replay')">
            <svg class="end-btn-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              <path d="M13.5 2v3h-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Rejouer l'expérience
          </button>
        </div>
      </div>

    </div>
  </Transition>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
})

defineEmits(['replay', 'home'])
</script>

<style scoped>
.end-root {
  position: fixed;
  inset: 0;
  background: var(--color-white);
  z-index: 900;
  font-family: 'Fira Sans', system-ui, sans-serif;
  overflow: hidden;
}

/* ── Header ── */
.end-header {
  position: absolute;
  left: 25px; top: 26px;
  height: 50px;
  display: flex;
  align-items: center;
  gap: 24px;
}

.end-header-logo { width: 50px; height: 50px; display: block; }

.end-header-link {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 18px;
  font-weight: 400;
  color: var(--color-black);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
}

.end-header-dot { width: 6px; height: 6px; background: var(--color-black); }

/* ── Crédits ── */
.end-credits {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 72px;
}

.end-titre {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  width: 602px;
  max-width: 90vw;
}

.end-logo {
  width: 500px;
  max-width: 80vw;
  aspect-ratio: 500 / 200;
  height: auto;
  object-fit: contain;
  display: block;
}

.end-tagline {
  font-size: 24px;
  font-weight: 400;
  line-height: 25px;
  color: var(--color-black);
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.end-roles {
  display: flex;
  flex-direction: column;
  gap: 60px;
  align-items: center;
}

.end-role {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 260px;
  color: var(--color-black);
}

.end-role-title { font-size: 24px; font-weight: 500; line-height: 25px; }
.end-role-names { font-size: 18px; font-weight: 400; line-height: 20px; }

/* ── Boutons ── */
.end-actions {
  display: flex;
  gap: 20px;
  align-items: center;
}

.end-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--color-orange);
  box-shadow: 0 0 3px rgba(45, 29, 27, 0.25);
  border: none;
  padding: 14px 40px;
  font-family: 'Fira Sans', system-ui, sans-serif;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  color: var(--color-black);
  cursor: pointer;
  transition: filter 0.15s;
}

.end-btn:hover { filter: brightness(1.08); }

.end-btn-icon { width: 16px; height: 16px; flex-shrink: 0; }

/* Transition */
.end-enter-active { transition: opacity 0.6s ease; }
.end-leave-active { transition: opacity 0.3s ease; }
.end-enter-from   { opacity: 0; }
.end-leave-to     { opacity: 0; }
</style>
