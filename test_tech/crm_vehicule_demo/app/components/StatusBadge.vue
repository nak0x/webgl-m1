<template>
  <span class="badge" :class="badgeClass">
    <span class="badge-dot"></span>
    {{ label }}
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{
  status: 'bon_etat' | 'warning' | 'reparation_obligatoire'
}>()

const badgeClass = computed(() => {
  switch (props.status) {
    case 'bon_etat':
      return 'badge-ok'
    case 'warning':
      return 'badge-warning'
    case 'reparation_obligatoire':
      return 'badge-danger'
    default:
      return ''
  }
})

const label = computed(() => {
  switch (props.status) {
    case 'bon_etat':
      return 'Bon état'
    case 'warning':
      return 'Attention'
    case 'reparation_obligatoire':
      return 'Réparation'
    default:
      return props.status
  }
})
</script>
