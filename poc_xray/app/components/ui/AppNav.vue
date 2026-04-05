<!--
  AppNav — barre de navigation entre les pages Three.js.
  À placer en overlay fixe dans les pages.
-->
<template>
  <nav class="app-nav">
    <NuxtLink to="/" class="nav-link" active-class="nav-link--active">
      Scène principale
    </NuxtLink>
    <NuxtLink to="/materiaux" class="nav-link" active-class="nav-link--active">
      Matériaux
    </NuxtLink>
    <NuxtLink to="/car_xray" class="nav-link" active-class="nav-link--active">
      Car xray
    </NuxtLink>
  </nav>
</template>

<style scoped>
.app-nav {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.5rem;
  z-index: 100;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  padding: 0.3rem;
}

.nav-link {
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.78rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-decoration: none;
  padding: 0.35rem 0.9rem;
  border-radius: 999px;
  transition: color 0.2s, background 0.2s;
}

.nav-link:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.nav-link--active {
  color: #fff;
  background: rgba(255, 255, 255, 0.15);
}
</style>
