/**
 * CarVehicle — concrete vehicle body for a car.
 *
 * Creates a 1×1×2 rounded box mesh to represent a simple car body.
 * Uses a slightly beveled BoxGeometry for the rounded feel.
 *
 * Extends Vehicle (Strategy pattern for body types).
 */
import * as THREE from 'three'
import Vehicle from './Vehicle.js'

// Shared geometry + materials
let _sharedGeo = null
let _sharedMats = null
let _refCount = 0

const CAR_COLORS = [
  0xcc3333, // red
  0x2255cc, // blue
  0x333333, // black
  0xcccccc, // silver
  0xdddd33, // yellow
  0x22aa44, // green
  0xff6600, // orange
  0x663399, // purple
]

function _getSharedResources() {
  if (!_sharedGeo) {
    // Simple box with slight bevel via segments — a true RoundedBoxGeometry
    // would need an addon, so we approximate with a box
    _sharedGeo = new THREE.BoxGeometry(1, 0.8, 2, 2, 2, 2)

    // Apply a slight vertex displacement to round edges
    const pos = _sharedGeo.attributes.position
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i))
      // Normalize corners slightly toward a rounded shape
      const len = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z))
      if (len > 0) {
        const scale = 1 - 0.05 * (v.length() / len - 1)
        v.multiplyScalar(scale)
        pos.setXYZ(i, v.x, v.y, v.z)
      }
    }
    pos.needsUpdate = true
    _sharedGeo.computeVertexNormals()
  }
  if (!_sharedMats) {
    _sharedMats = CAR_COLORS.map(c =>
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.5 })
    )
  }
  _refCount++
  return { geometry: _sharedGeo, materials: _sharedMats }
}

function _releaseSharedResources() {
  _refCount--
  if (_refCount <= 0) {
    _sharedGeo?.dispose()
    _sharedMats?.forEach(m => m.dispose())
    _sharedGeo = null
    _sharedMats = null
    _refCount = 0
  }
}

export default class CarVehicle extends Vehicle {
  constructor() {
    super()
  }

  createMesh() {
    const { geometry, materials } = _getSharedResources()
    const mat = materials[Math.floor(Math.random() * materials.length)]
    const mesh = new THREE.Mesh(geometry, mat)
    mesh.castShadow = true
    // Center car so bottom sits on ground
    mesh.position.y = 0.5
    const group = new THREE.Group()
    group.add(mesh)
    return group
  }

  getWidth()     { return 1.0 }
  getLength()    { return 2.0 }
  getHeight()    { return 0.8 }
  getBaseSpeed() { return 5.0 }

  /** Call when this vehicle body is no longer needed. */
  dispose() {
    _releaseSharedResources()
  }
}
