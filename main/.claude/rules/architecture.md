# Architecture

## Pattern Experience (unique)

L'orchestrateur Three.js est `app/utils/three/Experience.js`. Il instancie et détient :
- `Sizes` — resize global
- `Time` — boucle RAF, delta en **ms**
- `Resources` — GLTFLoader + DRACOLoader (décodeur CDN)
- `Camera` — PerspectiveCamera
- `Renderer` — WebGLRenderer + EffectComposer (RenderPass → OutlinePass → ACES → OutputPass)
- `InteractionManager` — bus d'événements (proximity, hover, trigger, touche E)
- `DialogueManager` — EventEmitter `open`/`line`/`complete`

Un World (ex: `AtelierWorld`) consomme l'Experience, charge son GLB, déclare ses lumières, et enregistre ses steps `QuestManager`.

## Flow de données Three ↔ Vue

- **Three.js émet** via `EventEmitter` (QuestManager, DialogueManager)
- **Composables Vue** (`useQuestState.js`, `useDialogueState.js`) sont des singletons réactifs qui s'abonnent aux émetteurs
- **Composants HUD** (`QuestHud.vue`, `DialogueHud.vue`) lisent les refs des composables
- **Jamais l'inverse** : Vue ne pilote pas Three directement, il passe par les managers

## Cycle de vie d'un World

1. Construit par `pages/index.vue` après montage
2. `resources.load()` → callbacks `onLoad`
3. Setup scène (lights, fog, sol, GLB)
4. Positionne caméra depuis caméra embarquée du GLB (fallback `0, 1.7, 0`)
5. `_setupQuest()` — enregistre objets interactifs + steps
6. `update(delta)` appelé par la boucle Time

## Interaction

`InteractionManager` expose trois types de détecteurs :
- `registerProximity(object, id, radius)` — distance joueur/objet
- `registerHoverable(mesh, id)` — raycast depuis le centre écran (crosshair) en FPS mode
- `registerTriggerZone(shape, id)` — zone de passage

Touche **E** → émet `interact` pour tous les ids en proximité.

## Quest + Dialogue

`QuestManager` est un séquenceur linéaire. Chaque step :
```js
{ id, label, hint, trigger, dialogue?, onComplete? }
```
Il ne s'abonne qu'au trigger du step actif. Si `dialogue` présent → ouvre `DialogueManager` et attend `complete` avant d'avancer.

## Ciblage / Outline

`CrosshairTarget.js` raycast depuis le centre (0,0) chaque frame, remonte la hiérarchie jusqu'au child direct du root, et alimente `renderer.outlinePass.selectedObjects`.

**Ne pas utiliser** `SilhouetteOutline.js` (legacy, voir cleanup-policy).
