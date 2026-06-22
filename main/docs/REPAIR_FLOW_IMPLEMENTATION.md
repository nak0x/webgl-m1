# Implémentation — Lien Ville → Réparation → Atelier (fin)

> Spec de build autonome. Ce fichier contient **tout** ce qu'il faut pour construire la
> feature sans relire le reste du repo. Lire d'abord `CLAUDE.md` et `.claude/rules/*`
> pour les conventions (Three r183, pas de commentaires inutiles, scope strict, `destroy()`
> obligatoire sur tout module qui s'enregistre).

---

## 1. Objectif & UX cible

La boucle de jeu complète, dans l'ordre :

1. **Atelier** (`scene_1`) — déjà fait : on récupère les outils.
2. **Hub** (`scene_2`) — déjà fait.
3. **Ville** (`scene_3`, `CityWorld`) — on circule en FPS et on **trouve un véhicule accidenté**
   posé à des coordonnées précises de la ville.
4. En entrant dans la **zone d'interaction** du véhicule → overlay « Appuyez sur E pour réparer ».
5. **E** → fondu au noir → téléportation vers la **scène de réparation** (`car_repair`,
   `CarRepairWorld`) **avec le bon modèle et le bon JSON de réparation** (celui associé à ce
   véhicule).
6. On répare toutes les pièces (système X-ray déjà fonctionnel).
7. Réparation finie → transition vers la **scène 4** (`scene_4`, `AtelierEndSceneWorld`).

Ce qui **manque aujourd'hui** (le scope de cette feature) :

- **A.** Un outil de placement (en `#debug`) pour poser les accidents dans la ville et les
  **sauvegarder en JSON** dans `public/settings/` via une **route API Nuxt**.
- **B.** Une **page outil de création de réparation** : charge un modèle MinIO par chemin,
  affiche toutes ses pièces en X-ray, permet de sélectionner une pièce, de l'ajouter aux
  pièces à réparer, de saisir les détails du JSON réparation, puis de **sauvegarder** et
  d'**associer** la réparation à un emplacement d'accident en ville.
- **C.** Le **runtime ville** : lire le JSON d'accidents, instancier les véhicules + zones
  d'interaction, gérer le prompt « E », et déclencher la transition vers `car_repair` avec
  le bon contexte.
- **D.** Le **chaînage de sortie** : `car_repair` → `scene_4` une fois toutes les réparations
  terminées.

Les briques **déjà en place** et réutilisées telles quelles :

| Brique | Fichier | Rôle |
|---|---|---|
| Scène réparation | `world/car_repair/CarRepairWorld.js` | charge GLB, X-ray, markers, callbacks |
| Parse JSON réparation | `world/car_repair/RepairParser.js` | `parse()`, `parseVehicle()`, `parseMeta()` |
| Markers + X-ray | `world/car_repair/RepairBuilder.js`, `RepairMarkerManager.js` | sprites, matériau X-ray par pièce |
| Matériau X-ray | `materials/createXray.js` | fill plat + arêtes, **auto-importé** (dossier `materials/`) |
| HUD réparation | `components/RepairHud.vue`, `components/VehicleInfoHud.vue` | panneaux gauche/droite |
| Bridge réactif | `composables/useRepairState.js` | manager Three → refs Vue |
| Transition scènes | `pages/index.vue` `transitionTo()` + `FlowManager` + `SceneManager` | fondu + preload + load |
| Coordonnées ville | `world/city/CityConfig.js` | `cityPos()`, `worldToChunk()`, `SPAWN` |
| Mini-map debug | `world/city/CityWorld.js` `_setupMinimap()` | overlay coords temps réel en `#debug` |
| Export settings | `RenderProfile.js` `_exportSettings()/_download()` | **précédent** d'export JSON (download) |

---

## 2. Architecture & contraintes (rappel du projet)

- **Pattern Experience** : `utils/three/Experience.js` détient `Sizes/Time/Resources/Camera/
  Renderer/InteractionManager/DialogueManager`. Un World consomme l'Experience, charge son GLB
  via `experience.resources` (worker off-thread, voir `Resources.js` + `asset-fetcher.worker.js`),
  s'abonne à `resources.on('ready')`, et expose `update()/resize()/dispose()`.
- **Three ↔ Vue** : Three émet via `EventEmitter`, des **composables singletons** s'abonnent,
  les composants HUD lisent les refs. **Jamais** d'appel Three depuis un `.vue`.
- **Transitions** : `index.vue#transitionTo(name)` → fondu noir → `experience.flow.run(steps, name)`.
  `FlowManager` joue d'éventuelles cinématiques puis `SceneManager.load(World, sources, callbacks)`.
  Les `callbacks` sont reconstruits à chaque scène par `makeCallbacks()` dans `index.vue`.
- **Assets MinIO** : `utils/assetPath.js` → `assetPath('/models/x.gltf')` =
  `VITE_ASSETS_BASE_URL` (`https://minio.mycloud-anthropic.ovh/assets`) + path. Tout GLB se
  déclare dans un `*Sources.js` : `{ name, type:'gltf'|'glb', path: assetPath(...) }`.
- **Debug** : `experience.debug.active` = `location.hash === '#debug'`. lil-gui via
  `experience.debug.gui.addFolder(...)`. Tout folder créé doit être `.destroy()` au `dispose()`.
- **Coordonnées ville** : la caméra FPS expose sa position monde
  (`experience.camera.instance.position`). La mini-map debug affiche déjà `x/y/z` en bas à droite.
  `CHUNK_SIZE = 64`, origine `[0,0]`, `SPAWN` au centre du chunk (0,0). `cityPos(col,row,lx,lz,h)`
  convertit une coord chunk en `Vector3` monde.
- **Versions figées** : Nuxt 4.4, Three 0.183 (API r183), Vue 3.5, lil-gui 0.21. Pas de SSR pour
  les pages 3D (tout en `onMounted`).

---

## 3. Modèle de données

### 3.1 `public/settings/city_accidents.json`

Liste des accidents posés dans la ville. **Source de vérité du runtime ville.**

```json
{
  "version": 1,
  "accidents": [
    {
      "id": "acc_dacia_sandero",
      "label": "Dacia Sandero accidentée",
      "modelPath": "/models/vehicles/dacia_sandero.glb",
      "repairFile": "car_repair_dacia_sandero.json",
      "position": { "x": 41.2, "y": 0.15, "z": 33.8 },
      "rotationY": 1.57,
      "triggerRadius": 3.5,
      "promptText": "Appuyez sur E pour réparer"
    }
  ]
}
```

Champs :
- `id` — slug unique (`snake_case`). Sert d'`id` d'interaction.
- `label` — affichage debug / éditeur.
- `modelPath` — chemin **relatif MinIO** du GLB du véhicule (passé à `assetPath()`). Le même
  modèle est rechargé dans `car_repair`.
- `repairFile` — nom du fichier JSON réparation dans `public/settings/` (voir 3.2). C'est le
  lien ville ↔ réparation.
- `position` — coords **monde** (relevées via la mini-map debug / position caméra).
- `rotationY` — orientation du véhicule (radians) autour de Y.
- `triggerRadius` — rayon de la zone « E » (sphère centrée sur `position`).
- `promptText` — texte du prompt d'interaction.

> Convention : `y` au niveau sol ville = `FLOOR_Y` = `EYE_HEIGHT - 1.3 = 0.15`. Le placement
> debug doit poser le véhicule à `y ≈ 0.15` (sol), pas à la hauteur des yeux de la caméra.

### 3.2 `public/settings/<repairFile>.json` (réparation par véhicule)

**Structure déjà consommée par `RepairParser`** (cf. `public/data/car_repair_sample.json`).
Conserver exactement cette forme :

```json
{
  "vehicle": { "name", "year", "immatriculation", "km", "fuel_level", "fuel_type" },
  "context": "string",
  "priority": "urgent|high|normal|low",
  "repair_delay_days": 3,
  "available_parts": [ { "id", "name", "available": true, "delivery_days": 0 } ],
  "repair_history": [ { "date", "type", "severity" } ],
  "repairs": [
    {
      "id": "snake_case_unique",
      "name": "string",
      "description": "string",
      "severity": "bon|use|endommage|critique",
      "repairable": true,
      "replaceable": true,
      "pieces": [ { "mesh": "<nom exact du mesh GLB>", "name": "label humain" } ]
    }
  ]
}
```

Contraintes imposées par `RepairParser.parse()` :
- `severity` ∈ `{bon, use, endommage, critique}` (sinon fallback `use`).
- Un `repair` n'est gardé que s'il a un `id` **et** au moins une `piece`.
- `pieces[].mesh` doit correspondre au **nom réel** d'un mesh du GLB (sinon `RepairBuilder`
  log un warn et place le marker en position fallback). → l'outil de création garantit ces noms
  car il les lit directement depuis le modèle chargé.

> **Découplage important** : aujourd'hui `CarRepairWorld._loadRepairData()` charge en dur
> `'/data/car_repair_sample.json'` et `CarRepairSources.js` charge en dur
> `/models/car_repair.gltf`. La feature doit rendre **les deux paramétrables** par accident
> (voir §6.3).

---

## 4. Routes API Nuxt (Nitro) — sauvegarde JSON

Il n'y a **pas encore** de dossier `server/`. Nuxt 4 + Nitro le détecte automatiquement.
Créer des routes qui écrivent dans `public/settings/`.

> ⚠️ **Écriture disque = dev-only.** En prod (`.output/`), `public/` est servi statiquement et
> non writable. Garder ces routes derrière un garde `import.meta.dev` (ou
> `process.env.NODE_ENV !== 'production'`) et renvoyer 403 sinon. Ces routes sont des outils
> d'**auteur**, pas du gameplay runtime.

### 4.1 `server/api/settings/[file].post.js` — écrire un settings JSON

```js
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, normalize } from 'node:path'

const SETTINGS_DIR = resolve(process.cwd(), 'public/settings')

export default defineEventHandler(async (event) => {
  if (!import.meta.dev) throw createError({ statusCode: 403, statusMessage: 'dev only' })

  const file = getRouterParam(event, 'file')
  if (!/^[a-z0-9_]+\.json$/i.test(file)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid filename' })
  }

  const target = normalize(resolve(SETTINGS_DIR, file))
  if (!target.startsWith(SETTINGS_DIR)) {
    throw createError({ statusCode: 400, statusMessage: 'path traversal' })
  }

  const body = await readBody(event)
  await mkdir(SETTINGS_DIR, { recursive: true })
  await writeFile(target, JSON.stringify(body, null, 2), 'utf8')
  return { ok: true, file }
})
```

- **Validation stricte du nom** (regex + anti path-traversal) — frontière d'input utilisateur.
- Appel client : `await $fetch('/api/settings/city_accidents.json', { method:'POST', body })`.

### 4.2 (Optionnel) `server/api/settings/index.get.js` — lister les settings

Utile pour l'éditeur (lister les `repairFile` existants, proposer un dropdown d'accidents).

```js
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
export default defineEventHandler(async () => {
  const dir = resolve(process.cwd(), 'public/settings')
  const files = await readdir(dir)
  return files.filter(f => f.endsWith('.json'))
})
```

> La **lecture** des JSON par le jeu se fait par simple `fetch('/settings/x.json')` (servi
> statiquement depuis `public/`), pas par l'API. Ne pas confondre lecture runtime (statique) et
> écriture auteur (API dev-only).

---

## 5. Outil A — Placement des accidents en ville (`#debug`)

But : se déplacer en FPS dans `CityWorld`, viser un emplacement, **poser un accident** à la
position courante, l'orienter, l'associer à un `repairFile`, et **sauver** le JSON.

### 5.1 Nouveau fichier `world/city/CityAccidentEditor.js`

Module debug-only instancié par `CityWorld` quand `experience.debug.active`. Responsabilités :

- Charger `city_accidents.json` (`fetch('/settings/city_accidents.json')`, tolérer 404 → liste
  vide, via `safeFetch` de `utils/assetError.js`).
- Tenir un état éditable `{ accidents: [...] }`.
- Folder lil-gui `Accidents (editor)` sous le folder `City` existant
  (`CityWorld._setupDebug()` crée déjà `debug.gui.addFolder('City')` — y ajouter un sous-folder) :
  - Bouton **« Poser ici »** : crée un accident à `camera.position` (avec `y` forcé au sol
    `0.15`), `rotationY` = yaw caméra courant (`atan2(dir.x, dir.z)` depuis
    `camera.getWorldDirection`). Génère un `id` incrémental, ajoute un **gizmo visuel**
    (cylindre/anneau translucide + sprite label) à la scène pour le voir.
  - Champs proxy : `label`, `modelPath`, `repairFile`, `triggerRadius`, `promptText`,
    `rotationY` (slider), et `position x/y/z` (sliders fins pour ajuster après pose).
  - Dropdown de sélection de l'accident courant (pour éditer/supprimer).
  - Bouton **« Supprimer »**.
  - Bouton **« Sauvegarder »** : `POST /api/settings/city_accidents.json` avec l'état complet.
    Feedback (console + petit toast DOM) sur succès/échec.
- Optionnel : recharger les véhicules réels (cf. §6) après save pour visualiser, ou se contenter
  des gizmos en mode éditeur.

Pattern lil-gui + proxy à copier de `CityWorld._setupAtmosphereDebug()` (mêmes idiomes
`addColor/add(...).onChange`). Pattern d'export JSON à copier de `RenderProfile._exportSettings()`,
mais remplacer le `_download()` (browser download) par un `$fetch` POST vers l'API §4.1.

### 5.2 Lecture des coordonnées

La mini-map debug affiche déjà `x/y/z` temps réel (`CityWorld._updateMinimap`). Le bouton
« Poser ici » lit directement `experience.camera.instance.position`. Pour la rotation, viser le
véhicule dans le sens de marche : `camera.getWorldDirection(v); rotationY = Math.atan2(v.x, v.z)`.

### 5.3 Câblage dans `CityWorld`

Dans `CityWorld._setupDebug()` (déjà gardé par `if (!debug.active) return`), après
`_setupMinimap()`, ajouter :

```js
this._accidentEditor = new CityAccidentEditor(this.experience, this._debugFolder)
```

Et dans `CityWorld.dispose()` : `this._accidentEditor?.destroy()` (avant de détruire le folder).
Le `destroy()` de l'éditeur retire ses gizmos de la scène et `dispose()` leurs geometries/materials.

---

## 6. Runtime ville — instanciation des véhicules + zones « E »

But (mode **normal**, pas debug) : à l'entrée de `CityWorld`, lire `city_accidents.json`,
charger chaque modèle de véhicule, le poser, créer une zone trigger + prompt, et déclencher la
transition vers `car_repair` au `E`.

### 6.1 Nouveau fichier `world/city/CityAccidentManager.js`

```
class CityAccidentManager {
  constructor(experience, accidents, { onEnterRepair }) // onEnterRepair(accident)
  async loadModels()        // charge les GLB des accidents (Resources ou GLTFLoader direct)
  spawn()                   // pose meshes + registerTriggerZone(Sphere, id) par accident
  update(delta)             // (optionnel : anim/halo)
  destroy()                 // unregister zones, retire meshes, dispose
}
```

Détails :
- **Chargement des modèles d'accidents** : ils ne sont pas dans `CitySources.js` (chemins
  dynamiques venant du JSON). Deux options :
  - (Recommandé) instancier un `Resources(sources)` dédié à partir des `modelPath` des accidents
    et attendre son `ready` — réutilise le worker + DRACO. Sources :
    `accidents.map(a => ({ name: a.id, type:'glb', path: assetPath(a.modelPath) }))`.
  - Ou un `GLTFLoader` direct. Préférer la 1re pour cohérence.
- **Pose** : `model.position.set(a.position.x, a.position.y, a.position.z)`,
  `model.rotation.y = a.rotationY`, `traverse` pour `castShadow/receiveShadow`,
  `experience.renderProfile.apply(scene)` si on veut le matériau unifié (cf. `CarRepairWorld`).
- **Zone d'interaction** : `const zone = new THREE.Sphere(posVec, a.triggerRadius)` puis
  `experience.interaction.registerTriggerZone(zone, a.id)`. Le `TriggerZoneDetector` émet
  `trigger:enter/leave { id }` quand la **caméra** entre/sort.
- **Prompt « E »** : à `trigger:enter`, afficher un overlay (voir §6.2). Le `E` est géré par
  `InteractionManager._onKeyDown` **uniquement si l'objet est aussi visé** (`_aimedId`, alimenté
  par `CrosshairTarget`/proximity). ⚠️ Les zones trigger **ne posent pas** `_aimedId`. Deux
  approches :
  1. **Écouter `E` soi-même** dans le manager quand on est `inside` une zone (simple, autonome) :
     `window.addEventListener('keydown', e => { if (e.code==='KeyE' && this._activeId) onEnterRepair(...) })`.
     C'est le plus robuste ici car on veut « E quand on est *dans la zone* », pas « E quand on
     vise un mesh ».
  2. Ou aussi `registerProximity(model, id, radius)` pour alimenter le système `interact`
     existant. Mais la sémantique « zone » colle mieux à l'option 1.
  Choisir l'option 1 (écoute clavier locale gardée par `this._activeId`).
- À l'appui **E** dans une zone active → `onEnterRepair(accident)`.

### 6.2 Prompt d'interaction — `components/InteractPromptHud.vue` + `composables/useInteractPrompt.js`

Petit overlay centré bas : « **E** Appuyez pour réparer » (texte = `accident.promptText`).
Suivre le pattern HUD du projet (cf. `docs/HUD.md`, `RepairHud.vue`) :
- Composable singleton `useInteractPrompt()` exposant `visible: ref(false)`, `text: ref('')` +
  `show(text)/hide()`.
- `CityWorld` (ou le manager via un callback) appelle `show/hide` sur `trigger:enter/leave`.
- `InteractPromptHud.vue` lit les refs, monté dans `index.vue` sous le bloc
  `v-if="isStarted && !pc.isActive.value"`.
- Bridge à passer dans `makeCallbacks()` : `onPromptShow`, `onPromptHide` (ou exposer directement
  le composable au World via callbacks, comme `onWorldReady`).

### 6.3 Déclenchement de la transition vers `car_repair`

`onEnterRepair(accident)` doit :
1. Mémoriser le contexte de réparation (modèle + JSON réparation) quelque part de lisible par
   `CarRepairWorld`. Le plus propre, vu l'archi callbacks : **passer le contexte via le
   `transitionTo`** plutôt qu'un global. Étendre `transitionTo` pour accepter un payload qui
   sera injecté dans les `callbacks` de la scène cible.

   Implémentation minimale dans `index.vue` :
   ```js
   let _pendingRepair = null   // { modelPath, repairFile }
   function transitionTo(name, { skipFlow = false, repairContext = null } = {}) {
     if (repairContext) _pendingRepair = repairContext
     ...
   }
   // dans makeCallbacks(): exposer onRepairContext: () => _pendingRepair
   ```
2. Appeler `callbacks.transitionTo('car_repair', { repairContext: { modelPath, repairFile } })`.
   Le World ville reçoit déjà `transitionTo` dans ses callbacks (cf. `makeCallbacks`).

> Le callback `transitionTo` est **déjà** passé à tous les Worlds via `makeCallbacks()`. Il faut
> juste que `CityWorld` le transmette au `CityAccidentManager` et que ce dernier l'appelle.

### 6.4 Câblage dans `CityWorld`

Dans `_setup()` (mode normal), après `_setupChunks()` :
```js
const accidents = await this._loadAccidents()   // fetch /settings/city_accidents.json
this._accidents = new CityAccidentManager(this.experience, accidents, {
  onEnterRepair: (acc) => this._callbacks.transitionTo?.('car_repair', {
    repairContext: { modelPath: acc.modelPath, repairFile: acc.repairFile },
  }),
  onPromptShow: (txt) => this._callbacks.onPromptShow?.(txt),
  onPromptHide: ()    => this._callbacks.onPromptHide?.(),
})
await this._accidents.loadModels()
this._accidents.spawn()
```
- `update()` : `this._accidents?.update(delta)`.
- `dispose()` : `this._accidents?.destroy()`.

---

## 7. `car_repair` paramétré par l'accident

Aujourd'hui `CarRepairWorld` charge en dur le modèle (`CarRepairSources.js`) et le JSON
(`'/data/car_repair_sample.json'`). Les rendre dynamiques.

### 7.1 Modèle dynamique

`CarRepairSources.js` est statique → ne peut pas porter le `modelPath` de l'accident. Options :
- **(Recommandé)** Faire de `CarRepairSources` une **fonction** `(ctx) => [...]` et adapter
  `FlowManager`/`SceneManager` pour accepter des sources résolues à partir du `repairContext`.
  C'est invasif (le resolver de scène dans `index.vue` retourne `sources` statiques).
- **(Plus simple, conseillé)** Laisser `CarRepairSources` **vide** (`[]`) et charger le modèle
  **dans le World** à partir de `repairContext.modelPath`, via un `Resources` interne (comme §6.1)
  dans `_setupModel()`. `CarRepairWorld` reçoit déjà `callbacks` → ajouter
  `callbacks.onRepairContext()` qui renvoie `{ modelPath, repairFile }`.

  `_setupModel()` devient async : si `ctx.modelPath`, charger le GLB dynamiquement ; sinon garder
  le placeholder/cube existant. Le reste (`traverse`, `renderProfile.apply`, caméra embarquée)
  est inchangé.

### 7.2 JSON réparation dynamique

Dans `CarRepairWorld._loadRepairData()`, remplacer l'URL en dur par :
```js
const ctx = this._callbacks.onRepairContext?.()
const url = ctx?.repairFile ? `/settings/${ctx.repairFile}` : '/data/car_repair_sample.json'
```
Le reste (`safeFetch` + `RepairParser`) est inchangé. Le fallback sample garde la scène jouable
en accès direct debug.

### 7.3 Passage du contexte

`index.vue#makeCallbacks()` ajoute :
```js
onRepairContext: () => _pendingRepair,   // défini par transitionTo(...)
```
`_pendingRepair` est consommé une fois (le remettre à `null` après lecture est optionnel ; le
laisser permet le rechargement de scène en debug).

---

## 8. Chaînage de sortie — `car_repair` → `scene_4`

Aujourd'hui :
- `RepairMarkerManager.confirmRepair()` émet `repair:done`, `CarRepairWorld` relaie via
  `callbacks.onRepairDone({ id, action })`.
- `VehicleInfoHud.vue` a un bouton **« Voiture en service »** qui `$emit('complete')` — **non
  câblé** dans `index.vue` (le composant y est monté sans `@complete`).

À implémenter :
- **Détection « toutes réparations faites »** : `useRepairState` connaît `doneRepairs` (Set) et
  peut connaître le total (depuis `repairData.repairs.length` reçu au `bind`). Exposer un
  `allDone` computed. Quand `allDone` (ou au clic « Voiture en service »), déclencher la sortie.
- **Câbler la sortie** dans `index.vue` : ajouter `@complete="onRepairComplete"` sur
  `VehicleInfoHud`, avec
  ```js
  function onRepairComplete() { transitionTo('scene_4') }   // flow scene_4 est vide → fondu + load
  ```
  Optionnellement n'autoriser le clic que si `repair.allDone.value`.
- Alternative auto : dans `CarRepairWorld`, après le dernier `repair:done`, appeler
  `callbacks.onAllRepairsDone?.()` → `transitionTo('scene_4')`. Choisir **un** déclencheur
  (bouton explicite recommandé pour l'UX : on valide la mise en service).

`scene_4` (`AtelierEndSceneWorld`) est déjà enregistrée dans `SCENES.js` avec `flow: []`.

---

## 9. Outil B — Page de création de réparation

Page Nuxt **séparée** (auteur, pas gameplay), p.ex. `app/pages/repair-builder.vue` (route
`/repair-builder`). But : produire un `<repairFile>.json` valide (§3.2) et, optionnellement,
l'associer à un accident existant.

### 9.1 Flux utilisateur

1. **Saisir un chemin MinIO** de modèle (`/models/vehicles/x.glb`) → bouton « Charger ».
2. Le modèle se charge (mini Experience ou loader autonome) et s'affiche **en X-ray**, toutes
   pièces visibles (réutiliser `createXray()` sur chaque mesh, ou OutlinePass au survol).
3. **Lister toutes les pièces** (meshes nommés du GLB) dans un panneau latéral.
4. **Sélectionner une pièce** (clic liste ou clic 3D via raycast) → highlight.
5. **« Ajouter à une réparation »** : crée/édite une entrée `repairs[]`, saisir `name`,
   `description`, `severity` (select bon/use/endommage/critique), `repairable`, `replaceable`,
   et les `pieces[]` (chaque pièce = `{ mesh: <nom réel>, name: <label saisi> }`).
6. Saisir aussi le bloc `vehicle` + `context/priority/repair_delay_days/available_parts/
   repair_history`.
7. **« Sauvegarder »** → `POST /api/settings/<repairFile>.json`.
8. **« Associer à un accident »** (optionnel) : dropdown des accidents de `city_accidents.json`,
   set `accident.repairFile = <repairFile>` + `accident.modelPath = <même modèle>`, puis
   `POST /api/settings/city_accidents.json`.

### 9.2 Construction de la scène d'aperçu

Réutiliser au maximum l'existant :
- **Loader** : un `Resources([{ name:'preview', type:'glb', path: assetPath(input) }])` et
  `on('ready')` → `items.preview.scene`. (Worker + DRACO gratuits.)
- **Rendu** : soit instancier une `Experience` complète (lourde mais cohérente, post-process), soit
  un mini-setup `WebGLRenderer + PerspectiveCamera + OrbitControls` autonome dans la page (plus
  léger pour un outil). Pour un outil auteur, un setup autonome `OrbitControls` est suffisant et
  évite d'embarquer le pipeline FPS.
- **Liste des meshes** : `model.traverse(o => { if (o.isMesh && o.name) parts.push(o.name) })`.
  ⚠️ Doublons de noms possibles : dédupliquer / avertir. Les noms collectés ici sont **exactement**
  ceux attendus par `pieces[].mesh` (garantit la cohérence avec `RepairBuilder`).
- **X-ray** : pour chaque mesh, appliquer `createXray({ color }).material` (sauvegarder l'original
  pour restaurer au besoin), exactement comme `RepairMarkerManager.enableXray()`.
- **Sélection 3D** : raycast souris classique (`Raycaster.setFromCamera`), remonter au mesh,
  highlight (changer couleur X-ray ou OutlinePass).

### 9.3 État & sauvegarde

- State Vue local (`reactive`) reproduisant la structure §3.2.
- Validation avant POST : `severity` valide, chaque `repair` a ≥1 pièce et un `id` slug unique.
- `await $fetch('/api/settings/' + repairFile, { method:'POST', body: repairJson })`.
- Le nom de fichier doit matcher la regex serveur `^[a-z0-9_]+\.json$`.

> Cette page est un **outil**. Pas besoin de soigner le SSR ni le mobile. Garder le composant
> lourd (Three) en montage client (`onMounted`), comme les autres pages 3D.

---

## 10. Découpage en phases (ordre de build conseillé)

Chaque phase est livrable/testable seule.

**Phase 0 — API d'écriture (§4)**
- `server/api/settings/[file].post.js` (+ `index.get.js` optionnel).
- Test : `curl -X POST localhost:3000/api/settings/test.json -d '{"a":1}'` → fichier créé.

**Phase 1 — Sortie réparation → scène 4 (§8)** *(le plus rapide, débloque la boucle)*
- `useRepairState.allDone` + câbler `@complete` de `VehicleInfoHud` → `transitionTo('scene_4')`.
- Test : accès debug à `car_repair`, réparer, cliquer « Voiture en service » → arrive scène 4.

**Phase 2 — `car_repair` paramétrable (§7)**
- `onRepairContext` callback ; modèle + JSON dynamiques avec fallback sample.
- Test : `transitionTo('car_repair', { repairContext:{ modelPath, repairFile } })` via le
  switcher debug temporaire → bon modèle + bon JSON.

**Phase 3 — Runtime ville (§6)**
- `CityAccidentManager` + `InteractPromptHud`/`useInteractPrompt` + câblage `CityWorld`.
- Données : un `city_accidents.json` minimal écrit à la main pour tester.
- Test : marcher en ville → entrer zone → prompt « E » → E → fondu → `car_repair` chargé.

**Phase 4 — Éditeur d'accidents debug (§5)**
- `CityAccidentEditor` + folder lil-gui + bouton sauvegarde (POST API).
- Test : `#debug`, « Poser ici », ajuster, « Sauvegarder » → JSON mis à jour, rechargement OK.

**Phase 5 — Page création réparation (§9)**
- `pages/repair-builder.vue` + scène aperçu + X-ray + formulaire + POST.
- Test : charger un modèle, créer 2 réparations, sauver, vérifier le JSON, jouer la réparation
  en ville.

Boucle complète validée quand : `scene_1 → scene_2 → scene_3 (ville) → [E sur véhicule] →
car_repair (bon modèle/JSON) → [réparer + service] → scene_4`.

---

## 11. Fichiers à créer / modifier (récap)

### À créer
| Fichier | Rôle |
|---|---|
| `server/api/settings/[file].post.js` | écrire un settings JSON (dev-only) |
| `server/api/settings/index.get.js` *(opt)* | lister les settings JSON |
| `public/settings/city_accidents.json` | données accidents (créé par l'éditeur ou à la main) |
| `public/settings/<repairFile>.json` | un JSON réparation par véhicule |
| `app/utils/three/world/city/CityAccidentManager.js` | runtime : pose véhicules + zones + E |
| `app/utils/three/world/city/CityAccidentEditor.js` | debug : pose/édite/sauve accidents |
| `app/components/InteractPromptHud.vue` | overlay « E pour réparer » |
| `app/composables/useInteractPrompt.js` | bridge prompt (singleton ref) |
| `app/pages/repair-builder.vue` | outil de création de réparation |

### À modifier
| Fichier | Modif |
|---|---|
| `app/utils/three/world/city/CityWorld.js` | `_setup()` : charger accidents + manager ; `_setupDebug()` : éditeur ; `update()`/`dispose()` |
| `app/utils/three/world/car_repair/CarRepairWorld.js` | modèle + JSON dynamiques via `onRepairContext` |
| `app/utils/three/world/car_repair/CarRepairSources.js` | passer à `[]` (modèle chargé dans le World) |
| `app/pages/index.vue` | `transitionTo(repairContext)`, `_pendingRepair`, `makeCallbacks()` (`onRepairContext`, `onPromptShow/Hide`), monter `InteractPromptHud`, câbler `@complete` de `VehicleInfoHud` |
| `app/composables/useRepairState.js` | `allDone` computed (total vs `doneRepairs`) |
| `PROGRESS.md` | refléter l'avancement (skill `sync-progress-md`) |

---

## 12. Pièges & points de vigilance

- **Écriture prod** : `public/` non writable après build → routes API gardées `import.meta.dev`.
  Le gameplay **lit** les JSON en statique (`/settings/x.json`), il ne dépend pas de l'API.
- **Lecture statique** : un fichier `public/settings/x.json` est servi à l'URL `/settings/x.json`.
- **`y` au sol** : poser les véhicules à `y ≈ 0.15` (`FLOOR_Y`), pas à la hauteur caméra.
- **Noms de mesh** : `pieces[].mesh` doit être le **nom exact** du GLB. L'outil §9 les lit
  directement → ne jamais les saisir à la main. Si un mesh est introuvable, `RepairBuilder` warn
  + position fallback (5 positions prédéfinies).
- **E dans une zone** : `InteractionManager._onKeyDown` exige `_aimedId` (visée crosshair). Les
  trigger zones ne le posent pas → le `CityAccidentManager` écoute `KeyE` lui-même, gardé par
  `_activeId` (zone courante). Penser à `removeEventListener` dans `destroy()`.
- **Chargement dynamique de GLB** : passer par un `Resources(sources)` (worker + DRACO) plutôt
  qu'un `GLTFLoader` nu, pour cohérence + décodage Draco. Le `Resources` du World courant
  (`experience.resources`) est dédié à la scène ; créer une **instance séparée** pour les modèles
  d'accidents/preview et la `dispose()`.
- **Double `ready`** : cf. garde `_setupDone` dans `CarRepairWorld` (Resources vide déclenche
  `ready` 2×). Reproduire ce garde si on rend `_setup()` async/dynamique.
- **Cleanup** : tout folder lil-gui, listener clavier, geometry/material X-ray créés doivent être
  `destroy()/dispose()` (règle `code-style.md`). Restaurer les matériaux originaux avant dispose
  (cf. `RepairMarkerManager.disableXray`).
- **`renderProfile.apply/restore`** : si on applique le matériau unifié aux véhicules ville,
  appeler `restore` au dispose (cf. `CarRepairWorld.dispose`).
- **Scope** : pas de refactor opportuniste de `FlowManager`/`SceneManager`. Le passage du
  `repairContext` se fait par les **callbacks** (`onRepairContext`), pas en réécrivant le resolver
  de scène (sources restent statiques, modèle chargé dans le World).
- **Commentaires** : aucun par défaut ; seulement pour un *pourquoi* non évident (cf. gardes
  `_setupDone`, `y` au sol). Pas de `// pour la quête X`.

---

## 13. Tests visuels (pas de tests unitaires dans le projet)

- `localhost:3000` — boucle complète scène par scène.
- `localhost:3000/#debug` — éditeur d'accidents (folder `City > Accidents`), mini-map coords,
  switcher de scènes (`Scènes > Aller à`).
- `localhost:3000/repair-builder` — outil de création de réparation.
- Vérifier dans `public/settings/` que les JSON écrits sont bien formés et relus sans warn
  (`RepairParser` ne doit pas filtrer de réparation ; aucun warn `mesh introuvable` de
  `RepairBuilder`).
