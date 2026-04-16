<!--
  StartScreen — landing page.
  Un seul bouton qui lance la première scène (porte).
-->
<template>
  <div class="start-screen">
    <header class="start-header">
      <p class="start-eyebrow">WebGL · M1</p>
      <h1 class="start-title">Porte interactive</h1>
    </header>

    <div class="start-actions">
      <button class="start-btn" @click="goToScene('door')">
        Entrer
      </button>
      <button class="start-btn start-btn--secondary" @click="goToScene('cinematic')">
        Cinématique
      </button>
    </div>
  </div>
</template>

<script setup>
const { goToScene } = useSceneManager()
</script>

<style scoped>
.start-screen {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2.5rem;
  z-index: 100;
  background: radial-gradient(ellipse at center, rgba(10,10,20,0.88) 0%, rgba(0,0,0,0.96) 100%);
}

.start-header { text-align: center; }

.start-eyebrow {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.28);
  margin-bottom: 0.5rem;
}

.start-title {
  font-size: 2.2rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #fff;
}

.start-actions {
  display: flex;
  gap: 0.75rem;
}

.start-btn {
  padding: 0.7rem 2.2rem;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, transform 0.15s;
}

.start-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateY(-1px);
}

.start-btn--secondary {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
}

.start-btn--secondary:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.25);
  color: #fff;
}
</style>
