/**
 * createPlexiglass
 *
 * Matériau acrylique dépoli (plexiglass).
 * MeshPhysicalMaterial avec transmission partielle et texture procédurale.
 *
 * Propriétés physiques :
 *   IOR     ≈ 1.49  (acrylique PMMA)
 *   Rough   ≈ 0.08  (légèrement dépoli)
 *   Trans   ≈ 0.92  (quasi-transparent)
 */

import * as THREE from 'three'
import { makePlexiTexture } from '../textures/makePlexiTexture'

export function createPlexiglass() {
  const texture = makePlexiTexture(512)

  const material = new THREE.MeshPhysicalMaterial({
    color:            0xaaddff,
    metalness:        0,
    roughness:        0.08,
    transmission:     0.92,
    thickness:        1.4,
    ior:              1.48,
    transparent:      true,
    side:             THREE.DoubleSide,
    envMapIntensity:  1.1,
    map:              texture,
    roughnessMap:     texture,
  })

  return {
    material,
    dispose() {
      texture.dispose()
      material.dispose()
    },
  }
}
