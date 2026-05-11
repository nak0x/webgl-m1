# World System

A **World** is the class responsible for a single scene: it loads assets, populates the `THREE.Scene`, sets up interactions and quest steps, and exposes `update(delta)` and `dispose()`.

---

## File conventions

Each scene lives in its own subfolder under `app/utils/three/world/`:

```
world/
└── atelier/
    ├── AtelierWorld.js      ← the World class
    ├── AtelierSources.js    ← asset list
    └── AtelierConfig.js     ← constants (object names, radii, etc.)
```

This three-file pattern keeps the World class focused on wiring while externalising the data that changes most often (config) and the asset manifest (sources).

---

## SCENES.js registry

**`app/utils/three/world/SCENES.js`**

A central map from scene name to World class:

```js
export const SCENES = {
  atelier: AtelierWorld,
  hub:     HubWorld,
  city:    CityWorld,
}
```

`pages/index.vue` uses this to instantiate the correct World when transitioning:

```js
import { SCENES } from '~/utils/three/world/SCENES.js'
const WorldClass = SCENES[sceneName]
const world = new WorldClass(experience)
```

---

## World API (contract every World must follow)

### Constructor

```js
constructor(experience) {
  this.experience = experience
  this.scene      = experience.scene
  this.resources  = experience.resources
  // … load assets, create managers, subscribe to 'ready'
}
```

### Lifecycle methods

| Method | Called by | When |
|--------|-----------|------|
| `update(delta)` | `Experience._update()` | Every frame (delta in ms) |
| `resize()` | `Experience._resize()` | Window resize (optional) |
| `dispose()` | `pages/index.vue` | Before scene transition or page unmount |

### Minimum setup pattern

```js
import AtelierSources from './AtelierSources.js'

export default class AtelierWorld {
  constructor(experience) {
    this.experience = experience
    this.scene      = experience.scene
    this.resources  = experience.resources

    this.resources.setSources(AtelierSources)
    this.resources.load()
    this.resources.on('ready', () => this._onLoad())
  }

  _onLoad() {
    this._setupLights()
    this._setupModel()
    this._setupQuest()
  }

  update(delta) {
    this.fpsController?.update(delta)
  }

  dispose() {
    this.fpsController?.dispose()
    this.quest?.dispose()
    this.dialogue?.dispose()
    // dispose geometries and materials you created manually
  }
}
```

---

## Existing scenes

### AtelierWorld — Workshop (scene_1)

**Path:** `app/utils/three/world/atelier/AtelierWorld.js`
**Model:** `/models/atelier_1.4.0.glb` (Draco-compressed)

The default starting scene. A workshop/office interior with:

- Warm ambient light + ceiling directional with shadow casting
- Fill light (cool blue) from the side
- Dense dark fog (near 20, far 60)
- Optional procedural floor plane

**Quest progression (4 steps):**

| Step ID | Trigger | Action |
|---------|---------|--------|
| `talk_npc` | Proximity + E → `coffee_machine` | Open 3-line dialogue |
| `use_pc` | Proximity + E → `computer` | Open PC screen content |
| `pick_tool` | Proximity + E → `glasses` | Remove mesh from scene |
| `exit_door` | TriggerZone → door area | Transition to `hub` scene |

**Config file:** `AtelierConfig.js` — holds object names, proximity radii, and dialogue content.

---

### HubWorld — Lounge (scene_2)

**Path:** `app/utils/three/world/hub/HubWorld.js`
**Model:** `/models/hub/hub.glb`

A lounge / corridor area connecting to other scenes.

- Objects: `wrench`, `screwdrivers`, `screw_box`, `door`
- FPS + capsule collision enabled

---

### CityWorld — Open world (scene_3)

**Path:** `app/utils/three/world/city/CityWorld.js`
**Config:** `app/utils/three/world/city/CityConfig.js`

A streamed open-world city using the chunk format produced by the [City Chunker](external-tools/CITY_CHUNKER.md).

#### Chunk streaming

`CityChunkManager` reads `manifest.json` and loads/unloads GLTF chunks based on the player's XZ position. Each chunk is a 64×64 world-unit cell.

**LOD selection** uses Chebyshev distance from the player's current chunk:

| Chebyshev ring | LOD |
|---------------|-----|
| 0–1 (nearby) | LOD 0 (full detail) |
| 2 | LOD 1 (≈75% reduction) |
| 3 | LOD 2 (≈94% reduction) |
| > 3 | Unloaded |

The manifest format is documented in [`external-tools/CITY_CHUNKER.md`](external-tools/CITY_CHUNKER.md#12-manifest-schema).

#### Lighting

Pre-sunset warm palette:
- Sun from WSW (warm yellow)
- Fill light from ENE (cool blue)
- Hemisphere (sky warm, ground dark)
- Exponential golden haze fog

#### Sky

A simple gradient sky using `THREE.Mesh` + custom shader — no HDR environment map.

---

## Creating a new World

Use the `/new-world` skill (or copy the templates manually):

```bash
# In Claude Code:
/new-world RepairShop
```

This scaffolds three files from the templates:

| Template | Output |
|----------|--------|
| `_TemplateWorld.js` | `world/repair-shop/RepairShopWorld.js` |
| `_templateSources.js` | `world/repair-shop/RepairShopSources.js` |
| `_TemplatePage.vue` | (optionally) `pages/repair-shop.vue` |

### Manual steps after scaffolding

1. Add an entry to `SCENES.js`:
   ```js
   import RepairShopWorld from './repair-shop/RepairShopWorld.js'
   export const SCENES = { …, repairShop: RepairShopWorld }
   ```

2. Populate `RepairShopSources.js` with the GLB path.

3. Define object names in `RepairShopConfig.js` using `#debug` to find the real mesh names.

4. Implement `_setupLights()`, `_setupModel()`, and `_setupQuest()` in the World class.

---

## Config file pattern

```js
// AtelierConfig.js
export const OBJECTS = {
  NPC:    'coffee_machine',
  PC:     'computer',
  TOOL:   'glasses',
  DOOR:   'door_in',
  SCREEN: 'dalle_css3d',
}

export const PROXIMITY = {
  NPC:  2.5,   // metres
  PC:   1.8,
  TOOL: 1.5,
  DOOR: 2.0,
}
```

Import these in the World class instead of hard-coding strings:

```js
import { OBJECTS, PROXIMITY } from './AtelierConfig.js'

experience.interaction.registerProximity(npcMesh, OBJECTS.NPC, PROXIMITY.NPC)
```

This way, when GLB mesh names change (after a model update), only the config file needs to be updated.

---

## Template files

Do not modify these without discussion — they are the baseline for new scenes:

| File | Purpose |
|------|---------|
| `app/utils/three/world/_TemplateWorld.js` | Minimal World skeleton |
| `app/utils/three/world/_templateSources.js` | Empty sources array |
| `app/pages/_TemplatePage.vue` | Page template with canvas + HUDs |
