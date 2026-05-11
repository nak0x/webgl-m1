# Code style

## Commentaires

- **Par défaut : aucun.** Les noms de variables et fonctions portent le sens.
- Écrire un commentaire UNIQUEMENT si le *pourquoi* n'est pas évident (contrainte cachée, workaround, invariant subtil).
- Jamais de commentaires qui décrivent le *quoi* (`// on incrémente i`).
- Jamais de référence à la tâche courante ni aux callers (`// ajouté pour la quête 3`).

## Refactor

- **Ne pas refactorer opportunément** pendant un bug fix ou une feature. Le scope reste le scope.
- Pas d'abstraction prématurée : trois lignes similaires valent mieux qu'un helper inutile.
- Pas de feature flags ni de shims de rétrocompatibilité sans raison explicite.

## Gestion d'erreur

- Valider aux frontières (input utilisateur, chargement GLB, fetch).
- **Ne pas** ajouter de try/catch défensifs pour des cas impossibles en interne.
- Les managers (Quest, Dialogue, Interaction) contrôlent leur propre état : leur faire confiance.

## Imports

- Imports Three : `import { Vector3 } from 'three'` (nommés)
- Helpers Three : `import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'`
- Pas de barrel `index.js` artificiel dans `utils/three/`

## Nommage

- Classes : `PascalCase` (`AtelierWorld`, `QuestManager`)
- Instances / méthodes : `camelCase`
- Événements EventEmitter : `snake_case` court (`line`, `complete`, `interact`)
- IDs de steps quest / objets interactifs : `snake_case` (`talk_npc`, `use_pc`, `pick_tool`)

## Destroy / cleanup

Tout module Three qui s'enregistre (listener, gui folder, geometry, material) DOIT exposer un `destroy()` et être appelé par son parent. Les geometries/materials créés manuellement doivent être `dispose()`d.

## Vue / Composables

- Les composables singletons (`useQuestState`, `useDialogueState`) exposent des `ref`/`computed` seulement.
- Jamais d'appel Three depuis un composant `.vue` — passer par un composable → manager.
- `onMounted` pour le bind, `onBeforeUnmount` pour le unbind.
