<template>
  <Transition name="quest">
    <div v-if="currentStep" class="quest-hud">

      <div class="quest-act">
        <span class="quest-act-label">{{ actLabel }}</span>
      </div>

      <div class="quest-block">
        <div class="quest-prog-header">
          <span>Progression</span>
          <span>{{ progressPct }}%</span>
        </div>
        <div class="quest-bar-track">
          <div class="quest-bar-fill" :style="{ width: progressPct + '%' }" />
        </div>
      </div>

      <div class="quest-block">
        <div class="quest-meta">
          <span class="quest-meta-title">Quêtes</span>
        </div>
        <hr class="quest-sep" />
        <div class="quest-name">{{ currentStep.label }}</div>
        <div v-if="currentStep.hint" class="quest-hint">{{ currentStep.hint }}</div>
      </div>

    </div>
  </Transition>
</template>

<script setup>
const props = defineProps({
  actLabel:    { type: String, default: '' },
  currentStep: { type: Object, default: null },
  stepIndex:   { type: Number, default: 0 },
  totalSteps:  { type: Number, default: 0 },
})

const progressPct = computed(() =>
  props.totalSteps > 0
    ? Math.round((props.stepIndex / props.totalSteps) * 100)
    : 0
)
</script>

<style scoped>
.quest-hud {
  position: fixed;
  top: 24px;
  left: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 333px;
  pointer-events: none;
  z-index: 400;
}

.quest-act {
  background: var(--color-white);
  padding: 20px;
  box-shadow: 0 0 5px rgba(142, 184, 184, 0.75);
}

.quest-act-label {
  font-size: 24px;
  font-weight: 500;
  line-height: 25px;
  color: var(--color-black);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.quest-block {
  background: var(--color-white);
  padding: 20px;
  box-shadow: 0 0 5px rgba(142, 184, 184, 0.75);
}

.quest-block:last-child {
  max-height: 356px;
  overflow-y: auto;
}

.quest-prog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 18px;
  font-weight: 500;
  line-height: 20px;
  color: var(--color-black);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.quest-bar-track {
  height: 8px;
  background: rgba(255, 96, 56, 0.25);
  overflow: hidden;
}

.quest-bar-fill {
  height: 100%;
  background: var(--color-orange);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
  transition: width 0.6s ease;
}

.quest-meta {
  margin-bottom: 0;
}

.quest-meta-title {
  font-size: 18px;
  font-weight: 500;
  line-height: 20px;
  color: var(--color-black);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.quest-sep {
  border: none;
  border-top: 1px solid var(--color-black);
  margin: 18px 0;
  opacity: 0.2;
}

.quest-name {
  font-size: 16px;
  font-weight: 500;
  line-height: 20px;
  color: var(--color-orange);
  margin-bottom: 12px;
}

.quest-hint {
  font-size: 16px;
  font-weight: 400;
  line-height: 20px;
  color: var(--color-black);
}

.quest-enter-active { transition: opacity 0.35s ease, transform 0.35s ease; }
.quest-leave-active { transition: opacity 0.25s ease; }
.quest-enter-from   { opacity: 0; transform: translateX(-12px); }
.quest-leave-to     { opacity: 0; }
</style>
