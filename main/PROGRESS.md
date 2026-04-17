# Avancement — 1st_scene_atelier

## Stack
- **Nuxt 4** — dossier `app/`
- **Three.js r183** — pattern Experience
- **Vue 3** — composables réactifs comme bridge Three.js ↔ UI

---

## Ce qui est fait

### Core Experience (`app/utils/three/`)
- `Experience.js` — orchestrateur principal (Sizes, Time, Resources, Camera, Renderer, InteractionManager, DialogueManager)
- `Renderer.js` — WebGLRenderer + EffectComposer : RenderPass → OutlinePass → ACESFilmicToneMappingShader → OutputPass
  - Tone mapping ACES Filmic, exposure EV -1.64, environment Neutral
  - `outlinePass` exposé publiquement pour CrosshairTarget
- `Camera.js` — PerspectiveCamera
- `Time.js` — boucle RAF, delta en ms
- `Sizes.js` — gestion resize
- `Resources.js` — GLTFLoader + DRACOLoader (décodeur CDN)
- `Debug.js` — lil-gui activé uniquement si `#debug` dans l'URL
- `EventEmitter.js` — base pub/sub

### Scène Atelier (`world/AtelierWorld.js`)
- Chargement du GLB `atelier_camera_1.0.0.glb` (Draco supporté)
- Positionnement caméra depuis la caméra embarquée dans le GLB (fallback `0, 1.7, 0`)
- Lumières : AmbientLight warm + DirectionalLight plafond (shadows) + fill bleu
- Sol plane 30×30 (MeshStandardMaterial)
- Fog `0x1a1a1a` de 20 à 60 unités

### FPS
- `FpsController.js` — PointerLockControls, WASD, `enabled` flag
- Crosshair SVG DOM (opacité 0 → 1 au lock)
- Pause automatique pendant les dialogues (`fps.enabled = false` + `controls.unlock()`)

### Interaction (`interaction/`)
- `InteractionManager.js` — bus d'événements central
  - `registerProximity(object, id, radius)` — détecte la distance joueur/objet
  - `registerHoverable(mesh, id)` — survol raycast
  - `registerTriggerZone(shape, id)` — zone de passage
  - `unregister(id)` — supprime un objet interactif
  - `setFpsMode(bool)` — raycast depuis le centre écran (crosshair)
  - Touche **E** → émet `interact` pour tous les ids en proximité

### Ciblage / Outline
- `CrosshairTarget.js` — raycast depuis le centre (0,0) chaque frame
  - Remonte la hiérarchie jusqu'au child direct du root pour outline le groupe entier
  - Alimente `outlinePass.selectedObjects`
  - Overlay debug (#debug) : type / name / path / outlined
- `SilhouetteOutline.js` — présent mais non utilisé (OutlinePass Three.js préféré)
- `Renderer.js` — OutlinePass avec couleur blanche (AdditiveBlending empêche le noir pur)

### Quête (`quest/` + `dialogue/`)
- `QuestManager.js` — séquenceur linéaire de steps
  - Chaque step a : `id`, `label`, `hint`, `trigger`, `dialogue?`, `onComplete?`
  - S'abonne à un seul trigger à la fois (le step actif)
  - Si dialogue présent → ouvre DialogueManager, attend `complete` avant d'avancer
- `DialogueManager.js` — EventEmitter, `open(lines)` / `next()`, émet `open` / `line` / `complete`
- Steps actuels dans AtelierWorld :
  1. `talk_npc` — parler au technicien (coffee_machine) → dialogue 3 lignes
  2. `use_pc` — interagir avec le PC → **vide, à brancher**
  3. `pick_tool` — récupérer l'outil → retire le mesh de la scène
  4. `exit_door` — sortir → `callbacks.transitionTo('scene2')`

### UI Vue (`components/` + `composables/`)
- `QuestHud.vue` — overlay top-right : objectif, hint, progression (step X/Y)
- `DialogueHud.vue` — overlay bottom : dialogue avec speaker, texte, bouton Suivant/Terminer, raccourci Espace/Entrée
- `useQuestState.js` — singleton réactif bridgé sur QuestManager
- `useDialogueState.js` — singleton réactif bridgé sur DialogueManager
- `pages/index.vue` — monte Experience + AtelierWorld, passe les callbacks Vue

---

## Fichiers à nettoyer / supprimer

| Fichier | Statut |
|---|---|
| `PcScreen.js` | Inutilisé — peut être supprimé |
| `SilhouetteOutline.js` | Inutilisé — peut être supprimé |
| `materials/` (bois, eau, plexiglass…) | Hérités de project2, non utilisés dans l'atelier |
| `textures/` (makePlexiTexture, makeWoodTexture) | Idem |
| `SceneManager.js` | Hérité, non utilisé |

---

## TODO

### Bloquant
- [ ] **Noms réels des objets GLB** — retrouver via `#debug` et mettre à jour dans `_setupQuest()`
  - `computer` → nom réel du PC (objet d'interaction)
  - `Outil` → nom réel de l'outil
  - `Porte` → nom réel de la porte

### Écran PC (`dalle_css3d`)
- [ ] Décider et implémenter ce qui s'affiche sur l'écran (canvas texture, vidéo, UI…)
- [ ] Brancher le step `use_pc` (`onComplete`) sur l'action écran
- [ ] Animation caméra vers l'écran lors de l'interaction PC (zoom face à `dalle_css3d`)

### Scène / Gameplay
- [ ] Vérifier la position de spawn de la caméra GLB dans la scène
- [ ] Ajuster les rayons de proximité (`registerProximity`) une fois les vrais objets nommés
- [ ] `transitionTo('scene2')` — implémenter la navigation vers la scène 2 dans `index.vue`
- [ ] `onOpenWebPage` — callback vide dans `index.vue`, à définir si nécessaire

### Polish
- [ ] Outline noir — OutlinePass ne supporte pas le noir (AdditiveBlending). Si noir requis, réactiver `SilhouetteOutline` (ShaderMaterial normal-extrusion) à la place d'OutlinePass
- [ ] Textures / matériaux sur le modèle GLB (actuellement tout gris = pas de textures baked)
- [ ] Réglage fin de l'éclairage une fois les textures présentes
- [ ] Son ambiant / effets sonores

### Qualité de code
- [ ] Supprimer les fichiers inutilisés listés ci-dessus
- [ ] Vérifier que `resize()` est bien propagé dans tous les cas (CSS3DRenderer retiré, plus rien à resize côté world)
