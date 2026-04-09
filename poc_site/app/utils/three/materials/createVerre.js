/**
 * createVerre
 *
 * Matériau verre crystal parfaitement transparent.
 * MeshPhysicalMaterial avec transmission totale, sans texture.
 *
 * Propriétés physiques :
 *   IOR     = 1.52  (verre borosilicaté)
 *   Rough   = 0.0   (surface parfaitement lisse)
 *   Trans   = 1.0   (totalement transparent)
 */

import * as THREE from 'three'

export function createVerre() {
  const material = new THREE.MeshPhysicalMaterial({
    color:             0xeef8ff,
    metalness:         0,
    roughness:         0.0,
    transmission:      1.0,
    thickness:         0.8,
    ior:               1.52,
    transparent:       true,
    side:              THREE.DoubleSide,
    envMapIntensity:   1.5,
    specularIntensity: 1,
    specularColor:     new THREE.Color(0xffffff),
  })

  return {
    material,
    dispose() { material.dispose() },
  }
}
