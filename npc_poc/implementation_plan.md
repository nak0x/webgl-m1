# NPC City Simulation — Implementation Plan

## Overview

Build a procedural city scene (100×100 ground plane, grid buildings) with a living NPC system (pedestrians + cars) navigating weighted node networks, and an FPV camera for exploration. Everything integrates into the existing `Experience → World → EventEmitter` architecture.

---

## Architecture Critique & Enhancements

Before diving into files, here are design observations and improvements over the raw spec:

### ✅ What the spec does well
- **OOP + SOLID** — Abstract base classes, single-responsibility factory/controller split, dependency inversion via `Experience` references.
- **Node-weighted routing** — Probability-weighted next-node selection naturally creates main/secondary road patterns.
- **Frustum-based LOD** — Disabling "liberty area" (lateral wander) when off-screen is a great performance trick.

### ⚠️ Suggested Enhancements

| Area | Spec as written | Suggested improvement |
|---|---|---|
| **Collision rays** | "5+ units forward + width rays" | Use a single forward ray + 2 angled side rays (±15°). Cheaper than many parallel rays and catches diagonal obstacles too. |
| **Node data structure** | Implicit | Use a dedicated `TrafficNode` class with edges stored as `{ target: TrafficNode, weight: number }`. Clean graph traversal, easy to serialize later. |
| **Liberty area** | "freedom around lines" | Implement as a perpendicular offset clamped to a `libertyRadius` (e.g. 0.5 for humans, 0 for cars). Applied only when the NPC is in the camera frustum. |
| **NPC pooling** | Not mentioned | The `NPCController` should pool NPC meshes. When we "reduce" NPC count, we deactivate & hide rather than destroy+recreate geometry. Much cheaper. |
| **Two road networks** | "2 line per road opposite direction" | Model as a **directed graph**. Each physical road generates 2 directed edges (one per direction). Pedestrian network is a separate graph with its own nodes along sidewalks. |
| **Camera** | "simple FPV" | Use `PointerLockControls` from Three.js addons — battle-tested, handles mouse capture, Escape to release, etc. WASD movement layered on top. |
| **Abstract Vehicle** | "another abstract class" | Use the **Strategy** pattern: `Vehicle` is abstract, concrete `CarBody` / `BikeBody` provide mesh + dimensions. `NPC` composes with a `Vehicle` (or null for pedestrian). This respects **Liskov** better than multi-level inheritance. |

> [!IMPORTANT]
> **Breaking change to existing code**: The current `Camera.js` uses `OrbitControls`. For FPV we'll add a new `FPVCamera.js` and modify `Experience.js` to accept a camera strategy. The existing `Camera.js` stays untouched for other pages.

---

## Proposed Changes

### Component 1 — Core Infrastructure Modifications

#### [MODIFY] [Experience.js](file:///Users/nak0x/Code/Web/GL/npc_poc/app/utils/three/Experience.js)
- Add `setCamera(cameraInstance)` method so worlds can swap camera strategies (OrbitControls vs FPV).
- Pass `time.delta` as a parameter in the `_update()` chain so NPC movement is framerate-independent.

#### [NEW] [FPVCamera.js](file:///Users/nak0x/Code/Web/GL/npc_poc/app/utils/three/FPVCamera.js)
- FPV camera at human height (1.7 units).
- Uses `PointerLockControls` for mouse look.
- WASD movement with configurable speed.
- Implements same interface as `Camera` (`update()`, `resize()`, `dispose()`).
- Click-to-lock, Escape-to-release pointer.

#### [MODIFY] [nuxt.config.js](file:///Users/nak0x/Code/Web/GL/npc_poc/nuxt.config.js)
- Add `'utils/three/npc'` to auto-import dirs.

---

### Component 2 — City World

#### [NEW] [CityWorld.js](file:///Users/nak0x/Code/Web/GL/npc_poc/app/utils/three/world/CityWorld.js)
- 100×100 ground plane (dark asphalt material).
- Procedural grid of buildings (randomized heights 2–8 units, footprints 2×2 to 4×4).
- Roads as gaps in the building grid (every N units).
- Simple directional + ambient lighting with shadows.
- Instantiates `NPCController`, wires it into `update()`.
- Hooks into FPV camera.

#### [NEW] [citySources.js](file:///Users/nak0x/Code/Web/GL/npc_poc/app/utils/three/world/citySources.js)
- Empty sources array (all geometry is procedural).

---

### Component 3 — Node Network

#### [NEW] [TrafficNode.js](file:///Users/nak0x/Code/Web/GL/npc_poc/app/utils/three/npc/TrafficNode.js)
- `TrafficNode` class: `position: Vector3`, `edges: Array<{ node: TrafficNode, weight: number }>`.
- `getNextNode()` — weighted random selection from edges.
- `addEdge(targetNode, weight)`.

#### [NEW] [TrafficNetwork.js](file:///Users/nak0x/Code/Web/GL/npc_poc/app/utils/three/npc/TrafficNetwork.js)
- `TrafficNetwork` class: holds a list of `TrafficNode`s.
- `NetworkType` enum/string: `'vehicle'` or `'pedestrian'`.
- Static factory methods: `TrafficNetwork.createVehicleGrid(config)` and `TrafficNetwork.createPedestrianGrid(config)`.
- Vehicle grid: 2-lane (opposite direction) along city roads.
- Pedestrian grid: sidewalk-adjacent nodes around building perimeters.
- Optional debug visualization (line helpers).

---

### Component 4 — NPC System (OOP + SOLID)

#### [NEW] [NPC.js](file:///Users/nak0x/Code/Web/GL/npc_poc/app/utils/three/npc/NPC.js)
- **Abstract** base class.
- Properties: `mesh`, `currentNode`, `targetNode`, `speed`, `progress` (0→1 along edge), `isActive`.
- `type` discriminator: `'human'` or `'vehicle'`.
- `update(delta, camera)`:
  1. Move along edge line (lerp `currentNode.position → targetNode.position`).
  2. Apply liberty offset if in frustum.
  3. Cast collision rays, decelerate/stop if obstacle detected.
  4. On arrival at target, pick next node via `targetNode.getNextNode()`.
- `_castCollisionRays()` — forward ray + 2 side rays.
- `_isInFrustum(camera)` — frustum check.
- `dispose()`.
- Abstract: `_createMesh()`, `getWidth()`, `getHeight()`, `getSpeed()`.

#### [NEW] [HumanNPC.js](file:///Users/nak0x/Code/Web/GL/npc_poc/app/utils/three/npc/HumanNPC.js)
- Extends `NPC`.
- `_createMesh()` → capsule geometry (radius 0.25, height 1.7).
- `getWidth()` → 0.5, `getSpeed()` → 1.5 (walking speed).
- Uses pedestrian network.

#### [NEW] [Vehicle.js](file:///Users/nak0x/Code/Web/GL/npc_poc/app/utils/three/npc/Vehicle.js)
- **Abstract** class for vehicles.
- Defines `_createMesh()`, `getWidth()`, `getLength()`, `getSpeed()` as abstract.

#### [NEW] [CarVehicle.js](file:///Users/nak0x/Code/Web/GL/npc_poc/app/utils/three/npc/CarVehicle.js)
- Extends `Vehicle`.
- `_createMesh()` → rounded box (1×1×2), slightly beveled edges via `RoundedBoxGeometry` or manually chamfered `BoxGeometry`.
- `getWidth()` → 1, `getSpeed()` → 5.

#### [NEW] [VehicleNPC.js](file:///Users/nak0x/Code/Web/GL/npc_poc/app/utils/three/npc/VehicleNPC.js)
- Extends `NPC`.
- Composes with a `Vehicle` instance (dependency injection).
- `_createMesh()` delegates to `this.vehicle._createMesh()`.
- Uses vehicle network.

---

### Component 5 — Factory & Controller

#### [NEW] [NPCSettings.js](file:///Users/nak0x/Code/Web/GL/npc_poc/app/utils/three/npc/NPCSettings.js)
- `NPC_SETTINGS` const object:
```js
{
  humans: { count: 30, speed: 1.5, libertyRadius: 0.4 },
  cars:   { count: 15, speed: 5.0, libertyRadius: 0.0 },
  collisionRayLength: 5,
  sideRayAngle: 15, // degrees
  sideRayLength: 2,
}
```

#### [NEW] [NPCFactory.js](file:///Users/nak0x/Code/Web/GL/npc_poc/app/utils/three/npc/NPCFactory.js)
- `NPCFactory.createHuman(network, settings)` → `HumanNPC`.
- `NPCFactory.createCar(network, settings)` → `VehicleNPC` with `CarVehicle`.
- Picks a random starting node from the appropriate network.
- Applies settings (speed, liberty radius).

#### [NEW] [NPCController.js](file:///Users/nak0x/Code/Web/GL/npc_poc/app/utils/three/npc/NPCController.js)
- **Singleton** (enforced via static instance check).
- Constructor receives `experience`, `scene`, `vehicleNetwork`, `pedestrianNetwork`.
- `init(settings)` — uses `NPCFactory` to populate initial NPCs.
- `start()` / `pause()` — toggle `isRunning` flag.
- `addNPCs(type, count)` / `reduceNPCs(type, count)` — dynamically adjust.
- `update(delta, camera)` — iterates all active NPCs, calls `npc.update(delta, camera)`.
- `dispose()` — cleans up all NPCs.
- Emits events via `EventEmitter`: `'npc:spawned'`, `'npc:removed'`, `'npc:paused'`, `'npc:started'`.

---

### Component 6 — Page Integration

#### [MODIFY] [index.vue](file:///Users/nak0x/Code/Web/GL/npc_poc/app/pages/index.vue)
- Replace `MainWorld` + `mainSources` with `CityWorld` + `citySources`.
- Update HUD badges to show FPV controls instructions.
- Add click-to-start overlay for pointer lock.

#### [MODIFY] [global.css](file:///Users/nak0x/Code/Web/GL/npc_poc/app/assets/css/global.css)
- Add crosshair cursor style when pointer is locked.
- Style the click-to-start overlay.

---

## File Tree (new files)

```
app/utils/three/
├── FPVCamera.js
├── npc/
│   ├── TrafficNode.js
│   ├── TrafficNetwork.js
│   ├── NPC.js
│   ├── HumanNPC.js
│   ├── Vehicle.js
│   ├── CarVehicle.js
│   ├── VehicleNPC.js
│   ├── NPCFactory.js
│   ├── NPCController.js
│   └── NPCSettings.js
└── world/
    ├── CityWorld.js
    └── citySources.js
```

---

## Open Questions

> [!IMPORTANT]
> 1. **City scale**: You said 100×100 plane. Should buildings cover ~60% of the area with roads as gaps, or do you want a specific grid pattern (e.g. blocks of 8×8 buildings with 4-unit-wide roads)?

> [!IMPORTANT]  
> 2. **NPC counts**: I defaulted to 30 humans + 15 cars. Want different initial counts?

> [!IMPORTANT]
> 3. **Existing MainWorld**: Should I keep `MainWorld.js` and the current `index.vue` demo intact (just create a separate page), or replace them entirely with the city scene?

> [!WARNING]
> 4. **Pointer Lock**: FPV uses `PointerLockControls` which requires a user click to lock the mouse. The existing click-based raycasting in MainWorld won't work simultaneously. The city world will use a clean FPV-only input scheme.

---

## Verification Plan

### Automated Tests
- `npm run dev` — verify the app boots without errors.
- Browser subagent: navigate to page, click to lock pointer, verify camera movement with WASD.
- Verify NPCs are visible and moving along node paths.
- Verify collision rays stop NPCs before they clip through each other.

### Manual Verification
- Visual inspection of the city layout, building distribution, road network.
- Confirm NPC density feels alive but not overcrowded.
- Check that off-screen NPCs snap to strict line movement (no wasted liberty area computation).
- Spot-check weighted routing — main roads should have more traffic.
