---
name: wire-interaction
description: Branche un objet GLB sur l'InteractionManager (proximity, hover, trigger zone). Se déclenche quand l'utilisateur veut rendre un objet interactif, ou utilise /bind-object.
---

# Brancher une interaction sur un objet GLB

Procédure pour enregistrer un objet réel de la scène sur le bus d'événements. Voir `@.claude/rules/architecture.md` pour le pattern InteractionManager.

## Étape 1 — Trouver l'objet dans le GLB

Si le nom n'est pas connu, invoquer le skill `inspect-glb` ou l'agent `glb-auditor`.

Dans le World, après `resources.load()` :
```js
const model = this.resources.items.mainModel.scene
const target = model.getObjectByName('<nom_réel>')
if (!target) console.warn('[wire] object not found: <nom_réel>')
```

## Étape 2 — Choisir le type d'interaction

| Type | Quand l'utiliser | API |
|---|---|---|
| **Proximity** | Déclencher automatiquement à l'approche (dialogue spontané, zone de danger) | `registerProximity(obj, id, radius)` |
| **Hoverable** | Action manuelle (crosshair + touche E) — PC, outil, porte | `registerHoverable(mesh, id)` |
| **Trigger zone** | Passage dans une zone invisible (fin de niveau, checkpoint) | `registerTriggerZone(shape, id)` |

## Étape 3 — Enregistrer

Dans `_setupQuest()` du World :
```js
this.experience.interactions.registerHoverable(target, 'pc_desk')
```

Les IDs doivent correspondre à ceux utilisés dans les `trigger.id` des steps QuestManager.

## Étape 4 — Écouter l'événement (si interaction manuelle)

La touche E émet `interact` avec l'id. `QuestManager` y est déjà abonné pour le step actif — **ne pas réabonner manuellement** sauf pour un usage hors-quest.

## Étape 5 — Cleanup

Quand l'objet n'est plus pertinent (step terminé, objet ramassé), appeler :
```js
this.experience.interactions.unregister('pc_desk')
```
Typiquement dans le `onComplete` du step.

## Pièges

- **Outline** : `CrosshairTarget` alimente automatiquement `outlinePass` pour les hoverables — pas besoin d'ajout manuel
- **FPS mode** : le raycast se fait depuis le centre écran. En hors-FPS, utiliser la position souris (géré par InteractionManager)
- **Hiérarchie GLB** : `CrosshairTarget` remonte au child direct du root pour outline le groupe entier. Enregistrer l'objet « logique » (groupe), pas un mesh enfoui
- **Radius proximity** : commencer à 2.0-3.0 unités, ajuster via `#debug` overlay
