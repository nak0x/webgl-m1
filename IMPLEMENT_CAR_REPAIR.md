# Implémentation — Scène Car Repair

Prompt complet pour Claude Sonnet 4.6 afin d'implémenter la scène de réparation de véhicule dans le projet `main/`.

---

## Contexte du projet

Projet : **Nuxt 4 + Three.js r183 + Vue 3**, pattern Experience. Scène FPS interactive avec système de quêtes. Le projet est dans `main/`.

Règles critiques :
- **Three.js r183** — import depuis `/lib/three.js` (pas `'three'`)
- **Nuxt 4** — dossier source `app/`, auto-imports actifs pour `utils/three/materials/*.js` et `utils/three/textures/*.js` (ne pas importer explicitement depuis ces dossiers)
- **Aucun commentaire** sauf si le POURQUOI est non-évident
- Chaque module qui crée des ressources Three.js expose un `destroy()` ou `dispose()`
- Vue ne pilote pas Three directement : Three émet via EventEmitter → composable réactif → composant HUD

### Archi Experience (résumé)

```
Experience
  ├── scene, camera, renderer, sizes, time, resources, debug
  ├── interaction (InteractionManager)
  │     registerHoverable(mesh, id)  → raycast hover
  │     registerProximity(obj, id, radius) → distance
  │     on('hover:enter', {id}) / on('hover:leave', {id}) / on('interact', {id})
  │     setFpsMode(bool)
  │     getInteractables() → Map<Object3D, id>   ← utilisé par CrosshairTarget
  └── renderer
        outlinePass          (blanc, CrosshairTarget)
        questOutlinePass     (gold, QuestIndicatorManager)
        indicatorScene       (rendu après tout, clearDepth=true)
        indicatorPass        (RenderPass sur indicatorScene)
```

**CrosshairTarget** : raycast depuis le centre (0,0) chaque frame sur `scene.children` (récursif), remonte la hiérarchie jusqu'au premier ancêtre présent dans `interaction.getInteractables()`, met à jour `outlinePass.selectedObjects` + `interaction.setAimedId(id)`.

**FpsController** : PointerLockControls + WASD + capsule collision. Touche **E** → `interaction.trigger('interact', { id: aimedId })` si `aimedId` est en proximité (vérification `ProximityDetector.getInsideIds()`).

**Markers = sprites dans `experience.scene`** (pas `indicatorScene`). Enregistrés via `registerHoverable` pour que CrosshairTarget les détecte. Les sprites ont `raycast = () => {}` désactivé par défaut dans Three.js Sprite — il faut le réactiver ou utiliser un `PlaneGeometry` billboard à la place.

> **Stratégie retenue pour les markers** : utiliser un `THREE.Mesh` avec `PlaneGeometry(0.15, 0.15)` et `SpriteMaterial` ne fonctionne pas. Utiliser à la place un `THREE.Sprite` **avec raycast réactivé** :
> ```js
> sprite.raycast = THREE.Mesh.prototype.raycast.bind(sprite)
> // ou plus simple : sprite.raycast = (raycaster, intersects) => {
> //   const dist = raycaster.ray.distanceToPoint(sprite.position)
> //   if (dist < 0.25) intersects.push({ distance: dist, point: sprite.position.clone(), object: sprite })
> // }
> ```
> Alternativement, utiliser un `THREE.Mesh` avec `PlaneGeometry` orienté billboard via `onBeforeRender`.

**createXray** est déjà dans `app/utils/three/materials/createXray.js` et **auto-importé par Nuxt**. Dans les modules Three (`.js`), l'importer explicitement :
```js
import { createXray } from '../../materials/createXray.js'
```

---

## Ce qui existe déjà (ne pas recréer)

| Fichier | Usage |
|---|---|
| `app/utils/three/materials/createXray.js` | Shader X-ray (fill + arêtes screen-space) |
| `app/utils/three/FpsController.js` | PointerLockControls + WASD |
| `app/utils/three/CrosshairTarget.js` | Raycast centre-écran + outline |
| `app/utils/three/interaction/InteractionManager.js` | Bus événements interaction |
| `app/utils/three/quest/QuestIndicatorManager.js` | Référence pour les sprites canvas |
| `app/utils/three/EventEmitter.js` | Base pub/sub |
| `app/utils/three/buildOctree.js` | Octree pour collision FPS |
| `app/utils/three/world/SCENES.js` | Registre des scènes |

---

## Objectif

Créer une nouvelle scène **CarRepairWorld** jouable en FPS dans laquelle :
1. Un véhicule GLB est posé dans la scène (garage ou atelier)
2. Des **markers 3D** (sprites billboard) flottent au-dessus des pièces en défaut, colorés selon la sévérité
3. Quand le crosshair vise un marker → **popup HUD** avec les détails de la réparation
4. Quand le joueur inspecte (touche E) → **mode X-ray** s'active sur les pièces concernées
5. Le joueur choisit Réparer ou Remplacer → le marker disparaît, les pièces reviennent à leur matériau normal
6. Les données sont **data-driven** : un JSON est parsé par `RepairParser` → `RepairBuilder` construit la scène

---

## Schéma JSON de données (`public/data/car_repair_sample.json`)

```json
{
  "vehicle": {
    "name": "Dacia Sandero",
    "year": 2030,
    "immatriculation": "ZZ-999-ZZ",
    "km": 200387,
    "fuel_level": 15,
    "fuel_type": "hydrogen"
  },
  "context": "Diagnostic embarqué : anomalie critique détectée sur le circuit hydrogène.",
  "priority": "urgent",
  "repair_delay_days": 3,
  "available_parts": [
    { "id": "filtre_h2", "name": "Filtre hydrogène", "available": true, "delivery_days": 0 },
    { "id": "regulateur_h2", "name": "Régulateur hydrogène", "available": false, "delivery_days": 1 }
  ],
  "repair_history": [
    { "date": "2050-01-03", "type": "moteur", "severity": "critique" },
    { "date": "2051-03-13", "type": "frein", "severity": "use" }
  ],
  "repairs": [
    {
      "id": "panne_moteur_h2",
      "name": "Panne moteur hydrogène",
      "description": "Blocage intermittent de la vanne de détente haute pression par givrage interne du circuit hydrogène.",
      "severity": "critique",
      "repairable": false,
      "replaceable": true,
      "pieces": [
        { "mesh": "moteur", "name": "Moteur hydrogène" },
        { "mesh": "vanne_hp", "name": "Vanne haute pression" }
      ]
    },
    {
      "id": "usure_frein_av",
      "name": "Usure frein avant",
      "description": "Plaquettes avant à 30% de vie restante. Remplacement préventif recommandé.",
      "severity": "use",
      "repairable": true,
      "replaceable": true,
      "pieces": [
        { "mesh": "frein_avant_gauche", "name": "Frein avant gauche" },
        { "mesh": "frein_avant_droit", "name": "Frein avant droit" }
      ]
    }
  ]
}
```

**Valeurs de sévérité** : `"bon"` | `"use"` | `"endommage"` | `"critique"`

---

## Fichiers à créer

### 1. `public/data/car_repair_sample.json`
Le JSON ci-dessus. Sert de données d'exemple.

---

### 2. `app/utils/three/world/car_repair/CarRepairConfig.js`

```js
export const SEVERITY_COLORS = {
  bon:       0x00ff88,
  use:       0xffcc00,
  endommage: 0xff6600,
  critique:  0xff0044,
}

// Icône (caractère) dessinée sur le canvas du sprite marker
export const SEVERITY_ICONS = {
  bon:       '✓',
  endommage: '!',
  critique:  '!!',
  use:       '▲',
}

// Rayon du hit-test manuel sur les sprites markers (unités Three.js)
export const MARKER_HIT_RADIUS = 0.22

export const SCENE = {
  BACKGROUND: 0xdce8f0,
  FOG_NEAR:   8,
  FOG_FAR:    30,
}

// Hauteur du marker au-dessus du centre de masse de la pièce (unités Three.js)
export const MARKER_HEIGHT_OFFSET = 0.35
```

---

### 3. `app/utils/three/world/car_repair/CarRepairSources.js`

```js
export default [
  { name: 'carRepair', type: 'gltf', path: '/models/car_repair.gltf' },
]
```

> Le modèle GLB n'existe pas encore. Le World doit gérer gracieusement l'absence du modèle (log warn + cube placeholder). Les noms de meshes (`moteur`, `vanne_hp`, etc.) seront mis à jour quand le vrai GLB sera disponible via `#debug`.

---

### 4. `app/utils/three/world/car_repair/RepairParser.js`

Lit un objet JSON brut et retourne un tableau de **RepairDefinition** :

```js
// RepairDefinition {
//   id: string
//   name: string
//   description: string
//   severity: 'bon'|'use'|'endommage'|'critique'
//   repairable: boolean
//   replaceable: boolean
//   pieces: Array<{ mesh: string, name: string }>
// }

export default class RepairParser {
  parse(json) {
    // valide que json.repairs est un tableau
    // pour chaque entry: retourne un RepairDefinition
    // ignorer les champs inconnus sans planter
  }

  parseVehicle(json) {
    // retourne { name, year, immatriculation, km, fuel_level, fuel_type }
  }

  parseMeta(json) {
    // retourne { context, priority, repair_delay_days, available_parts, repair_history }
  }
}
```

---

### 5. `app/utils/three/world/car_repair/RepairBuilder.js`

Prend les RepairDefinitions + la scène GLB chargée, et pour chaque réparation :
- Cherche les meshes par nom (`scene.getObjectByName(pieceDef.mesh)`)
- Si mesh absent → log warn, continue
- Calcule le centre de masse : `new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3())`
- Crée un sprite marker via `_makeMarkerSprite(severity)`
- Positionne le sprite au centre de masse + `MARKER_HEIGHT_OFFSET` en Y
- Retourne un tableau de **RepairMarker** : `{ repairDef, sprite, meshes, originalMaterials: null }`

**`_makeMarkerSprite(severity)`** : dessine sur un `OffscreenCanvas` (ou `document.createElement('canvas')`) 128×128 :
- Fond circulaire coloré selon `SEVERITY_COLORS[severity]`
- Contour sombre (strokeStyle `rgba(0,0,0,0.4)`, lineWidth 8)
- Texte `SEVERITY_ICONS[severity]` centré, blanc, bold, ~60px

```js
import * as THREE from '/lib/three.js'
import { SEVERITY_COLORS, SEVERITY_ICONS, MARKER_HEIGHT_OFFSET, MARKER_HIT_RADIUS } from './CarRepairConfig.js'

export default class RepairBuilder {
  build(repairDefs, gltfScene) { /* → RepairMarker[] */ }
  _makeMarkerSprite(severity) { /* → THREE.Sprite */ }
  _centerOf(object3d) { /* → THREE.Vector3 */ }
}
```

**Important** : les sprites Three.js ont `raycast` désactivé par défaut. Après création, remplacer le raycast par une sphère manuelle :

```js
const hitRadius = MARKER_HIT_RADIUS
sprite.raycast = function(raycaster, intersects) {
  const dist = raycaster.ray.distanceSqToPoint(this.position)
  if (dist < hitRadius * hitRadius) {
    intersects.push({
      distance: Math.sqrt(dist),
      point:    this.position.clone(),
      object:   this,
    })
  }
}
```

---

### 6. `app/utils/three/world/car_repair/RepairMarkerManager.js`

Gère les markers dans la scène + émet des events vers Vue :

```js
import EventEmitter from '../../EventEmitter.js'

// Events émis :
//   'inspect:open'   { repair: RepairDefinition } — crosshair vise le marker
//   'inspect:close'  {}                           — crosshair quitte le marker
//   'repair:done'    { id, action: 'repair'|'replace' } — joueur confirme

export default class RepairMarkerManager extends EventEmitter {
  constructor(experience, repairMarkers) {
    // repairMarkers: tableau de { repairDef, sprite, meshes }
    // Ajouter chaque sprite dans experience.scene
    // Enregistrer chaque sprite : experience.interaction.registerHoverable(sprite, repairDef.id)
  }

  // Appelé par le World sur interaction.on('hover:enter')
  onHoverEnter(id) {
    // Trouver le marker par id
    // Émettre 'inspect:open' avec la repairDef
  }

  // Appelé par le World sur interaction.on('hover:leave')
  onHoverLeave(id) {
    // Émettre 'inspect:close'
  }

  // Appelé par le World sur interaction.on('interact') ou depuis Vue
  enableXray(id) {
    // Trouver le marker
    // Sauvegarder originalMaterials de chaque mesh (Map<mesh, material|material[]>)
    // Appliquer createXray({ color: DAMAGE_COLORS[severity] }) sur chaque mesh
    // Garder les instances xray pour dispose
  }

  disableXray(id) {
    // Restaurer les originalMaterials
    // Dispose les instances xray
  }

  confirmRepair(id, action) {
    // disableXray(id)
    // Retirer le sprite de la scène + unregister
    // Dispose material/texture du sprite
    // Supprimer le marker du tableau
    // Émettre 'repair:done' { id, action }
  }

  update(delta) {
    // Animation optionnelle des markers : légère oscillation en Y (Math.sin)
    // elapsed += delta * 0.001
    // marker.sprite.position.y = baseY + Math.sin(elapsed * 2) * 0.04
  }

  destroy() {
    // Pour chaque marker : disableXray, retirer sprite, dispose sprite material
    // unregisterAll ids dans interaction
    // this._listeners = {}
  }
}
```

---

### 7. `app/utils/three/world/car_repair/CarRepairWorld.js`

```js
import * as THREE from '/lib/three.js'
import FpsController    from '../../FpsController.js'
import CrosshairTarget  from '../../CrosshairTarget.js'
import { buildOctree }  from '../../buildOctree.js'
import RepairParser     from './RepairParser.js'
import RepairBuilder    from './RepairBuilder.js'
import RepairMarkerManager from './RepairMarkerManager.js'
import { SCENE }        from './CarRepairConfig.js'

export default class CarRepairWorld {
  constructor(experience, callbacks = {}) {
    this.experience = experience
    this.scene      = experience.scene
    this.camera     = experience.camera
    this._callbacks = callbacks

    this._repairData    = null   // { vehicle, meta, repairs: RepairDefinition[] }
    this._markerManager = null
    this._xrayActive    = false  // id du repair actuellement en xray, ou null

    this.scene.background = new THREE.Color(SCENE.BACKGROUND)
    this.scene.fog = new THREE.Fog(SCENE.BACKGROUND, SCENE.FOG_NEAR, SCENE.FOG_FAR)

    experience.resources.on('ready', () => this._setup())
  }

  async _setup() {
    await this._loadRepairData()
    this._setupLights()
    this._setupModel()
    this._setupFloor()
    this._setupFps()
    this._setupMarkers()
    this._callbacks.onRepairReady?.(this._repairData)
    this._callbacks.onMarkerManagerReady?.(this._markerManager)
  }

  async _loadRepairData() {
    // fetch('/data/car_repair_sample.json') → parse avec RepairParser
    // stocker dans this._repairData
  }

  _setupLights() {
    // AmbientLight blanc chaud, 1.8
    // DirectionalLight key (4, 8, 4), castShadow, mapSize 1024
    // DirectionalLight fill (-5, 4, -2), bleu doux 0xddeeff
    // DirectionalLight rim (0, 3, -6) pour découpé silhouette véhicule
  }

  _setupModel() {
    const gltf = this.experience.resources.items.carRepair
    if (!gltf) {
      // Placeholder cube si modèle absent
      console.warn('[CarRepairWorld] Modèle GLB absent — cube placeholder')
      const geo = new THREE.BoxGeometry(2, 1, 4)
      const mat = new THREE.MeshStandardMaterial({ color: 0x888888 })
      this._placeholder = new THREE.Mesh(geo, mat)
      this._placeholder.position.set(0, 0.5, 0)
      this.scene.add(this._placeholder)
      this._placeholderGeo = geo
      this._placeholderMat = mat
      this._model = null
      return
    }
    this._model = gltf.scene
    this._model.traverse(c => {
      if (c.isMesh) {
        c.castShadow    = true
        c.receiveShadow = true
      }
    })
    this.scene.add(this._model)

    // Positionner caméra depuis GLB cam ou fallback
    if (gltf.cameras?.length > 0) {
      const gltfCam = gltf.cameras[0]
      gltfCam.updateWorldMatrix(true, false)
      const pos = new THREE.Vector3()
      const quat = new THREE.Quaternion()
      gltfCam.matrixWorld.decompose(pos, quat, new THREE.Vector3())
      this.camera.instance.position.copy(pos)
      this.camera.instance.quaternion.copy(quat)
    } else {
      this.camera.instance.position.set(4, 1.7, 4)
      this.camera.instance.lookAt(0, 0.5, 0)
    }
  }

  _setupFloor() {
    const geo = new THREE.PlaneGeometry(30, 30)
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 })
    const floor = new THREE.Mesh(geo, mat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.scene.add(floor)
    const grid = new THREE.GridHelper(30, 60, 0xcccccc, 0xdddddd)
    grid.position.y = 0.001
    this.scene.add(grid)
    this._floorGeo = geo
    this._floorMat = mat
    this._grid = grid
  }

  _setupFps() {
    const octreeRoot = this._model ?? this.scene
    this._fps = new FpsController(this.experience, buildOctree(octreeRoot))
    this._crosshairTarget = new CrosshairTarget(this.experience)
    this.experience.interaction.setFpsMode(true)
    this._callbacks.onFpsReady?.(this._fps)
  }

  _setupMarkers() {
    if (!this._repairData?.repairs?.length) return

    const gltfScene = this._model
    const builder = new RepairBuilder()
    const repairMarkers = builder.build(this._repairData.repairs, gltfScene)

    this._markerManager = new RepairMarkerManager(this.experience, repairMarkers)

    const { interaction } = this.experience

    interaction.on('hover:enter', ({ id }) => {
      const isRepair = repairMarkers.some(m => m.repairDef.id === id)
      if (!isRepair) return
      this._markerManager.onHoverEnter(id)
    })

    interaction.on('hover:leave', ({ id }) => {
      this._markerManager.onHoverLeave(id)
    })

    interaction.on('interact', ({ id }) => {
      const isRepair = repairMarkers.some(m => m.repairDef.id === id)
      if (!isRepair) return
      if (this._xrayActive === id) {
        this._markerManager.disableXray(id)
        this._xrayActive = null
        this._callbacks.onXrayChange?.(null)
      } else {
        if (this._xrayActive) {
          this._markerManager.disableXray(this._xrayActive)
        }
        this._markerManager.enableXray(id)
        this._xrayActive = id
        this._callbacks.onXrayChange?.(id)
      }
    })

    this._markerManager.on('repair:done', ({ id, action }) => {
      if (this._xrayActive === id) this._xrayActive = null
      this._callbacks.onRepairDone?.({ id, action })
    })
  }

  update() {
    this._fps?.update(this.experience.time.delta)
    this._crosshairTarget?.update()
    this._markerManager?.update(this.experience.time.delta)
  }

  resize() {}

  dispose() {
    this._markerManager?.destroy()
    this._fps?.dispose()
    this._crosshairTarget?.dispose()
    this.experience.interaction.setFpsMode(false)
    this._floorGeo?.dispose()
    this._floorMat?.dispose()
    this._placeholderGeo?.dispose()
    this._placeholderMat?.dispose()
    if (this._model) {
      this._model.traverse(c => {
        c.geometry?.dispose()
        const mats = Array.isArray(c.material) ? c.material : [c.material]
        mats.forEach(m => m?.dispose?.())
      })
    }
  }
}
```

---

### 8. `app/composables/useRepairState.js`

Singleton réactif bridgé sur `RepairMarkerManager` (EventEmitter) :

```js
// Exposer :
//   activeRepair: ref<RepairDefinition|null>   — repair actuellement inspecté (popup ouvert)
//   xrayRepairId: ref<string|null>             — id du repair en mode xray
//   vehicleInfo:  ref<VehicleInfo|null>        — infos véhicule
//   vehicleMeta:  ref<MetaInfo|null>           — context, priority, delay, parts, history
//   doneRepairs:  ref<Set<string>>             — ids des repairs confirmés
//
// Méthodes :
//   bind(markerManager, repairData)  — s'abonne aux events, hydrate vehicleInfo/vehicleMeta
//   confirmRepair(id, action)        — appelle markerManager.confirmRepair(id, action)
//   unbind()                         — détache les abonnements

export function useRepairState() {
  // pattern identique à useQuestState.js et useDialogueState.js
}
```

---

### 9. `app/components/RepairHud.vue`

Popup HUD qui s'ouvre quand `activeRepair` est non-null :

**Données affichées** :
- Nom de la réparation (`repair.name`)
- Description (`repair.description`)
- Sévérité : badge coloré (`bon` vert, `use` jaune, `endommage` orange, `critique` rouge)
- Liste des pièces concernées (`repair.pieces[].name`)
- Boutons : **Réparer** (si `repair.repairable`) et/ou **Remplacer** (si `repair.replaceable`)
- Indication si en mode X-ray (texte « Vue X-Ray activée »)

**Comportement** :
- S'affiche centré à gauche (comme le popup dans le prototype image)
- Animation fade-in CSS
- Pression des boutons → appelle `repairState.confirmRepair(id, 'repair')` ou `repairState.confirmRepair(id, 'replace')`

**Style** : inspiré du prototype (fond blanc ou crème, bordure gauche colorée selon sévérité, typographie nette). Adapter librement au look du projet (dark ui si nécessaire pour coller avec le jeu).

---

### 10. `app/components/VehicleInfoHud.vue`

Panel d'info véhicule fixé à droite (comme dans le prototype image) :

**Données affichées** (depuis `repairState.vehicleInfo` et `repairState.vehicleMeta`) :
- Nom du véhicule + badge priorité
- Jauge carburant + type
- Tableau : Année / Immatriculation / KM
- Section « Pièces disponibles » avec statut par pièce
- Section « Historique de réparation » (date + type + sévérité)
- Délai de réparation + bouton « Voiture en service » (déclenche `onComplete` callback)

Visible uniquement quand `vehicleInfo` est non-null.

---

### 11. `app/pages/car_repair.vue`

```vue
<template>
  <canvas ref="canvas" />

  <template v-if="isReady">
    <RepairHud
      :repair="repair.activeRepair.value"
      :xray-active="repair.xrayRepairId.value !== null"
      @confirm="(id, action) => repair.confirmRepair(id, action)"
    />
    <VehicleInfoHud
      :vehicle="repair.vehicleInfo.value"
      :meta="repair.vehicleMeta.value"
      :done-repairs="repair.doneRepairs.value"
    />
  </template>
</template>

<script setup>
import Experience       from '~/utils/three/Experience.js'
import CarRepairWorld   from '~/utils/three/world/car_repair/CarRepairWorld.js'
import CarRepairSources from '~/utils/three/world/car_repair/CarRepairSources.js'
import { useRepairState } from '~/composables/useRepairState.js'

const canvas   = useTemplateRef('canvas')
const repair   = useRepairState()
const isReady  = ref(false)

let experience = null
let world      = null

onMounted(() => {
  experience = new Experience(canvas.value, CarRepairSources)

  world = new CarRepairWorld(experience, {
    onRepairReady: (data) => {
      repair.bind(null, data)  // hydrate vehicleInfo/vehicleMeta
    },
    onMarkerManagerReady: (mgr) => {
      repair.bind(mgr, null)
      isReady.value = true
    },
    onFpsReady: (fps) => {
      fps.lock()
    },
    onXrayChange: (id) => {
      repair.xrayRepairId.value = id
    },
    onRepairDone: ({ id, action }) => {
      repair.doneRepairs.value.add(id)
    },
  })

  experience.setWorld(world)
})

onUnmounted(() => {
  experience?.dispose()
  repair.unbind()
  experience = null
  world      = null
})
</script>
```

---

### 12. Mise à jour de `app/utils/three/world/SCENES.js`

Ajouter la scène car_repair **sans impacter les scènes existantes** :

```js
import CarRepairWorld   from './car_repair/CarRepairWorld.js'
import CarRepairSources from './car_repair/CarRepairSources.js'

export const SCENES = {
  // ... scènes existantes inchangées ...
  'car_repair': {
    World:   CarRepairWorld,
    sources: CarRepairSources,
    flow:    [],
  },
}
```

> La page `car_repair.vue` monte directement son propre Experience (pattern simple comme poc_site/car_xray.vue), elle **n'utilise pas** le FlowManager ni SceneManager de `index.vue`. La mise à jour de SCENES.js est optionnelle — ne l'inclure que si le debug switcher doit accéder à cette scène.

---

## Résumé des fichiers à créer

```
public/data/
  car_repair_sample.json

app/utils/three/world/car_repair/
  CarRepairConfig.js
  CarRepairSources.js
  RepairParser.js
  RepairBuilder.js
  RepairMarkerManager.js
  CarRepairWorld.js

app/composables/
  useRepairState.js

app/components/
  RepairHud.vue
  VehicleInfoHud.vue

app/pages/
  car_repair.vue
```

---

## Ordre d'implémentation recommandé

1. `car_repair_sample.json` — données d'exemple
2. `CarRepairConfig.js` — constantes partagées
3. `CarRepairSources.js` — assets
4. `RepairParser.js` — transformation JSON → RepairDefinition[]
5. `RepairBuilder.js` — construction des sprites à partir des meshes GLTF
6. `RepairMarkerManager.js` — gestion des markers + xray
7. `CarRepairWorld.js` — world principal (assemble tout)
8. `useRepairState.js` — bridge réactif
9. `RepairHud.vue` + `VehicleInfoHud.vue` — overlays Vue
10. `car_repair.vue` — page Nuxt

---

## Vérification finale

Après implémentation, naviguer sur `/car_repair` :
- [ ] La scène charge (modèle ou placeholder cube visible)
- [ ] Le FPS fonctionne (clic → pointeur lock, WASD)
- [ ] Les markers apparaissent (sprites colorés selon sévérité)
- [ ] Viser un marker avec le crosshair → `RepairHud` apparaît avec les détails
- [ ] Touche E → mode X-ray s'active (matériaux des pièces deviennent translucides avec arêtes)
- [ ] Re-touche E → X-ray se désactive
- [ ] Cliquer Réparer/Remplacer → marker disparaît, X-ray désactivé
- [ ] `VehicleInfoHud` affiche les infos véhicule (nom, km, historique, pièces disponibles)
- [ ] `dispose()` ne génère pas d'erreurs à la navigation retour
