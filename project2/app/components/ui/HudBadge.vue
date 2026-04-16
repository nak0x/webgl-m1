<!--
  HudBadge — pastille d'information flottante (HUD générique).

  Usage :
    <HudBadge>Vue embarquée · ESC pour quitter</HudBadge>
    <HudBadge position="top-right" color="blue">FPS : 60</HudBadge>

  Props :
    position  'bottom-center' | 'top-right' | 'bottom-left'
    color     'default' | 'blue' | 'green' | 'orange'
-->
<template>
  <div class="hud-badge" :class="[`hud-badge--${position}`, `hud-badge--${color}`]">
    <slot />
  </div>
</template>

<script setup>
defineProps({
  position: { type: String, default: 'bottom-center' },
  color:    { type: String, default: 'default' },
})
</script>

<style scoped>
.hud-badge {
  position: fixed;
  z-index: 100;
  font-size: 0.82rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  padding: 0.4rem 1rem;
  border-radius: 999px;
  pointer-events: none;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  white-space: nowrap;
}

/* Positions */
.hud-badge--bottom-center {
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
}
.hud-badge--top-right {
  top: 1.2rem;
  right: 1.5rem;
}
.hud-badge--bottom-left {
  bottom: 1.5rem;
  left: 1.5rem;
}

/* Couleurs */
.hud-badge--default { background: rgba(0,0,0,0.55);    color: #fff; }
.hud-badge--blue    { background: rgba(20,80,180,0.6);  color: #cce0ff; }
.hud-badge--green   { background: rgba(20,120,60,0.6);  color: #c0ffcc; }
.hud-badge--orange  { background: rgba(160,80,0,0.6);   color: #ffe0b0; }
</style>
