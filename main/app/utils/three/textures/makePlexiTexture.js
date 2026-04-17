/**
 * makePlexiTexture
 *
 * Génère procéduralement une texture pour l'acrylique dépoli :
 * — base bleutée
 * — rayures fines semi-transparentes
 * — taches brumeuses diffuses
 */

import * as THREE from 'three'

export function makePlexiTexture(size = 512) {
  const c   = document.createElement('canvas')
  c.width   = size
  c.height  = size
  const g   = c.getContext('2d')

  // Fond bleuté
  g.fillStyle = '#c8e8ff'
  g.fillRect(0, 0, size, size)

  // Rayures fines
  g.strokeStyle = 'rgba(255,255,255,0.18)'
  g.lineWidth   = 0.7
  for (let i = 0; i < 200; i++) {
    const x0  = Math.random() * size
    const y0  = Math.random() * size
    const len = Math.random() * 70 + 10
    const a   = Math.random() * Math.PI
    g.beginPath()
    g.moveTo(x0, y0)
    g.lineTo(x0 + Math.cos(a) * len, y0 + Math.sin(a) * len)
    g.stroke()
  }

  // Taches brumeuses
  for (let i = 0; i < 50; i++) {
    const r   = 60 + Math.random() * 70
    const grd = g.createRadialGradient(
      Math.random() * size, Math.random() * size, 0,
      Math.random() * size, Math.random() * size, r,
    )
    grd.addColorStop(0, 'rgba(255,255,255,0.06)')
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, size, size)
  }

  const tex    = new THREE.CanvasTexture(c)
  tex.wrapS    = THREE.RepeatWrapping
  tex.wrapT    = THREE.RepeatWrapping
  return tex
}
