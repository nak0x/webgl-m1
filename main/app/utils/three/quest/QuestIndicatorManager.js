import * as THREE from '/lib/three.js'

/**
 * QuestIndicatorManager — indicateurs visuels sur la cible du step actif.
 *
 * Stratégies :
 *   'npc'  → Sprite Three.js (billboard 3D natif, face caméra) + ping au sol
 *   'pc'   → outline gold + screen pulse
 *   'item' → outline gold  (+ burst particules au pickup)
 *   'door' → outline gold + flèche HUD
 *
 * Règle outline : hover blanc (CrosshairTarget) prend le dessus sur gold.
 * Quand l'utilisateur vise la cible active → questOutlinePass se vide.
 * Quand il ne la vise plus → questOutlinePass reprend.
 */
export default class QuestIndicatorManager {
  constructor(experience, questManager, meshMap) {
    this._exp     = experience
    this._meshMap = meshMap
    this._elapsed = 0
    this._active  = null   // { type, mesh, cleanup[] }
    this._bursts  = []     // particules en vol
    this._arrowCallback   = null
    this._billboardSprite = null
    this._pingRing        = null
    this._screenMesh      = null

    this._onStepActive = ({ step }) => this._activate(step)

    this._onStepComplete = () => {
      if (this._active?.type === 'item' && this._active.mesh) {
        const wp = new THREE.Vector3()
        this._active.mesh.getWorldPosition(wp)
        this._spawnBurst(wp)
      }
      this._clear()
    }

    this._onQuestComplete = () => this._clear()

    questManager.on('step:active',    this._onStepActive)
    questManager.on('step:complete',  this._onStepComplete)
    questManager.on('quest:complete', this._onQuestComplete)
    this._questManager = questManager
  }

  setArrowCallback(fn) {
    this._arrowCallback = fn
  }

  // ── Activation / nettoyage ────────────────────────────────────────────────

  _activate(step) {
    this._clear()

    const type = step.indicator?.type
    if (!type) return

    const mesh = this._meshMap[step.trigger.id]
    if (!mesh) return

    this._elapsed = 0
    const cleanup = []

    switch (type) {
      case 'npc':  this._setupNpc(mesh, cleanup);  break
      case 'pc':   this._setupPc(mesh, cleanup);   break
      case 'item': this._setupItem(mesh, cleanup);  break
      case 'door': this._setupDoor(mesh, cleanup);  break
    }

    this._active = { type, mesh, cleanup }
  }

  _clear() {
    if (!this._active) return
    this._active.cleanup.forEach(fn => fn())
    this._active  = null
    this._arrowCallback?.(null)
  }

  // ── Stratégies ────────────────────────────────────────────────────────────

  _setupNpc(mesh, cleanup) {
    const sprite = this._makeBillboardSprite()

    const worldPos = new THREE.Vector3()
    mesh.getWorldPosition(worldPos)
    const box = new THREE.Box3().setFromObject(mesh)
    sprite.position.set(worldPos.x, box.max.y + 0.45, worldPos.z)
    sprite.scale.setScalar(0.35)

    this._exp.renderer.indicatorScene.add(sprite)
    this._billboardSprite = sprite

    const ping = this._makePing(worldPos.x, box.min.y, worldPos.z)
    this._exp.renderer.indicatorScene.add(ping)

    cleanup.push(
      () => {
        this._exp.renderer.indicatorScene.remove(sprite)
        sprite.material.map.dispose()
        sprite.material.dispose()
        this._billboardSprite = null
      },
      () => {
        this._exp.renderer.indicatorScene.remove(ping)
        ping.geometry.dispose()
        ping.material.dispose()
        this._pingRing = null
      },
    )
  }

  _setupPc(mesh, cleanup) {
    this._exp.renderer.questOutlinePass.selectedObjects = [mesh]

    const screenMesh = mesh.isMesh ? mesh : this._findFirstMesh(mesh)
    let originalEmissive = 0
    if (screenMesh?.material) {
      originalEmissive  = screenMesh.material.emissiveIntensity ?? 0
      this._screenMesh  = screenMesh
    }

    cleanup.push(
      () => { this._exp.renderer.questOutlinePass.selectedObjects = [] },
      () => {
        if (this._screenMesh?.material) {
          this._screenMesh.material.emissiveIntensity = originalEmissive
          this._screenMesh = null
        }
      },
    )
  }

  _setupItem(mesh, cleanup) {
    this._exp.renderer.questOutlinePass.selectedObjects = [mesh]

    cleanup.push(
      () => { this._exp.renderer.questOutlinePass.selectedObjects = [] },
    )
  }

  _setupDoor(mesh, cleanup) {
    this._exp.renderer.questOutlinePass.selectedObjects = [mesh]

    const worldPos = new THREE.Vector3()
    mesh.getWorldPosition(worldPos)
    this._doorWorldPos = worldPos
    this._arrowCallback?.(worldPos)

    cleanup.push(
      () => { this._exp.renderer.questOutlinePass.selectedObjects = [] },
      () => { this._doorWorldPos = null },
    )
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(delta) {
    this._updateBursts(delta)

    if (!this._active) return
    this._elapsed += delta * 0.001

    const { type, mesh } = this._active

    // Outline : hover blanc prend le dessus sur gold
    if (type !== 'npc') this._syncQuestOutline(mesh)

    if (type === 'npc') {
      this._updatePing(delta)
    }

    if (type === 'pc' && this._screenMesh?.material) {
      this._screenMesh.material.emissiveIntensity =
        0.4 + Math.sin(this._elapsed * 3) * 0.35
    }

    if (type === 'door' && this._doorWorldPos) {
      this._arrowCallback?.(this._doorWorldPos)
    }
  }

  // ── Outline sync ──────────────────────────────────────────────────────────

  _syncQuestOutline(mesh) {
    const hovered = this._exp.renderer.outlinePass.selectedObjects
    const isHovered = hovered.length > 0 && hovered.includes(mesh)
    const questPass = this._exp.renderer.questOutlinePass
    if (isHovered) {
      if (questPass.selectedObjects.length > 0) questPass.selectedObjects = []
    } else {
      if (questPass.selectedObjects.length === 0) questPass.selectedObjects = [mesh]
    }
  }

  // ── Particules burst ──────────────────────────────────────────────────────

  _spawnBurst(origin) {
    const COUNT = 24
    const positions  = new Float32Array(COUNT * 3)
    const velocities = []

    for (let i = 0; i < COUNT; i++) {
      positions[i * 3]     = origin.x
      positions[i * 3 + 1] = origin.y
      positions[i * 3 + 2] = origin.z

      const angle  = Math.random() * Math.PI * 2
      const spread = 0.5 + Math.random() * 1.5
      velocities.push(new THREE.Vector3(
        Math.cos(angle) * spread,
        1.5 + Math.random() * 2,
        Math.sin(angle) * spread,
      ))
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const mat = new THREE.PointsMaterial({
      color:       0xFFD700,
      size:        0.07,
      transparent: true,
      opacity:     1,
      depthWrite:  false,
      sizeAttenuation: true,
    })

    const points = new THREE.Points(geo, mat)
    this._exp.scene.add(points)
    this._bursts.push({ geo, mat, points, velocities, origin, elapsed: 0, duration: 700, count: COUNT })
  }

  _updateBursts(delta) {
    for (let i = this._bursts.length - 1; i >= 0; i--) {
      const b = this._bursts[i]
      b.elapsed += delta
      const t      = Math.min(b.elapsed / b.duration, 1)
      const posArr = b.geo.attributes.position.array

      for (let j = 0; j < b.count; j++) {
        const v = b.velocities[j]
        posArr[j * 3]     = b.origin.x + v.x * t
        posArr[j * 3 + 1] = b.origin.y + v.y * t - 3 * t * t   // gravité légère
        posArr[j * 3 + 2] = b.origin.z + v.z * t
      }

      b.geo.attributes.position.needsUpdate = true
      b.mat.opacity = 1 - t

      if (t >= 1) {
        this._exp.scene.remove(b.points)
        b.geo.dispose()
        b.mat.dispose()
        this._bursts.splice(i, 1)
      }
    }
  }

  // ── Ping au sol ───────────────────────────────────────────────────────────

  _makeBillboardSprite() {
    const SIZE = 128
    const canvas = document.createElement('canvas')
    canvas.width  = SIZE
    canvas.height = SIZE
    const ctx = canvas.getContext('2d')

    // Cercle gold
    ctx.beginPath()
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 4, 0, Math.PI * 2)
    ctx.fillStyle = '#FFD700'
    ctx.fill()

    // Contour sombre
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    ctx.lineWidth   = 6
    ctx.stroke()

    // "!"
    ctx.fillStyle   = '#000'
    ctx.font        = `bold ${SIZE * 0.62}px system-ui, sans-serif`
    ctx.textAlign   = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('!', SIZE / 2, SIZE / 2 + 2)

    const texture = new THREE.CanvasTexture(canvas)
    const mat     = new THREE.SpriteMaterial({
      map:         texture,
      transparent: true,
      depthTest:   false,
      depthWrite:  false,
    })
    const sprite = new THREE.Sprite(mat)
    sprite.raycast = () => {}   // exclut le sprite de tous les raycasts
    return sprite
  }

  _makePing(x, y, z) {
    const geo = new THREE.RingGeometry(0.3, 0.45, 32)
    const mat = new THREE.MeshBasicMaterial({
      color:       0xFFD700,
      transparent: true,
      opacity:     0.8,
      side:        THREE.DoubleSide,
      depthTest:   false,
      depthWrite:  false,
    })
    const ring = new THREE.Mesh(geo, mat)
    ring.rotation.x = -Math.PI / 2
    ring.position.set(x, y + 0.02, z)
    ring._pingT = 0
    this._pingRing = ring
    return ring
  }

  _updatePing(delta) {
    if (!this._pingRing) return
    this._pingRing._pingT += delta * 0.001
    const t = this._pingRing._pingT % 1
    this._pingRing.scale.setScalar(1 + t * 1.4)
    this._pingRing.material.opacity = (1 - t) * 0.8
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _findFirstMesh(object) {
    let found = null
    object.traverse(child => { if (!found && child.isMesh) found = child })
    return found
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  destroy() {
    this._clear()
    // Nettoie les bursts encore en vol
    for (const b of this._bursts) {
      this._exp.scene.remove(b.points)
      b.geo.dispose()
      b.mat.dispose()
    }
    this._bursts = []
    this._questManager.off('step:active',    this._onStepActive)
    this._questManager.off('step:complete',  this._onStepComplete)
    this._questManager.off('quest:complete', this._onQuestComplete)
  }
}
