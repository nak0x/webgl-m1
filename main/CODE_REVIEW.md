# Code Review individuelle — webgl-m1 / Atelier

> Support de préparation et de passage à l'oral (25 min) — Master ECNI 1, 2025/2026.
> Auteur : Anthony Pelaz — branche présentée : `1st_scene_atelier` (rebase à jour avant la soutenance).

## Mapping barème → sections

| Barème | Pts | Section du document |
|---|---|---|
| Architecture & introduction | 2 | §1 |
| Qualité du code présenté | 4 | §2 — chaque fiche, partie « Lecture du code » |
| Maîtrise technique, DevTools & 3D | 8 | §2 — partie « Démo DevTools » + Annexe E |
| Usage de l'IA — responsabilité & posture | 3 | §2 — partie « Part IA / part moi » + Annexe C |
| Vision critique & évolution | 2 | §2 — partie « Critique » + §3 |
| Qualité de la préparation | 1 | Annexe A (checklist) |

---

## §1. Introduction (3 min)

### Pitch
Expérience 3D web type *escape room courte*. Le joueur incarne un personnage en vue première personne dans un atelier. Une quête linéaire en 4 étapes le guide : parler à un NPC → utiliser un PC → ramasser un outil → sortir par la porte (transition vers une scène 2).

### Parcours utilisateur principal
1. Ouverture de la page → Start screen → clic = pointer lock → entrée FPS.
2. Approche du NPC → touche **E** → dialogue 3 lignes (FPS pause).
3. Le HUD quête met à jour l'objectif.
4. PC → outil → porte → transition.

### Stack
- **Nuxt 4.4** (`app/`) — pas de SSR effectif sur les pages 3D, tout monte côté client (`onMounted`).
- **Three.js 0.183** — uniquement WebGL, pas WebGPU.
- **Vue 3.5** + Pinia (utilisé pour l'éditeur cinématique, pas pour la quête).
- **lil-gui 0.21** — UI debug activée par `#debug` dans l'URL.
- **stats.js** — overlay FPS / MS / mémoire.
- Cible : desktop Chrome / Firefox récents, écran 1080p+.

### Architecture en une phrase
Un orchestrateur unique `Experience` détient les utilitaires Three (Sizes, Time, Resources, Camera, Renderer, InteractionManager) ; chaque scène est un *World* qui consomme cette Experience, charge son GLB, déclare ses lumières et enregistre ses étapes de quête.

```
app/
├─ pages/                 # entrée Nuxt — index.vue monte Experience + AtelierWorld
├─ components/            # HUD Vue : QuestHud, DialogueHud, StartHud
├─ composables/           # bridges réactifs Three → Vue (singletons)
├─ stores/                # Pinia (éditeur cinématique uniquement)
└─ utils/three/
   ├─ Experience.js       # orchestrateur
   ├─ Renderer.js         # WebGLRenderer + EffectComposer (12 passes)
   ├─ Camera.js, Time.js, Sizes.js, Resources.js, Debug.js, EventEmitter.js
   ├─ FpsController.js    # PointerLockControls + capsule + Octree
   ├─ CrosshairTarget.js  # raycast centre écran + OutlinePass
   ├─ interaction/        # InteractionManager + 3 détecteurs + PointerStyler
   ├─ quest/              # QuestManager
   ├─ dialogue/           # DialogueManager
   ├─ cinematic/          # CinematicPlayer + Interpolator (éditeur)
   └─ world/              # AtelierWorld, AtelierScene2World, configs, sources
```

### Flow de données Three ↔ Vue
- Les **managers** (Quest, Dialogue, Interaction) sont des `EventEmitter` purs JS.
- Les **composables Vue** (`useQuestState`, `useDialogueState`) sont des singletons qui s'abonnent aux émetteurs et exposent des `ref`/`computed`.
- Les **HUD Vue** lisent ces refs. Vue ne pilote jamais Three directement.

### Workflow Git
- Hosting : GitHub.
- Branches actives : `main` (référence), `dev` (intégration), `1st_scene_atelier` (présentée), `2nd_scene_repaire`, `poc/car_xray` (legacy mergée).
- Stratégie : une branche par feature/scène, fast-forward ou merge classique vers `main` une fois validée.
- Aucun rebase / push --force sur `main`.
- État au moment de la présentation : `1st_scene_atelier` est en avance de 19 commits sur `main` ; un merge planifié post-soutenance.

### Mes responsabilités dans l'équipe (à compléter selon votre groupe)
- FPS, collision, interaction, ciblage / outline, quête + dialogue, intégration HUD Vue.
- Production de scène 1 (atelier).
- Setup environnement Claude (rules, skills, commandes projet).

---

## §2. Code review live (20 min)

Chaque fiche suit le même plan, prêt pour la nav VS Code → DevTools :
- **Fichiers** à ouvrir
- **Intention** (le pourquoi)
- **Lecture du code** (structure, points clés, conventions)
- **Démo DevTools** (cas reproductibles, points de breakpoint, profiler)
- **Part IA / part moi** (posture de responsabilité)
- **Critique & évolution**

---

### Fiche A — Vue FPS (`FpsController`)

#### Fichiers
- `app/utils/three/FpsController.js` (168 LOC)
- Instanciation : `app/utils/three/world/AtelierWorld.js:111-129`

#### Intention
Donner un contrôle première personne classique : déplacement WASD, regard libre via PointerLock, gravité, capsule de collision. La caméra du `Camera.js` est récupérée et désormais pilotée par le controller — on désactive l'auto-update et les OrbitControls pour éviter le double pilotage.

#### Lecture du code
1. **Constantes haut de fichier** (lignes 5-9) : gravité 30, vitesse 8, damping 8, radius 0.3, hauteur capsule 1.0. Faciles à tuner.
2. **Vecteurs réutilisés en module-scope** (`_forward`, `_right`, `_move`, `_up`) : pas d'allocations GC dans la boucle.
3. **`update(deltaMs)`** — ligne 84 :
   - `dt = min(deltaMs/1000, 0.05)` : clamp anti-frame-spike (sinon traversée de mur).
   - Forward extrait de la direction caméra avec `y=0` puis normalisation → marche sans gain de hauteur.
   - Vitesse réduite × 0.3 en l'air (ligne 101) — air control léger.
   - Damping exponentiel `exp(-DAMPING * dt)` au lieu d'une multiplication linéaire → frame-rate independent.
4. **`_resolveCollisions()`** — ligne 119 :
   - `octree.capsuleIntersect` → projection de la vélocité sur le plan tangent (`v -= n * (v·n)`).
   - `_onFloor` déduit du signe de `normal.y`.
5. **Crosshair DOM** créé dans le controller (lignes 58-82). Choix discutable : commenté plus bas.
6. **`dispose()`** restaure `camera.autoUpdate=true` et réactive les OrbitControls : indispensable pour ne pas laisser l'Experience dans un état corrompu en cas de transition.

#### Démo DevTools
- **Sources → file:///FpsController.js**, breakpoint sur `_resolveCollisions` ligne 124. On voit `result.normal` quand on plaque le joueur contre un mur.
- **Console** : `experience.world._fps.speed = 20` → le joueur sprinte. Démontre le hot-tuning.
- **Performance tab** : enregistrer 5 s de jeu → on lit le coût d'une frame. Le RAF est dominé par `composer.render` (post-process). `FpsController.update` reste sous 0.5 ms.
- **Stats.js** : montrer le panneau FPS + MS pour valider le 60 fps.

#### Part IA / part moi
- **Architecture et choix** (capsule + Octree + damping exponentiel) : ma décision après lecture de l'exemple officiel `webgl_games_fps`.
- **Génération initiale** : assistée. J'ai demandé un squelette WASD + pointer lock, puis :
  - réécrit la boucle pour exposer `enabled` (besoin pause dialogue),
  - retiré un saut auto-généré (hors scope MVP),
  - remplacé le lerp linéaire par un damping `exp` (frame-rate independence).
- **Ce que je peux expliquer ligne à ligne** : transformation `forward.y = 0`, justification du clamp `dt`, raison du `_velocity.y = max(0, ...)` au sol.

#### Critique & évolution
| Point | Sévérité | Explication |
|---|---|---|
| Crosshair DOM dans le controller | Moyenne | Viole la séparation Vue/Three. Devrait être un overlay Vue (cohérent avec QuestHud/DialogueHud). |
| Constantes magiques `9` (boost accel) et `0.3` (air) | Faible | À nommer ou exposer. |
| Capsule construite à partir de `camera.position` au constructor | Moyenne | Si on repositionne la caméra GLB *après*, désynchro silencieuse. Aujourd'hui OK car ordre fixe dans `_setup()`. |
| Pas de saut / sprint | Bas | Volontaire (MVP) — la dette est documentée. |
| `document.body` en target de PointerLockControls | Faible | `experience.canvas` plus localisé. |

---

### Fiche B — Collision (Octree + Capsule)

#### Fichiers
- Construction Octree : `app/utils/three/world/AtelierWorld.js:111-115`
- Résolution : `app/utils/three/FpsController.js:119-134`
- **Code mort** : `app/utils/three/PhysicsWorld.js` (Rapier, jamais importé)

#### Intention
Empêcher la traversée des murs et meubles du GLB sans payer le coût d'un vrai moteur physique. L'Octree de Three.js est un BVH léger sur les triangles, suffisant pour de la collision kinématique (pas de simulation dynamique, pas de joints).

#### Lecture du code
```js
// AtelierWorld.js:111
const octree = new Octree()
octree.fromGraphNode(this.model)   // parcourt tous les meshes du GLB
this._fps = new FpsController(this.experience, octree)
```
```js
// FpsController.js:119
_resolveCollisions() {
  const result = this._octree.capsuleIntersect(this._capsule)
  this._onFloor = false
  if (!result) return
  this._onFloor = result.normal.y > 0
  if (!this._onFloor) {
    const vn = result.normal.dot(this._velocity)
    this._velocity.addScaledVector(result.normal, -vn)  // glissement
  } else {
    this._velocity.y = Math.max(0, this._velocity.y)
  }
  this._capsule.translate(result.normal.multiplyScalar(result.depth))
}
```

Points clés :
- Une seule passe de résolution par frame.
- Approche kinématique : la capsule est *poussée hors* de la surface, pas une simulation dynamique.
- Glissement le long des murs grâce au retrait de la composante normale de la vélocité.

#### Démo DevTools
- **Console** : `experience.world._fps._capsule.start.toArray()` → coordonnées pieds, `_capsule.end.toArray()` → coordonnées œil.
- **Breakpoint conditionnel** sur ligne 122 : `result?.normal.y > 0.99` → ne s'arrête qu'au sol parfaitement plat.
- **Toggler le wireframe** du modèle pour visualiser les triangles que l'Octree caste : `experience.world.model.traverse(c => { if (c.isMesh) c.material.wireframe = true })`.

#### Part IA / part moi
- **Choix de l'Octree** : ma décision. J'ai d'abord testé Rapier (`PhysicsWorld.js`) qui pèse ~700 kB en compat WASM, ajoute un async `init()` et impose une boucle de step séparée. Pour de la kinématique simple sur un seul personnage, Octree est ~5× plus léger en code et zéro dépendance externe.
- **Code de résolution** : repris de l'exemple `webgl_games_fps`, simplifié (pas de saut, une seule passe).
- **Décision documentée** : commit `82dad52 Fix : collision using Octree`.

#### Critique & évolution
| Point | Sévérité | Explication |
|---|---|---|
| `PhysicsWorld.js` (Rapier) mort + dépendance npm `@dimforge/rapier3d-compat` | **Haute** | À supprimer pour clarifier le système réel et alléger le bundle. |
| Octree construit une fois sur tout le GLB | Moyenne | Quand `tool.removeFromParent()`, sa géométrie reste dans l'Octree → collision fantôme. À mitiger : exclure l'outil du graph node, ou rebuild l'Octree au pickup. |
| Pas de sub-stepping | Faible | Le clamp `dt ≤ 50 ms` rend le tunneling improbable, mais sur frame drop violent ça reste possible. |
| Pas de différenciation static / dynamic | Bas | Acceptable vu le scope (un seul personnage). |
| Octree non rebuilt en scène 2 | Moyenne | À vérifier sur `AtelierScene2World`. |

---

### Fiche C — Interaction (`InteractionManager` + 3 détecteurs)

#### Fichiers
- `app/utils/three/interaction/InteractionManager.js` — orchestrateur (118 LOC)
- `app/utils/three/interaction/ProximityDetector.js` (49 LOC)
- `app/utils/three/interaction/RaycastDetector.js` (102 LOC)
- `app/utils/three/interaction/TriggerZoneDetector.js` (49 LOC)
- `app/utils/three/interaction/PointerStyler.js` (22 LOC)

#### Intention
Un bus d'événements unique pour 3 modes d'interaction très différents (raycast hover, distance euclidienne, zone géométrique), exposant la **même API** côté World : `register*(object, id, …)` + `on('event', cb)`. Le World ne sait pas comment la détection est faite, il déclare juste son intention.

#### Lecture du code
- **Composition** : `InteractionManager` n'a pas de logique de détection, il délègue à 3 sous-objets et rebroadcast tous leurs événements.
- **Mode FPS** : `setFpsMode(true)` → `RaycastDetector` cast depuis `(0,0)` (centre écran) au lieu de la position souris. Permet de réutiliser exactement le même code en vue libre et en FPS.
- **Touche E** :
```js
// InteractionManager.js:100
_onKeyDown(e) {
  if (e.code !== 'KeyE') return
  const nearbyIds = this._proximity.getInsideIds()
  for (const id of nearbyIds) {
    this.trigger('interact', { id })
  }
}
```
- **`firstHitOnly = true`** dans le RaycastDetector (ligne 21) : on stoppe au premier hit pour préserver l'occlusion (un mur cache l'objet).
- **`getInteractables()`** : produit une `Map<Object3D, id>` consommée par `CrosshairTarget` pour ne pas outliner n'importe quel mesh hover.

#### Démo DevTools
- **Console** : `experience.interaction.on('proximity:enter', e => console.log('ENTER', e))` puis marcher vers le NPC → log direct.
- **Breakpoint** sur `_onKeyDown` ligne 101 → presser E quand on est à côté d'un objet → on voit `nearbyIds` se peupler.
- **Coût raycast** : `console.profile('ray')` pendant 2 s, `console.profileEnd('ray')` → l'onglet Performance montre `intersectObjects` dans la stack (~0.2-0.6 ms selon la complexité de la scène).
- **Hot-toggle du mode** : `experience.interaction.setFpsMode(false)` → on retombe en raycast souris, le hover suit le curseur.

#### Part IA / part moi
- **Pattern à 3 détecteurs** : ma décision. J'ai imposé une API uniforme parce qu'au début on avait des `if (mode === 'proximity') ... else if (...)` partout dans le World, illisible.
- **Génération assistée** : le squelette des 3 détecteurs (ProximityDetector, RaycastDetector, TriggerZoneDetector) a été généré à partir d'une description de l'API. J'ai relu chaque détecteur et :
  - ajouté `firstHitOnly = true` (perf + occlusion),
  - ajouté `mouseDirty` flag (skip raycast quand la souris ne bouge pas en mode libre),
  - retiré un cache `Map<id, Object3D>` doublon sur `_meshMap` qui faisait du dupliqué.
- **Ce que je sais expliquer** : pourquoi le raycast remonte la hiérarchie via `obj.parent` (un GLB est souvent un Group avec des children Mesh — on veut détecter le groupe).

#### Critique & évolution
| Point | Sévérité | Explication |
|---|---|---|
| `getInteractables()` lit `_proximity._entries` et `_raycast._meshMap` (champs `_private`) | Moyenne | Encapsulation cassée. Exposer une méthode `getEntries()` propre. |
| Touche E hard-codée | Faible | À externaliser dans une config si on veut localiser ou rebinder. |
| `RaycastDetector` cast sur `scene.children` complet récursif | Moyenne | Sur grosse scène, coûteux. Optimisation : caster uniquement sur les meshes enregistrés (recreate un sous-array, ou utiliser `Layers`). |
| `hover:click` jamais émis en FPS | Faible | Documenté mais à signaler si on veut un fallback souris. |
| `_listeners = {}` dans `dispose()` | Bas | Touche un champ interne d'`EventEmitter`. Préférer une méthode `clear()`. |

---

### Fiche D — Ciblage / Outline (`CrosshairTarget`)

#### Fichiers
- `app/utils/three/CrosshairTarget.js` (103 LOC)
- Pipeline post-process : `app/utils/three/Renderer.js:92-102` (OutlinePass)

#### Intention
Mettre en surbrillance, frame par frame, l'objet visé au centre de l'écran *uniquement s'il est interactable*. Sert de feedback visuel : « cet objet réagira si tu appuies sur E ».

#### Lecture du code
1. **Setup** : récupère `experience.renderer.outlinePass` (créé dans `Renderer._setComposer`, étape 4 du pipeline).
2. **`update()`** :
   - `raycaster.setFromCamera((0,0), camera)` → ray depuis le centre écran.
   - `intersectObjects(scene.children, true)` → premier hit.
   - Boucle `obj → obj.parent` jusqu'à matcher la `Map<Object3D,id>` de l'InteractionManager.
3. **Optimisation** : `_lastObj` cache pour ne pas réassigner `outlinePass.selectedObjects` chaque frame quand on continue de viser le même objet.
4. **Overlay debug** (mode `#debug` uniquement) : type, name, path GLB (`Group › Mesh.001 › cle_anglaise`), id enregistré.

#### Démo DevTools
- **Sources → CrosshairTarget.js** : breakpoint ligne 65 (`if (!targetObj)`) puis ligne 73 (transition d'objet ciblé).
- **Console** : `experience.renderer.outlinePass.edgeStrength = 12` → outline plus marquée. `outlinePass.visibleEdgeColor.set('#00ff00')` → outline verte.
- **Profiler GPU** (DevTools → Rendering → Frame rendering stats) : on observe le coût du `OutlinePass` (~0.8 ms à 1080p).
- **`#debug` URL** : afficher l'overlay live, viser des objets pour récupérer les noms réels — c'est l'outil que j'utilise pour mettre à jour `AtelierConfig.js`.

#### Part IA / part moi
- **Décision OutlinePass vs ShaderMaterial extrusion** : ma décision après benchmark visuel. OutlinePass est gratuit en intégration (déjà dans le pipeline), mais ne peut pas faire un outline noir (AdditiveBlending). Compromis : on garde blanc, et on documente la règle dans `cleanup-policy.md`.
- **Code généré** : structure de base assistée, mais la boucle `while (obj)` qui remonte au parent enregistré est ma logique — j'ai dû la débugger quand un GLB imbriqué (Group → Mesh) ne déclenchait pas l'outline.

#### Critique & évolution
| Point | Sévérité | Explication |
|---|---|---|
| Double raycast par frame (CrosshairTarget + RaycastDetector) | **Haute** | Mutualiser → ~50 % du coût raycast en FPS. |
| `_lastObj` garde une ref même si l'objet est retiré de la scène | Moyenne | Fuite mémoire potentielle. Reset explicite au `unregister`. |
| `if (this._debug.active)` au constructor seulement | Faible | Toggle debug runtime impossible sans recréer l'instance. |
| OutlinePass blanc forcé | Faible | Si design exige du noir : réactiver `SilhouetteOutline` (ShaderMaterial normal-extrusion). |

---

### Fiche E — Quête + Dialogue (`QuestManager` + `DialogueManager`)

#### Fichiers
- `app/utils/three/quest/QuestManager.js` (116 LOC)
- `app/utils/three/dialogue/DialogueManager.js` (58 LOC)
- Composables : `app/composables/useQuestState.js`, `useDialogueState.js`
- HUD : `app/components/QuestHud.vue`, `DialogueHud.vue`
- Steps déclarés dans `AtelierWorld._setupQuest()` lignes 154-195

#### Intention
Découpler la **logique de progression** (Quest) de la **logique d'affichage** (HUD Vue) via des EventEmitter. Aucun manager ne connaît Vue ; aucun composant Vue n'appelle Three. Le pont est fait par les composables singletons.

#### Lecture du code

**Structure d'un step** :
```js
{
  id:      'talk_npc',
  label:   'Parler au technicien',
  hint:    'Approchez-vous et appuyez sur E',
  trigger: { type: 'interact', id: 'npc' },
  dialogue: [{ speaker, text }, ...],   // optionnel
  onComplete: (callbacks) => { ... },   // optionnel
}
```

**Cycle d'un step** (`QuestManager._activateStep`) :
1. Abonne **un seul** handler à `interaction.on('interact', ...)` filtré par id.
2. Quand l'event arrive : `_unsubscribe()` immédiat (plus d'écoute pendant dialogue).
3. Si `step.dialogue` → `dialogue.open(lines)`, attend `complete` puis `_finishStep`.
4. `_finishStep` appelle `step.onComplete?.(callbacks)`, émet `step:complete`, active le suivant ou émet `quest:complete`.

**Dialogue** : ultra-simple, juste un compteur d'index sur un array de lignes, avec 3 events `open` / `line` / `complete`.

**Pont Vue** :
```js
// useQuestState.js
manager.on('step:active', ({ step, index }) => {
  currentStep.value = step
  stepIndex.value   = index
})
```
Les refs sont consommées par `<QuestHud :step="currentStep" />`.

#### Démo DevTools
- **Console** :
  - `experience.world._quest.startFrom('pick_tool')` → saute aux étapes pour la démo.
  - `experience.world.dialogue.open([{speaker:'Test', text:'Hello'}])` → force un dialogue arbitraire.
- **Breakpoint** sur `_onStepTriggered` ligne 72 → presser E → on voit le step avancer.
- **Vue Devtools** → onglet « Composables » → `useQuestState` → on voit `currentStep` et `stepIndex` se mettre à jour en live.
- **Démontre la séparation Three/Vue** : on peut désactiver le HUD (`<QuestHud v-if="false" />`), la quête fonctionne quand même — preuve que la logique est indépendante du DOM.

#### Part IA / part moi
- **Architecture Quest/Dialogue séparés** : ma décision. La première version mettait tout dans QuestManager, je l'ai split parce qu'on aura besoin de dialogues hors quête (ambiances, indices contextuels).
- **Pattern `EventEmitter` + composable singleton** : ma décision (cohérent avec le reste du projet).
- **Code généré** : le `QuestManager` initial était un switch/case sur les types de trigger. Je l'ai refacto pour qu'il s'abonne génériquement à `interaction.on(step.trigger.type, ...)` — n'importe quel event d'interaction peut maintenant déclencher un step (proximity:enter, trigger:enter, etc.).
- **Ce que je sais expliquer** : pourquoi `_unsubscribe()` est appelé *avant* l'ouverture du dialogue (sinon double-déclenchement possible si l'utilisateur reste collé à l'objet et re-press E).

#### Critique & évolution
| Point | Sévérité | Explication |
|---|---|---|
| `step.onComplete` parfois closure (capture `tool`), parfois `(callbacks) => callbacks.transitionTo()` | Moyenne | Convention pas claire. Unifier sur callbacks. |
| Pas de cleanup du listener `dialogue.on('complete')` si quest dispose pendant un dialogue ouvert | Moyenne | Ordre de cleanup à durcir dans `AtelierWorld.dispose()`. |
| Pas de branches / steps optionnels | Bas | Volontaire (MVP narratif linéaire). |
| Aucune persistance | Bas | À ajouter pour vraie expérience. |
| `experience.dialogue` peut être `null` si World ne setDialogue pas | Moyenne | Le Quest plante. Garde-fou ou injection obligatoire. |

---

## §3. Conclusion (2 min)

### Prochaines étapes
1. **Nettoyer le code mort** : `PhysicsWorld.js` (Rapier), `PcScreen.js`, `SilhouetteOutline.js`, `materials/*` legacy. Bundle plus léger, code plus clair.
2. **Mutualiser le raycast** entre `CrosshairTarget` et `RaycastDetector` → gain perf simple.
3. **Externaliser le crosshair DOM** dans un composant Vue `<FpsCrosshair />` pour cohérence avec QuestHud/DialogueHud.
4. **Octree dynamique** : rebuild ou exclusion à chaque pickup (`tool`).
5. **Scène 2 (`AtelierScene2World`)** : terminer la quête d'interaction 2 et la transition vers scène 3.
6. **Éditeur cinématique** (commits non-mergés) : finaliser CinematicPlayer + timeline pour pré-render des transitions.

### Bugs identifiés
- Si on tape E pendant qu'un dialogue est ouvert, l'event `interact` est toujours émis (le QuestManager désabonne, mais d'autres listeners restent). À auditer.
- `_lastObj` dans CrosshairTarget conserve une ref si l'objet est retiré de la scène en pleine session.
- Octree garde la géométrie de l'outil ramassé → collision fantôme.

### Chemin critique & plans B
| Bloquant | Plan A | Plan B |
|---|---|---|
| Noms réels d'objets GLB inconnus | `#debug` overlay → MAJ `AtelierConfig.js` | Renommer dans Blender et re-exporter |
| Outline noir non supporté par OutlinePass | Garder blanc + glow réduit | Réactiver `SilhouetteOutline` (ShaderMaterial extrusion) |
| Performance post-process trop lourde | Désactiver passes par défaut (déjà le cas) | Drop SSAO + Bokeh, garder Outline + ACES + Output |
| Transition scène 1 → 2 visuelle | Fade DOM simple | Rebuild Experience entière (déjà supporté) |

---

## Annexe A — Checklist de préparation (1 pt « Qualité de la préparation »)

- [ ] Évaluateur ajouté en collab sur le repo GitHub.
- [ ] Branche `1st_scene_atelier` rebase sur `main`, pushée à jour.
- [ ] `npm install` clean, `npm run dev` démarre sans warning bloquant.
- [ ] **Three.js non-obfusqué** : `node_modules/three/build/three.module.js` (build dev), pas le `.min.js`. Confirmer dans la Source Map des DevTools.
- [ ] `#debug` testé : lil-gui + overlay CrosshairTarget visibles.
- [ ] Vue Devtools installée sur le navigateur.
- [ ] Stats.js confirmé visible (FPS panel coin haut gauche).
- [ ] Cas de test live (Annexe B) ouverts dans des onglets.
- [ ] `CODE_REVIEW.md` (ce fichier) accessible en local pour skim si oubli.

## Annexe B — Cas de test live reproductibles

Préparer une session avec ces 6 cas, l'évaluateur peut piocher.

1. **Pointer lock** : ouvrir `localhost:3000`, cliquer le canvas → cursor disparaît, crosshair apparaît, WASD bouge.
2. **Collision mur** : foncer dans un mur → la caméra glisse parallèlement, ne traverse pas.
3. **Proximity → E → dialogue** : marcher vers le NPC → presser E → 3 lignes de dialogue → FPS pause auto, retour FPS auto à la fin.
4. **Outline** : pendant l'approche, viser le NPC → outline blanche apparaît. Détourner le regard → outline disparaît.
5. **HUD réactif** : ouvrir Vue Devtools → montrer `currentStep` qui change quand on valide une étape.
6. **Hot-tuning Console** :
   - `experience.world._fps.speed = 30` → sprint instantané.
   - `experience.renderer.outlinePass.visibleEdgeColor.set('#ff0080')` → outline rose.
   - `experience.world._quest.startFrom('exit_door')` → saute directement à la dernière étape.

## Annexe C — Posture vis-à-vis de l'IA (3 pts)

### Ce que j'ai utilisé
- **Claude Code** comme assistant de génération et de relecture (env `.claude/` présent dans le repo, rules + skills personnalisés).
- Périmètre concerné : squelettes de classes (Détecteurs, Manager), commentaires JSDoc d'interface, scaffolding des composables Vue.
- L'IA n'a **pas** décidé l'architecture (pattern Experience, séparation Quest/Dialogue, choix Octree vs Rapier, pipeline EffectComposer).

### Comment je garde la responsabilité
- **Relecture systématique** : aucun fichier n'est commité sans avoir été relu et compris ligne à ligne.
- **Modifications imposées** : `firstHitOnly`, clamp `dt`, damping `exp`, refacto QuestManager générique → tout vient de moi.
- **Rules explicites dans `.claude/rules/`** : `code-style.md` interdit les commentaires « quoi », `cleanup-policy.md` liste les fichiers legacy à ne pas ressusciter — règles que j'ai écrites et que l'IA suit.
- **Tests live** : à chaque feature je vérifie sur `localhost:3000`, pas seulement la compilation.

### Limites identifiées
- L'IA a généré au début un `PhysicsWorld.js` Rapier que j'ai gardé puis abandonné. Je laisse le fichier en repo *avec mention dans cleanup-policy* pour que l'évaluateur voie le geste de transparence (il sera supprimé après la review).
- Les commentaires générés étaient parfois redondants (« incrémente i ») — je les ai supprimés en passe de relecture.

## Annexe D — Cheatsheet DevTools / Performance 3D

| Mesure | Outil | Cible |
|---|---|---|
| FPS / MS | stats.js (overlay) | 60 fps stable, < 16 ms / frame |
| Coût d'une frame | Performance tab → enregistrer 5 s | `composer.render` ~ 6-10 ms, reste < 4 ms |
| Draw calls | DevTools `experience.renderer.instance.info.render.calls` | < 100 sur scène atelier |
| Triangles | `.info.render.triangles` | dépend du GLB, < 500k visé |
| Geometries / Textures | `.info.memory` | pas de fuite après `dispose()` |
| Coût raycast | `console.profile` 2 s en marchant | < 1 ms |
| Pipeline post-process | onglet Rendering → Frame stats | identifier la passe la plus lourde (souvent SSAO ou Bloom) |

## Annexe E — Map du code par domaine

| Domaine | Entrée | Cœur | Couplage Vue |
|---|---|---|---|
| Bootstrap | `pages/index.vue` | `Experience` | `onMounted` / `onBeforeUnmount` |
| Rendu | `Renderer.js` | EffectComposer 12 passes | aucun |
| Caméra | `Camera.js` | PerspectiveCamera + (OrbitControls désactivés en FPS) | aucun |
| FPS | `FpsController.js` | PointerLockControls + Capsule + Octree | crosshair DOM (à externaliser) |
| Collision | `FpsController._resolveCollisions` | `Octree.capsuleIntersect` | aucun |
| Interaction | `interaction/*` | 3 détecteurs + EventEmitter | aucun (Quest fait le pont) |
| Ciblage | `CrosshairTarget.js` | Raycaster + OutlinePass | aucun |
| Quête | `quest/QuestManager.js` | EventEmitter + séquenceur | `useQuestState` → `QuestHud.vue` |
| Dialogue | `dialogue/DialogueManager.js` | EventEmitter + lignes | `useDialogueState` → `DialogueHud.vue` |
| Cinématique | `cinematic/CinematicPlayer.js` | Interpolation paramètres caméra/post | éditeur Vue (`stores/cinematicEditor.js`) |
