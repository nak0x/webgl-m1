<template>
  <Transition name="quest">
    <div v-if="currentStep" class="quest-hud">
      <p class="quest-label">Objectif</p>
      <p class="quest-title">{{ currentStep.label }}</p>
      <p v-if="currentStep.hint" class="quest-hint">{{ currentStep.hint }}</p>
      <p class="quest-progress">{{ stepIndex + 1 }} / {{ totalSteps }}</p>
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  currentStep: { type: Object, default: null   },
  stepIndex:   { type: Number, default: 0      },
  totalSteps:  { type: Number, default: 0      },
})
</script>

<style scoped>
.quest-hud {
  position: fixed;
  top: 24px;
  right: 24px;
  background: rgba(8, 8, 12, 0.82);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 12px 16px;
  min-width: 200px;
  backdrop-filter: blur(6px);
  pointer-events: none;
  z-index: 400;
}

.quest-label {
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #88aaff;
  margin-bottom: 4px;
}

.quest-title {
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  line-height: 1.4;
}

.quest-hint {
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  margin-top: 4px;
}

.quest-progress {
  font-size: 10px;
  color: rgba(255,255,255,0.3);
  margin-top: 8px;
  font-variant-numeric: tabular-nums;
}

.quest-enter-active { transition: opacity 0.3s, transform 0.3s; }
.quest-leave-active { transition: opacity 0.2s; }
.quest-enter-from   { opacity: 0; transform: translateX(10px); }
.quest-leave-to     { opacity: 0; }
</style>
