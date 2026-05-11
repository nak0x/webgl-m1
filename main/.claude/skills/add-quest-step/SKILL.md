---
name: add-quest-step
description: Ajoute un step au QuestManager avec trigger (proximity/hover/zone) et dialogue optionnel. Se déclenche quand l'utilisateur demande à ajouter une étape de quête, un dialogue, ou utilise /quest-step.
---

# Ajouter un step de quête

Procédure pour étendre un World existant avec un nouveau step. Voir `@.claude/rules/architecture.md` pour le flow QuestManager ↔ DialogueManager.

## Structure d'un step

```js
{
  id: 'snake_case_id',        // unique dans le World
  label: 'Objectif affiché',   // HUD top-right
  hint: 'Indice court',        // sous-titre HUD
  trigger: { type, ...opts },  // voir types ci-dessous
  dialogue: [                  // optionnel
    { speaker: 'Technicien', text: 'Salut, ...' },
    { speaker: 'Joueur',     text: '...' },
  ],
  onComplete: () => { ... },   // optionnel, action à l'avancement
}
```

## Types de trigger

1. **Proximity** — le joueur s'approche d'un objet
   ```js
   trigger: { type: 'proximity', id: 'pc_desk', radius: 2.5 }
   ```
   Prérequis : `interactions.registerProximity(mesh, 'pc_desk', 2.5)` appelé dans `_setupQuest()`.

2. **Hover + touche E** — viser avec le crosshair et presser E
   ```js
   trigger: { type: 'interact', id: 'pc_desk' }
   ```
   Prérequis : `interactions.registerHoverable(mesh, 'pc_desk')`.

3. **Zone** — le joueur entre dans une zone 3D
   ```js
   trigger: { type: 'zone', id: 'exit_door_zone' }
   ```
   Prérequis : `interactions.registerTriggerZone(shape, 'exit_door_zone')`.

## Checklist d'intégration

1. Vérifier que l'objet GLB cible a un nom connu — sinon passer par skill `inspect-glb`
2. Ajouter l'enregistrement de l'objet dans `_setupQuest()` du World
3. Ajouter le step au tableau passé à `questManager.setSteps([...])`, à la bonne position dans la séquence
4. Si `dialogue` présent : vérifier que le FPS se pause pendant (géré automatiquement par `DialogueManager` → `fps.enabled = false` + `controls.unlock()`)
5. Si `onComplete` modifie la scène (retirer un mesh, jouer une anim) : le faire ici, pas ailleurs
6. Tester : lancer `npm run dev`, parcourir la quête depuis le début

## Pièges à éviter

- **Ne pas** abonner manuellement aux événements du QuestManager hors du manager lui-même
- **Ne pas** mettre de logique Vue dans le step — passer par le composable `useQuestState`
- **Ne pas** oublier `unregister(id)` dans le `onComplete` si l'objet n'est plus pertinent pour la suite

## Mise à jour

Ajouter le step dans `PROGRESS.md` section « Steps actuels ».
