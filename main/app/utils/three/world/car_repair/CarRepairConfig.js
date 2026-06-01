import * as THREE from '/lib/three.js'

export const SEVERITY_COLORS = {
  bon:       new THREE.Color(0x00ff88),
  use:       new THREE.Color(0xffcc00),
  endommage: new THREE.Color(0xff6600),
  critique:  new THREE.Color(0xff0044),
}

export const SEVERITY_ICONS = {
  bon:       '✓',
  use:       '▲',
  endommage: '!',
  critique:  '!!',
}

export const MARKER_HIT_RADIUS = 0.22
export const MARKER_HEIGHT_OFFSET = 0.4

export const SCENE = {
  BACKGROUND: 0xdce8f0,
  FOG_NEAR:   8,
  FOG_FAR:    30,
}

export const PROXIMITY_RADIUS = 6
