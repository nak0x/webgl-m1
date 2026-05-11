---
name: bridge-composable
description: Crée un composable Vue singleton qui bridge un manager Three.js (EventEmitter) vers des refs réactives. Se déclenche sur édition dans app/composables/ ou création d'un nouveau bridge Three→Vue.
---

# Créer un composable bridge Three ↔ Vue

Pattern utilisé pour `useQuestState.js` et `useDialogueState.js`. Voir `@.claude/rules/architecture.md` pour le flow de données.

## Règles

1. **Singleton** — une seule instance partagée dans l'app (state hors de la fonction)
2. **Lecture seule côté Vue** — jamais de mutation depuis les composants, toujours via le manager
3. **Bind au premier call**, pas au niveau du module (évite les issues SSR/hydratation)
4. **Cleanup** : si le manager est remplacé (changement de World), réinitialiser les refs

## Template

```js
// app/composables/useXState.js
import { ref, readonly } from 'vue'

let manager = null
const state = ref(null)
const opened = ref(false)

function bind(m) {
  manager = m
  opened.value = false
  state.value = null

  m.on('open', (payload) => {
    state.value = payload
    opened.value = true
  })
  m.on('close', () => {
    opened.value = false
    state.value = null
  })
}

export function useXState() {
  return {
    state: readonly(state),
    opened: readonly(opened),
    bind,
    // actions qui appellent le manager (pas de mutation directe)
    next: () => manager?.next(),
    close: () => manager?.close(),
  }
}
```

## Utilisation côté composant

```vue
<script setup>
import { useXState } from '~/composables/useXState'
const { state, opened, next } = useXState()
</script>

<template>
  <div v-if="opened">{{ state.text }}</div>
</template>
```

## Utilisation côté World

```js
import { useXState } from '~/composables/useXState'

// Dans le World, après création du manager
const { bind } = useXState()
bind(this.xManager)
```

## Pièges

- **SSR** : les composables sont importables côté serveur. Ne PAS instancier de code Three.js à l'import (seulement dans `bind()`)
- **Hot reload** : si le bind est fait plusieurs fois, les listeners s'accumulent. Ajouter un `manager?.off(...)` avant rebind si nécessaire
- **Refs vs reactive** : préférer `ref` pour les valeurs simples, `reactive` uniquement pour les objets stables
- **readonly** : toujours exposer en `readonly()` pour empêcher les mutations accidentelles côté Vue
