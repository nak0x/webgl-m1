/**
 * VehicleNPC — NPC that wraps a Vehicle body (composition / Strategy).
 *
 * Extends NPC and delegates mesh creation & dimensions to the
 * injected Vehicle instance.  This follows Dependency Inversion:
 * VehicleNPC depends on the abstract Vehicle, not on concrete car/bike.
 *
 * Uses the vehicle traffic network.
 */
import NPC from './NPC.js'

export default class VehicleNPC extends NPC {
  /**
   * @param {THREE.Scene}    scene
   * @param {TrafficNetwork} network  — vehicle network
   * @param {Vehicle}        vehicle  — concrete vehicle body
   * @param {object}         settings
   */
  constructor(scene, network, vehicle, settings = {}) {
    /** @type {Vehicle} */
    // Store before super() calls _createMesh()
    // We need a workaround since super() must be called first
    // and _createMesh() is called in NPC constructor.
    // Solution: attach vehicle to the instance before NPC constructor
    // uses a two-phase init pattern.

    // Temporarily stash vehicle on the class prototype won't work,
    // so we use a static "pending" slot.
    VehicleNPC._pendingVehicle = vehicle
    super(scene, network, settings)
    this._vehicle = vehicle
    VehicleNPC._pendingVehicle = null
  }

  static _pendingVehicle = null

  /* ── abstract implementations ───────────────────────────── */

  _createMesh() {
    const vehicle = VehicleNPC._pendingVehicle
    return vehicle.createMesh()
  }

  getWidth() {
    return this._vehicle?.getWidth() ?? VehicleNPC._pendingVehicle?.getWidth() ?? 1
  }

  getHeight() {
    return this._vehicle?.getHeight() ?? VehicleNPC._pendingVehicle?.getHeight() ?? 1
  }

  getBaseSpeed() {
    return this._vehicle?.getBaseSpeed() ?? VehicleNPC._pendingVehicle?.getBaseSpeed() ?? 5
  }

  /* ── cleanup ────────────────────────────────────────────── */

  dispose() {
    this._scene.remove(this.mesh)
    this._vehicle?.dispose()
  }
}
