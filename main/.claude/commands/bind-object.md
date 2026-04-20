---
description: Branche un objet GLB réel sur un step QuestManager existant. Usage — /bind-object <stepId> <glbObjectName>
argument-hint: <stepId> <glbObjectName>
---

# /bind-object

Relier un objet 3D chargé depuis un GLB à un step de quête.

## Arguments

`$ARGUMENTS` — deux valeurs séparées par un espace :
1. **stepId** — identifiant du step existant (ex: `use_pc`, `pick_tool`)
2. **glbObjectName** — nom réel de l'objet dans le GLB (ex: `Computer_Desk_01`)

## Étapes

1. Parser `$ARGUMENTS` en deux valeurs — si une seule fournie, demander l'autre
2. Identifier le World concerné (si ambigu, demander à l'utilisateur)
3. Lire le fichier `<Nom>World.js` et trouver le step avec cet `id`
4. Vérifier dans `<Nom>Config.js` si une entrée existe pour ce step, sinon l'ajouter :
   ```js
   interactions: {
     use_pc: { meshName: 'Computer_Desk_01', radius: 2.5, type: 'hover' }
   }
   ```
5. Dans `_setupQuest()` du World, ajouter / modifier l'enregistrement :
   ```js
   const target = model.getObjectByName('Computer_Desk_01')
   if (target) this.experience.interactions.registerHoverable(target, 'use_pc')
   ```
6. Ajouter un `console.warn` si l'objet n'est pas trouvé (aide au debug)
7. Mettre à jour `PROGRESS.md` — cocher le TODO si listé dans « Bloquant »

## Choix du type d'interaction

Demander à l'utilisateur si pas évident depuis le contexte :
- **hover** — crosshair + E (PC, outil, porte)
- **proximity** — auto à l'approche (dialogue, zone)
- **zone** — passage (sortie, checkpoint)

Référence : skill `wire-interaction` pour les détails.

## Suivi

Proposer de tester en lançant `/dev-scene` et en vérifiant via `#debug` que l'objet s'outline au hover.
