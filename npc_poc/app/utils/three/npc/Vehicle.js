/**
 * Vehicle — Abstract base class for vehicle body types.
 *
 * Defines the contract that concrete vehicle bodies must implement.
 * Used by VehicleNPC via composition (Strategy pattern).
 *
 * Subclasses MUST implement:
 *   createMesh()   → THREE.Object3D
 *   getWidth()     → number
 *   getLength()    → number
 *   getHeight()    → number
 *   getBaseSpeed() → number
 */
export default class Vehicle {
  constructor() {
    if (new.target === Vehicle) {
      throw new Error('Vehicle is abstract and cannot be instantiated directly.')
    }
  }

  /** @abstract @returns {THREE.Object3D} */
  createMesh() {
    throw new Error('Subclass must implement createMesh()')
  }

  /** @abstract @returns {number} */
  getWidth() {
    throw new Error('Subclass must implement getWidth()')
  }

  /** @abstract @returns {number} */
  getLength() {
    throw new Error('Subclass must implement getLength()')
  }

  /** @abstract @returns {number} */
  getHeight() {
    throw new Error('Subclass must implement getHeight()')
  }

  /** @abstract @returns {number} */
  getBaseSpeed() {
    throw new Error('Subclass must implement getBaseSpeed()')
  }
}
