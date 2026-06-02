import * as THREE from '/lib/three.js'
import { SEVERITY_COLORS, SEVERITY_ICONS, MARKER_HEIGHT_OFFSET, MARKER_HIT_RADIUS } from './CarRepairConfig.js'

const FALLBACK_POSITIONS = [
  new THREE.Vector3( 0,    0.9,  0.8),
  new THREE.Vector3( 0,    0.9, -0.8),
  new THREE.Vector3( 0.6,  0.9,  0),
  new THREE.Vector3(-0.6,  0.9,  0),
  new THREE.Vector3( 0,    1.4,  0),
]

export default class RepairBuilder {
  build(repairDefs, gltfScene) {
    return repairDefs.map((def, i) => {
      const meshes = def.pieces
        .map(p => {
          if (!gltfScene) return null
          const found = gltfScene.getObjectByName(p.mesh)
          if (!found) console.warn(`[RepairBuilder] mesh "${p.mesh}" introuvable dans le GLB`)
          return found
        })
        .filter(Boolean)

      const anchorPos = meshes.length > 0
        ? this._centerOf(meshes[0])
        : FALLBACK_POSITIONS[i % FALLBACK_POSITIONS.length].clone()

      const sprite = this._makeMarkerSprite(def.severity)
      sprite.position.set(anchorPos.x, anchorPos.y + MARKER_HEIGHT_OFFSET, anchorPos.z)
      sprite.scale.setScalar(0.28)

      return {
        repairDef:         def,
        sprite,
        meshes,
        baseY:             anchorPos.y + MARKER_HEIGHT_OFFSET,
        phase:             Math.random() * Math.PI * 2,
        originalMaterials: null,
        xrayInstances:     null,
      }
    })
  }

  _makeMarkerSprite(severity) {
    const SIZE  = 128
    const color = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.use
    const hex   = `#${color.getHexString()}`
    const icon  = SEVERITY_ICONS[severity] ?? '!'

    const canvas  = document.createElement('canvas')
    canvas.width  = SIZE
    canvas.height = SIZE
    const ctx = canvas.getContext('2d')

    ctx.beginPath()
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 4, 0, Math.PI * 2)
    ctx.fillStyle = hex
    ctx.fill()

    ctx.strokeStyle = 'rgba(0,0,0,0.45)'
    ctx.lineWidth   = 8
    ctx.stroke()

    ctx.fillStyle    = '#ffffff'
    ctx.font         = `bold ${icon.length > 1 ? 44 : 58}px system-ui, sans-serif`
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(icon, SIZE / 2, SIZE / 2 + 2)

    const texture = new THREE.CanvasTexture(canvas)
    const mat     = new THREE.SpriteMaterial({
      map:         texture,
      transparent: true,
      depthTest:   false,
      depthWrite:  false,
      sizeAttenuation: true,
    })

    const sprite = new THREE.Sprite(mat)
    sprite.renderOrder = 10

    const r = MARKER_HIT_RADIUS
    sprite.raycast = function(raycaster, intersects) {
      const distSq = raycaster.ray.distanceSqToPoint(this.position)
      if (distSq < r * r) {
        intersects.push({
          distance: Math.sqrt(distSq),
          point:    this.position.clone(),
          object:   this,
        })
      }
    }

    return sprite
  }

  _centerOf(object3d) {
    return new THREE.Box3().setFromObject(object3d).getCenter(new THREE.Vector3())
  }
}
