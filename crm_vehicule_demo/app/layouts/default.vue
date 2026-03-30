<template>
  <div class="app-layout">
    <aside class="sidebar glass-strong" :class="{ collapsed: sidebarCollapsed }">
      <div class="sidebar-header">
        <div class="logo" @click="sidebarCollapsed = !sidebarCollapsed">
          <div class="logo-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="12" stroke="#52B788" stroke-width="2.5" />
              <path d="M14 6C14 6 8 12 8 16c0 3.3 2.7 6 6 6s6-2.7 6-6c0-4-6-10-6-10z" fill="#52B788" opacity="0.3" />
              <path d="M14 10c0 0-4 4-4 6.5a4 4 0 008 0c0-2.5-4-6.5-4-6.5z" fill="#40916C" />
            </svg>
          </div>
          <span v-show="!sidebarCollapsed" class="logo-text">EcoFleet</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <NuxtLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: route.path === item.path }"
        >
          <span class="nav-icon" v-html="item.icon"></span>
          <span v-show="!sidebarCollapsed" class="nav-label">{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <div class="sidebar-footer" v-show="!sidebarCollapsed">
        <div class="env-badge">
          <span class="env-dot"></span>
          Démo Solarpunk
        </div>
      </div>
    </aside>

    <main class="main-content" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const sidebarCollapsed = ref(false)

const navItems = [
  {
    path: '/',
    label: 'Carte 3D',
    icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7l7-4 7 4v6l-7 4-7-4V7z"/><path d="M3 7l7 4m0 0l7-4m-7 4v7"/></svg>',
  },
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="7" height="7" rx="1.5"/><rect x="11" y="2" width="7" height="4" rx="1.5"/><rect x="2" y="11" width="7" height="4" rx="1.5"/><rect x="11" y="8" width="7" height="7" rx="1.5"/></svg>',
  },
  {
    path: '/parts',
    label: 'Pièces',
    icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="3"/><path d="M10 2v3m0 10v3M2 10h3m10 0h3M4.2 4.2l2.1 2.1m7.4 7.4l2.1 2.1M4.2 15.8l2.1-2.1m7.4-7.4l2.1-2.1"/></svg>',
  },
]
</script>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
  background: var(--bg-primary);
}

/* Sidebar */
.sidebar {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: var(--sidebar-width);
  z-index: 100;
  display: flex;
  flex-direction: column;
  padding: var(--space-4);
  transition: width var(--transition-base);
  border-right: 1px solid var(--border-light);
  background: var(--bg-sidebar);
  overflow: hidden;
}

.sidebar.collapsed {
  width: var(--sidebar-collapsed);
  padding: var(--space-4) var(--space-2);
}

.sidebar-header {
  margin-bottom: var(--space-8);
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}

.logo:hover {
  background: var(--bg-hover);
}

.logo-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-text {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.25rem;
  color: var(--green-800);
  white-space: nowrap;
}

/* Nav */
.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-weight: 500;
  font-size: 0.9rem;
  transition: all var(--transition-fast);
  text-decoration: none;
  white-space: nowrap;
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--green-200);
  color: var(--green-800);
}

.nav-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-label {
  white-space: nowrap;
}

/* Footer */
.sidebar-footer {
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-light);
}

.env-badge {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 500;
}

.env-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--green-600);
  animation: pulse 2s ease-in-out infinite;
}

/* Main */
.main-content {
  margin-left: var(--sidebar-width);
  flex: 1;
  min-height: 100vh;
  transition: margin-left var(--transition-base);
}

.main-content.sidebar-collapsed {
  margin-left: var(--sidebar-collapsed);
}

/* Mobile */
@media (max-width: 768px) {
  .sidebar {
    width: var(--sidebar-collapsed);
    padding: var(--space-4) var(--space-2);
  }

  .logo-text,
  .nav-label,
  .sidebar-footer {
    display: none !important;
  }

  .main-content {
    margin-left: var(--sidebar-collapsed);
  }
}
</style>
