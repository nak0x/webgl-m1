/**
 * createBois
 *
 * Matériau bois (chêne) avec texture procédurale.
 * MeshStandardMaterial PBR avec carte couleur et roughness élevée.
 *
 * Propriétés physiques :
 *   Rough     ≈ 0.72  (bois brut non poncé)
 *   Metalness = 0.0   (non métallique)
 */

import * as THREE from 'three'
import { makeWoodTexture } from '../textures/makeWoodTexture'

export function createBois() {
  const texture = makeWoodTexture(1024)

  const material = new THREE.MeshStandardMaterial({
    color:           0xffffff,
    roughness:       0.72,
    metalness:       0.0,
    map:             texture,
    envMapIntensity: 0.3,
  })

  return {
    material,
    dispose() {
      texture.dispose()
      material.dispose()
    },
  }
}
