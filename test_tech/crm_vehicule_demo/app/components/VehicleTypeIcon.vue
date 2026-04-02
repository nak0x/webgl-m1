<template>
  <span class="type-icon" :title="typeLabel">
    <svg v-if="type === 'velo_cargo'" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.3">
      <circle cx="4.5" cy="13" r="3"/>
      <circle cx="13.5" cy="13" r="3"/>
      <path d="M4.5 13l3-7h4l2 7"/>
      <path d="M7.5 6L10 2"/>
    </svg>
    <svg v-else-if="type === 'triporteur_elec'" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.3">
      <circle cx="4" cy="14" r="2.5"/>
      <circle cx="14" cy="14" r="2.5"/>
      <rect x="6" y="8" width="6" height="5" rx="1"/>
      <path d="M4 14l3-6M14 14l-2-6"/>
      <path d="M9 5l1-3M8 5l-1-3"/>
    </svg>
    <svg v-else-if="type === 'camionnette_hydro'" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.3">
      <rect x="1" y="6" width="12" height="7" rx="1.5"/>
      <path d="M13 9h3a1 1 0 011 1v3h-4"/>
      <circle cx="4.5" cy="14.5" r="1.5"/>
      <circle cx="14" cy="14.5" r="1.5"/>
      <text x="5" y="11.5" font-size="5" fill="currentColor" stroke="none" font-weight="bold">H₂</text>
    </svg>
  </span>
</template>

<script setup lang="ts">
defineProps<{
  type: string
  typeLabel?: string
}>()
</script>

<style scoped>
.type-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--green-700);
}
</style>
