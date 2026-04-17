/**
 * makeWoodTexture
 *
 * Génère procéduralement une texture bois (chêne) :
 * — dégradé brun chaud en fond
 * — anneaux de croissance (ellipses concentriques décentrées)
 * — fibres longitudinales en bézier
 * — nœud de bois
 */

import * as THREE from 'three'

export function makeWoodTexture(size = 1024) {
  const c   = document.createElement('canvas')
  c.width   = size
  c.height  = size
  const g   = c.getContext('2d')

  // Fond brun chaud avec dégradé horizontal
  const bg = g.createLinearGradient(0, 0, size, 0)
  bg.addColorStop(0,    '#7a4a1e')
  bg.addColorStop(0.3,  '#9b6032')
  bg.addColorStop(0.7,  '#8a5225')
  bg.addColorStop(1,    '#6b3d14')
  g.fillStyle = bg
  g.fillRect(0, 0, size, size)

  // Anneaux de croissance
  const cx = size * 0.47
  const cy = size * 0.59
  for (let r = 18; r < size * 0.68; r += 14 + Math.random() * 10) {
    g.beginPath()
    g.ellipse(
      cx + (Math.random() - 0.5) * 40,
      cy + (Math.random() - 0.5) * 40,
      r,
      r * (0.55 + Math.random() * 0.15),
      (Math.random() - 0.5) * 0.4,
      0, Math.PI * 2,
    )
    const alpha = 0.1 + (r % 30 < 15 ? 0.25 : 0.08)
    g.strokeStyle = `rgba(30,10,0,${alpha})`
    g.lineWidth   = 0.8 + Math.random() * 1.5
    g.stroke()
  }

  // Fibres longitudinales (courbes de Bézier)
  for (let i = 0; i < 60; i++) {
    const x   = Math.random() * size
    const jit = () => (Math.random() - 0.5) * 30
    g.beginPath()
    g.moveTo(x + jit(), 0)
    g.bezierCurveTo(
      x + jit(), size * 0.3 + Math.random() * 100,
      x + jit(), size * 0.7 + Math.random() * 100,
      x + jit(), size,
    )
    g.strokeStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.07})`
    g.lineWidth   = 0.4 + Math.random() * 0.8
    g.stroke()
  }

  // Nœud de bois (ellipses concentriques)
  const kx = size * 0.625
  const ky = size * 0.293
  for (let r = 80; r > 4; r -= 10) {
    g.beginPath()
    g.ellipse(kx, ky, r * 0.4, r, 0.5, 0, Math.PI * 2)
    g.strokeStyle = `rgba(20,5,0,${0.15 + (80 - r) / 200})`
    g.lineWidth   = 1.2
    g.stroke()
  }

  const tex        = new THREE.CanvasTexture(c)
  tex.wrapS        = THREE.RepeatWrapping
  tex.wrapT        = THREE.RepeatWrapping
  tex.colorSpace   = THREE.SRGBColorSpace
  return tex
}
