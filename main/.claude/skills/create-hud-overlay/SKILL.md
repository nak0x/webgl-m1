---
name: create-hud-overlay
description: Crée un composant Vue overlay HUD (quest, dialogue, inventory…). Se déclenche sur création d'un nouveau *Hud.vue dans components/ ou modification d'un HUD existant.
---

# Créer un overlay HUD

Pattern utilisé pour `QuestHud.vue` et `DialogueHud.vue`.

## Règles

1. **Fichier** : `app/components/<Nom>Hud.vue`
2. **Consommer un composable bridge**, jamais d'appel Three direct (voir skill `bridge-composable`)
3. **Position fixed + pointer-events** : l'overlay ne doit pas bloquer le canvas 3D
4. **Accessibilité** : navigation clavier (Espace/Entrée pour valider)
5. **z-index** convenu : HUD = 100, modal critique (dialogue) = 200

## Template

```vue
<script setup>
import { useXState } from '~/composables/useXState'
import { onMounted, onBeforeUnmount } from 'vue'

const { state, opened, next } = useXState()

function handleKeydown(e) {
  if (!opened.value) return
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault()
    next()
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <transition name="hud-fade">
    <div v-if="opened" class="x-hud" role="dialog" aria-live="polite">
      <div class="x-hud__text">{{ state?.text }}</div>
      <button class="x-hud__next" @click="next" aria-label="Suivant">
        Suivant (Espace)
      </button>
    </div>
  </transition>
</template>

<style scoped>
.x-hud {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  pointer-events: auto;
  padding: 16px 24px;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  border-radius: 8px;
  max-width: 600px;
}
.hud-fade-enter-active,
.hud-fade-leave-active { transition: opacity 0.2s; }
.hud-fade-enter-from,
.hud-fade-leave-to { opacity: 0; }
</style>
```

## Position selon le type

- **Objectif/quest** : top-right
- **Dialogue** : bottom-center
- **Crosshair** : center (déjà en SVG DOM dans `pages/index.vue`)
- **Inventaire** : bottom-left
- **Menu pause** : center, fullscreen overlay (pointer-events: auto sur tout)

## Pointer-events

Par défaut, le HUD doit avoir `pointer-events: none` sauf sur les éléments cliquables (boutons). Sinon il bloque le lock du pointeur.

```css
.x-hud { pointer-events: none; }
.x-hud__next { pointer-events: auto; }
```

## Accessibilité

- `role="dialog"` pour les modales (dialogue)
- `role="status"` ou `aria-live="polite"` pour les HUD informatifs (quest label)
- Focus management : si un bouton est affiché et le clavier utilisé, focus automatique
- Contraste AAA : fond 0.75 opacité minimum sur texte clair

## Intégration

Monter le composant dans `app/pages/<scene>.vue` :
```vue
<template>
  <div>
    <canvas ref="canvas" />
    <QuestHud />
    <DialogueHud />
    <XHud />
  </div>
</template>
```

Les composants dans `app/components/` sont auto-importés par Nuxt — pas besoin d'`import`.
