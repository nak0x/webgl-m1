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
          <span class="quest-icon">ⓘ</span>
          <div>
            <div class="quest-meta-title">Quêtes</div>
            <div class="quest-meta-sub">Missions à accomplir</div>
          </div>
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
  gap: 12px;
  width: 300px;
  pointer-events: none;
  z-index: 400;
}

.quest-act {
  background: #000;
  padding: 16px 20px;
  border-radius: 4px;
}

.quest-act-label {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}

.quest-block {
  background: #000;
  padding: 16px 20px;
  border-radius: 4px;
}

.quest-prog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.quest-bar-track {
  height: 8px;
  background: #444;
  border-radius: 4px;
  overflow: hidden;
}

.quest-bar-fill {
  height: 100%;
  background: #fff;
  border-radius: 4px;
  transition: width 0.6s ease;
}

.quest-meta {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.quest-icon {
  font-size: 18px;
  color: #fff;
  flex-shrink: 0;
  margin-top: 1px;
}

.quest-meta-title {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
}

.quest-meta-sub {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 2px;
}

.quest-sep {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  margin: 14px 0;
}

.quest-name {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 8px;
}

.quest-hint {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.75);
  line-height: 1.55;
}

.quest-enter-active { transition: opacity 0.35s ease, transform 0.35s ease; }
.quest-leave-active { transition: opacity 0.25s ease; }
.quest-enter-from   { opacity: 0; transform: translateX(-12px); }
.quest-leave-to     { opacity: 0; }
</style>
