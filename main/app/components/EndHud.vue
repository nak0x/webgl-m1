<template>
  <Transition name="end">
    <div v-if="visible" class="end-root">
      <div class="end-content">

        <p class="end-corp">NEXORA CORP.</p>
        <h1 class="end-title">Fin de mission</h1>
        <p class="end-message">
          L'atelier est de nouveau opérationnel.<br>
          Rapport transmis au hub central.
        </p>

        <div class="end-actions">
          <button class="end-btn end-btn--primary" @click="$emit('replay')">
            Rejouer
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

defineEmits(['replay'])
</script>

<style scoped>
.end-root {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  z-index: 900;
}

.end-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
  padding: 0 24px;
}

.end-corp {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.22em;
  color: rgba(255, 255, 255, 0.25);
  font-family: 'Courier New', monospace;
}

.end-title {
  font-size: clamp(28px, 5vw, 48px);
  font-weight: 300;
  letter-spacing: 0.06em;
  color: #fff;
  margin: 0;
}

.end-message {
  font-size: 14px;
  line-height: 1.8;
  color: rgba(255, 255, 255, 0.45);
  max-width: 380px;
  margin-top: 4px;
}

.end-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.end-btn {
  padding: 12px 32px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
}

.end-btn--primary {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.35);
}

.end-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.5);
  color: #fff;
}

/* Transition */
.end-enter-active { transition: opacity 0.6s ease; }
.end-leave-active { transition: opacity 0.3s ease; }
.end-enter-from   { opacity: 0; }
.end-leave-to     { opacity: 0; }
</style>
