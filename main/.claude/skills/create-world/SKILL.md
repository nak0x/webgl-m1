---
name: create-world
description: Scaffold une nouvelle scène Three.js complète (World + Sources + Config + page Nuxt). Se déclenche quand l'utilisateur demande à créer une nouvelle scène, un nouveau World, ou utilise la commande /new-world.
---

# Créer une nouvelle scène (World)

Procédure pour scaffolder une scène complète en respectant le pattern Experience. Voir `@.claude/rules/architecture.md` pour le pattern.

## Checklist

1. **Nom** — demander à l'utilisateur un nom PascalCase (ex: `Forge`, `Workshop`, `Lab`)

2. **Créer 3 fichiers dans `app/utils/three/world/`** :

   **`<Nom>Sources.js`** — copier depuis `_templateSources.js`, lister les GLB/textures
   ```js
   export default [
     { name: 'mainModel', type: 'gltfModel', path: '/models/<nom>.glb' },
   ]
   ```

   **`<Nom>Config.js`** — constantes de la scène
   ```js
   export const <NOM>_CONFIG = {
     cameraFallback: { x: 0, y: 1.7, z: 0 },
     interactions: {
       // id: { meshName, radius, type: 'proximity'|'hover'|'trigger' }
     },
     fog: { color: 0x1a1a1a, near: 20, far: 60 },
   }
   ```

   **`<Nom>World.js`** — copier depuis `_TemplateWorld.js`, adapter :
   - Import des Sources et Config
   - Lumières (ambient warm + directional ceiling + fill)
   - Sol (30×30 MeshStandardMaterial)
   - `_setupQuest()` — enregistrer objets interactifs + steps QuestManager
   - `destroy()` — dispose geometries/materials créés ici

3. **Créer la page** `app/pages/<nom>.vue` en copiant `_TemplatePage.vue` :
   - Instancier Experience
   - Monter `<Nom>World`
   - Passer callbacks (`transitionTo`, `onOpenWebPage` si besoin)
   - `onBeforeUnmount` → `experience.destroy()`

4. **Router** — Nuxt détecte automatiquement la page via le nom de fichier. Vérifier que la route existe (`:3000/<nom>`).

5. **Transition depuis la scène précédente** — si cette scène est la cible d'un `transitionTo` existant, brancher la navigation côté page appelante.

## Pièges à éviter

- **Ne pas** importer manuellement depuis `utils/three/materials/` ou `utils/three/textures/` (auto-imports Nuxt, voir `@.claude/rules/stack-constraints.md`)
- **Ne pas** copier les matériaux legacy (bois, eau, plexi) — voir `@.claude/rules/cleanup-policy.md`
- **Ne pas** oublier le `destroy()` — leak geometry/material sinon
- Fallback caméra si le GLB n'embarque pas de caméra

## Mise à jour PROGRESS.md

Ajouter la nouvelle scène dans la section « Ce qui est fait » avec ses fichiers créés et ses TODO (noms d'objets GLB à retrouver).
