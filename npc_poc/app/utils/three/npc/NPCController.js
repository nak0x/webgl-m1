/**
 * NPCController — Singleton that manages the lifecycle of all NPCs.
 *
 * Responsibilities:
 * - Initialise NPCs via NPCFactory from NPC_SETTINGS.
 * - start() / pause() the simulation.
 * - addNPCs() / reduceNPCs() dynamically (with object pooling).
 * - Per-frame update() delegation to all active NPCs.
 * - dispose() cleanup.
 *
 * Extends EventEmitter to broadcast lifecycle events:
 *   'npc:started', 'npc:paused', 'npc:spawned', 'npc:removed'
 *
 * Singleton: only one instance per application. Access via
 * NPCController.getInstance() after the first construction.
 */
import EventEmitter  from '../EventEmitter.js'
import NPCFactory    from './NPCFactory.js'
import NPC_SETTINGS  from './NPCSettings.js'

export default class NPCController extends EventEmitter {
  /** @type {NPCController|null} */
  static _instance = null

  /**
   * @param {Experience}      experience
   * @param {TrafficNetwork}  vehicleNetwork
   * @param {TrafficNetwork}  pedestrianNetwork
   * @param {THREE.Object3D[]} obstacles — static meshes for collision rays
   */
  constructor(experience, vehicleNetwork, pedestrianNetwork, obstacles = []) {
    if (NPCController._instance) {
      return NPCController._instance
    }
    super()

    this._experience   = experience
    this._scene        = experience.scene
    this._vehNetwork   = vehicleNetwork
    this._pedNetwork   = pedestrianNetwork
    this._obstacles    = obstacles

    /** @type {NPC[]} all NPCs (active + pooled) */
    this._humans  = []
    this._cars    = []

    this._isRunning = false

    NPCController._instance = this
  }

  /** @returns {NPCController} */
  static getInstance() {
    return NPCController._instance
  }

  /* ── initialisation ─────────────────────────────────────── */

  /**
   * Build the initial NPC population from NPC_SETTINGS.
   * @param {object} settings — (optional) override NPC_SETTINGS
   */
  init(settings = NPC_SETTINGS) {
    const colSettings = settings.collision ?? NPC_SETTINGS.collision
    const humanCfg = {
      ...settings.humans,
      collisionRayLength: colSettings.rayLength,
      sideRayAngle:       colSettings.sideRayAngle,
      sideRayLength:      colSettings.sideRayLength,
    }
    const carCfg = {
      ...settings.cars,
      collisionRayLength: colSettings.rayLength,
      sideRayAngle:       colSettings.sideRayAngle,
      sideRayLength:      colSettings.sideRayLength,
    }

    for (let i = 0; i < (settings.humans?.count ?? 30); i++) {
      const npc = NPCFactory.createHuman(this._scene, this._pedNetwork, humanCfg)
      this._humans.push(npc)
    }

    for (let i = 0; i < (settings.cars?.count ?? 15); i++) {
      const npc = NPCFactory.createCar(this._scene, this._vehNetwork, carCfg)
      this._cars.push(npc)
    }

    this.trigger('npc:spawned', {
      humans: this._humans.length,
      cars:   this._cars.length,
    })
  }

  /* ── simulation control ─────────────────────────────────── */

  start() {
    this._isRunning = true
    this.trigger('npc:started')
  }

  pause() {
    this._isRunning = false
    this.trigger('npc:paused')
  }

  get isRunning() { return this._isRunning }

  /* ── dynamic population ─────────────────────────────────── */

  /**
   * @param {'human'|'car'} type
   * @param {number}        count
   */
  addNPCs(type, count) {
    const colSettings = NPC_SETTINGS.collision
    const pool = type === 'human' ? this._humans : this._cars

    for (let i = 0; i < count; i++) {
      // Try to reactivate a pooled (inactive) NPC first
      const inactive = pool.find(n => !n.isActive)
      if (inactive) {
        const network = type === 'human' ? this._pedNetwork : this._vehNetwork
        inactive.activate(network.getRandomNode())
      } else {
        // Create a new one
        const cfg = {
          ...(type === 'human' ? NPC_SETTINGS.humans : NPC_SETTINGS.cars),
          collisionRayLength: colSettings.rayLength,
          sideRayAngle:       colSettings.sideRayAngle,
          sideRayLength:      colSettings.sideRayLength,
        }
        const network = type === 'human' ? this._pedNetwork : this._vehNetwork
        const npc = type === 'human'
          ? NPCFactory.createHuman(this._scene, network, cfg)
          : NPCFactory.createCar(this._scene, network, cfg)
        pool.push(npc)
      }
    }
    this.trigger('npc:spawned', { type, added: count, total: pool.filter(n => n.isActive).length })
  }

  /**
   * @param {'human'|'car'} type
   * @param {number}        count
   */
  reduceNPCs(type, count) {
    const pool = type === 'human' ? this._humans : this._cars
    let removed = 0

    for (let i = pool.length - 1; i >= 0 && removed < count; i--) {
      if (pool[i].isActive) {
        pool[i].deactivate()
        removed++
      }
    }
    this.trigger('npc:removed', { type, removed, total: pool.filter(n => n.isActive).length })
  }

  /* ── per-frame ──────────────────────────────────────────── */

  /**
   * @param {number}       delta  — ms since last frame
   * @param {THREE.Camera} camera — active rendering camera
   */
  update(delta, camera) {
    if (!this._isRunning) return

    // Collect active NPC meshes as obstacles for each other
    const allNPCMeshes = []
    for (const npc of this._humans) {
      if (npc.isActive) allNPCMeshes.push(npc.mesh)
    }
    for (const npc of this._cars) {
      if (npc.isActive) allNPCMeshes.push(npc.mesh)
    }

    // Combine static obstacles with NPC meshes
    const obstacles = [...this._obstacles, ...allNPCMeshes]

    for (const npc of this._humans) {
      if (npc.isActive) {
        // Exclude self from obstacle list
        const selfIdx = obstacles.indexOf(npc.mesh)
        if (selfIdx !== -1) obstacles.splice(selfIdx, 1)
        npc.update(delta, camera, obstacles)
        if (selfIdx !== -1) obstacles.splice(selfIdx, 0, npc.mesh)
      }
    }
    for (const npc of this._cars) {
      if (npc.isActive) {
        const selfIdx = obstacles.indexOf(npc.mesh)
        if (selfIdx !== -1) obstacles.splice(selfIdx, 1)
        npc.update(delta, camera, obstacles)
        if (selfIdx !== -1) obstacles.splice(selfIdx, 0, npc.mesh)
      }
    }
  }

  /* ── cleanup ────────────────────────────────────────────── */

  dispose() {
    for (const npc of this._humans) npc.dispose()
    for (const npc of this._cars)   npc.dispose()
    this._humans = []
    this._cars   = []
    this._isRunning = false
    NPCController._instance = null
  }
}
