/**
 * HumanNPC — pedestrian NPC represented by a capsule mesh.
 *
 * Extends NPC, implementing the abstract interface:
 *   _createMesh()  → capsule (radius 0.2, height 1.7)
 *   getWidth()     → 0.4
 *   getHeight()    → 1.7
 *   getBaseSpeed() → 1.5 (walking pace)
 *
 * Uses the pedestrian traffic network.
 */
import * as THREE from 'three'
import NPC from './NPC.js'

// Shared geometry + materials (instanced across all HumanNPCs)
let _sharedGeo = null
let _sharedMats = null
let _refCount = 0

const HUMAN_COLORS = [
  0xe74c3c, // red
  0x3498db, // blue
  0x2ecc71, // green
  0xf39c12, // orange
  0x9b59b6, // purple
  0x1abc9c, // teal
  0xe67e22, // dark orange
  0x34495e, // dark blue-grey
]

function _getSharedResources() {
  if (!_sharedGeo) {
    _sharedGeo = new THREE.CapsuleGeometry(0.2, 0.9, 4, 8)
  }
  if (!_sharedMats) {
    _sharedMats = HUMAN_COLORS.map(c =>
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.1 })
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

export default class HumanNPC extends NPC {
  /**
   * @param {THREE.Scene}    scene
   * @param {TrafficNetwork} network — pedestrian network
   * @param {object}         settings
   */
  constructor(scene, network, settings = {}) {
    super(scene, network, settings)
  }

  /* ── abstract implementations ───────────────────────────── */

  _createMesh() {
    const { geometry, materials } = _getSharedResources()
    const mat = materials[Math.floor(Math.random() * materials.length)]
    const mesh = new THREE.Mesh(geometry, mat)
    mesh.castShadow = true
    // Capsule center is at geometric center; shift up so feet touch ground
    mesh.position.y = 0.85
    // Wrap in a group so position.y=0 means feet on ground
    const group = new THREE.Group()
    group.add(mesh)
    return group
  }

  getWidth()     { return 0.4 }
  getHeight()    { return 1.7 }
  getBaseSpeed() { return 1.5 }

  /* ── cleanup override ───────────────────────────────────── */

  dispose() {
    this._scene.remove(this.mesh)
    _releaseSharedResources()
    // Don't dispose shared geometry/material, refcount handles it
  }
}
