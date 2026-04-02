<template>
  <div class="stat-card card">
    <div class="stat-icon" :style="{ background: iconBg, color: iconColor }">
      <span v-html="icon"></span>
    </div>
    <div class="stat-content">
      <span class="stat-value">{{ value }}</span>
      <span class="stat-label">{{ label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  value: string | number
  label: string
  icon: string
  iconBg?: string
  iconColor?: string
}>()
</script>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1;
  color: var(--text-primary);
}

.stat-label {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: var(--space-1);
  font-weight: 500;
}
</style>
