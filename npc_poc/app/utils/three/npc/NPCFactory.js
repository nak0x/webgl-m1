/**
 * NPCFactory — creates NPC instances from settings and networks.
 *
 * Single Responsibility: only concerned with constructing configured NPCs.
 * Does NOT manage their lifecycle (that's NPCController's job).
 *
 * Factory Method pattern: static methods return fully configured NPC instances.
 */
import HumanNPC   from './HumanNPC.js'
import VehicleNPC from './VehicleNPC.js'
import CarVehicle from './CarVehicle.js'

export default class NPCFactory {
  /**
   * Create a pedestrian NPC and spawn it at a random node.
   * @param {THREE.Scene}    scene
   * @param {TrafficNetwork} pedestrianNetwork
   * @param {object}         settings — NPC_SETTINGS.humans + collision merged
   * @returns {HumanNPC}
   */
  static createHuman(scene, pedestrianNetwork, settings) {
    const npc = new HumanNPC(scene, pedestrianNetwork, {
      speed:             settings.speed,
      libertyRadius:     settings.libertyRadius,
      collisionRayLength: settings.collisionRayLength,
      sideRayAngle:      settings.sideRayAngle,
      sideRayLength:     settings.sideRayLength,
    })

    const startNode = pedestrianNetwork.getRandomNode()
    npc.spawn(startNode)
    return npc
  }

  /**
   * Create a car NPC and spawn it at a random node.
   * @param {THREE.Scene}    scene
   * @param {TrafficNetwork} vehicleNetwork
   * @param {object}         settings — NPC_SETTINGS.cars + collision merged
   * @returns {VehicleNPC}
   */
  static createCar(scene, vehicleNetwork, settings) {
    const vehicle = new CarVehicle()
    const npc = new VehicleNPC(scene, vehicleNetwork, vehicle, {
      speed:             settings.speed,
      libertyRadius:     settings.libertyRadius,
      collisionRayLength: settings.collisionRayLength,
      sideRayAngle:      settings.sideRayAngle,
      sideRayLength:     settings.sideRayLength,
    })

    const startNode = vehicleNetwork.getRandomNode()
    npc.spawn(startNode)
    return npc
  }
}
