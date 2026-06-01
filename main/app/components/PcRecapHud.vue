<template>
  <Transition name="pc-recap">
    <div v-if="visible" class="recap-root">
      <div class="recap-screen">

        <div class="recap-header">
          <span class="recap-corp">NEXORA CORP.</span>
          <span class="recap-title">RAPPORT DE MISSION</span>
          <span class="recap-date">{{ date }}</span>
        </div>

        <hr class="recap-sep" />

        <p class="recap-section-label">MISSIONS EFFECTUÉES</p>

        <ul class="recap-list">
          <li v-for="mission in missions" :key="mission.id" class="recap-item">
            <span class="recap-check">✓</span>
            <span class="recap-item-label">{{ mission.label }}</span>
          </li>
        </ul>

        <hr class="recap-sep" />

        <p class="recap-status">Statut : <span class="recap-status--ok">OPÉRATIONNEL</span></p>

        <button class="recap-btn" @click="$emit('confirm')">
          Valider et terminer la mission
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4,2 10,7 4,12"/>
          </svg>
        </button>

      </div>
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
})

defineEmits(['confirm'])

const date = new Date().toLocaleDateString('fr-FR', {
  year: 'numeric', month: 'long', day: 'numeric',
})

const missions = [
  { id: 'talk_npc', label: 'Briefing avec le technicien' },
  { id: 'use_pc',   label: 'Accès au PC de bureau' },
  { id: 'pick_tool', label: 'Récupération de l\'équipement AR' },
  { id: 'exit_door', label: 'Sortie du bureau sécurisé' },
]
</script>

<style scoped>
.recap-root {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.75);
  z-index: 500;
}

.recap-screen {
  width: min(560px, 90vw);
  background: #0a0a0a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 36px 40px 32px;
  font-family: 'Courier New', monospace;
}

.recap-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 20px;
}

.recap-corp {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: rgba(255, 255, 255, 0.35);
}

.recap-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #fff;
}

.recap-date {
  font-size: 10px;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.3);
  margin-top: 2px;
}

.recap-sep {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin: 20px 0;
}

.recap-section-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: rgba(255, 255, 255, 0.3);
  margin-bottom: 14px;
}

.recap-list {
  list-style: none;
  padding: 0;
  margin: 0 0 4px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.recap-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.recap-check {
  color: #4caf72;
  font-size: 13px;
  flex-shrink: 0;
}

.recap-item-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  letter-spacing: 0.02em;
}

.recap-status {
  font-size: 11px;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.35);
}

.recap-status--ok {
  color: #4caf72;
  font-weight: 700;
}

.recap-btn {
  margin-top: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 14px 24px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 3px;
  color: #fff;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.recap-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.3);
}

/* Transition */
.pc-recap-enter-active { transition: opacity 0.25s, transform 0.25s; }
.pc-recap-leave-active { transition: opacity 0.2s,  transform 0.2s; }
.pc-recap-enter-from   { opacity: 0; transform: translateY(16px) scale(0.98); }
.pc-recap-leave-to     { opacity: 0; transform: translateY(8px)  scale(0.99); }
</style>
