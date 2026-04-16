/**
 * Screen — écran interactif 3D rendu via CanvasTexture 2D
 *
 * États :
 *   'idle'   — fond sombre, "Click to interact"
 *   'active' — grille 2x2 de cards cliquables + bouton "Go Back"
 *
 * Interaction :
 *   Les coordonnées UV de l'intersection (fournies par InteractionManager)
 *   sont converties en pixels canvas pour le hit-test des zones cliquables.
 *   texture.needsUpdate = true est positionné à chaque redraw.
 */
import * as THREE from 'three'

const CANVAS_SIZE = 1024

const ITEMS = [
  { label: 'Projects', color: '#e74c3c' },
  { label: 'Skills',   color: '#3498db' },
  { label: 'About',    color: '#2ecc71' },
  { label: 'Contact',  color: '#f39c12' },
]

export default class Screen {
  constructor(experience) {
    this.experience = experience
    this.scene      = experience.scene

    this._state    = 'idle'
    this._hitZones = [] // [{ x, y, w, h, label }]

    this._setupCanvas()
    this._setupMesh()
    this._draw()

    console.log('Screen mesh created')
  }

  // ════════════════════════════════════════════════════════════
  //  Setup
  // ════════════════════════════════════════════════════════════

  _setupCanvas() {
    this._offscreen     = document.createElement('canvas')
    this._offscreen.width  = CANVAS_SIZE
    this._offscreen.height = CANVAS_SIZE
    this._ctx    = this._offscreen.getContext('2d')
    this._texture = new THREE.CanvasTexture(this._offscreen)
    this._texture.colorSpace = THREE.SRGBColorSpace
  }

  _setupMesh() {
    // Ratio 16:10 — représente l'écran d'un ordinateur portable
    const geo = new THREE.PlaneGeometry(3.2, 2, 1, 1)
    const mat = new THREE.MeshStandardMaterial({
      map:       this._texture,
      roughness: 0.25,
      metalness: 0.05,
      side:      THREE.FrontSide,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.position.set(0, 1.6, 0)
    this.scene.add(this.mesh)

    this._geo = geo
    this._mat = mat
  }

  // ════════════════════════════════════════════════════════════
  //  Canvas draw
  // ════════════════════════════════════════════════════════════

  _draw() {
    this._hitZones = []
    if (this._state === 'idle') {
      this._drawIdle()
    } else {
      this._drawActive()
    }
    this._texture.needsUpdate = true
  }

  _drawIdle() {
    const ctx = this._ctx
    const S   = CANVAS_SIZE

    // Fond
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, S, S)

    // Scanlines subtiles
    ctx.fillStyle = 'rgba(0,0,0,0.06)'
    for (let y = 0; y < S; y += 4) {
      ctx.fillRect(0, y, S, 2)
    }

    // Bordure lumineuse
    ctx.strokeStyle = 'rgba(80, 120, 230, 0.35)'
    ctx.lineWidth   = 10
    this._roundRect(ctx, 24, 24, S - 48, S - 48, 24)
    ctx.stroke()

    // Icône écran centrée (cercle pulsant — rendu statique)
    ctx.beginPath()
    ctx.arc(S / 2, S / 2 - 120, 48, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(100, 140, 255, 0.6)'
    ctx.lineWidth   = 4
    ctx.stroke()
    ctx.fillStyle   = 'rgba(100, 140, 255, 0.15)'
    ctx.fill()

    // Flèche vers le bas dans le cercle
    ctx.strokeStyle = 'rgba(180, 200, 255, 0.9)'
    ctx.lineWidth   = 5
    ctx.lineCap     = 'round'
    ctx.beginPath()
    ctx.moveTo(S / 2, S / 2 - 148)
    ctx.lineTo(S / 2, S / 2 - 92)
    ctx.moveTo(S / 2 - 18, S / 2 - 112)
    ctx.lineTo(S / 2,      S / 2 - 92)
    ctx.lineTo(S / 2 + 18, S / 2 - 112)
    ctx.stroke()

    // Titre principal
    ctx.fillStyle    = '#ffffff'
    ctx.font         = 'bold 64px system-ui, sans-serif'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Click to interact', S / 2, S / 2 + 20)

    // Sous-titre
    ctx.fillStyle = 'rgba(180, 200, 255, 0.5)'
    ctx.font      = '28px system-ui, sans-serif'
    ctx.fillText('Interactive 3D screen · POC', S / 2, S / 2 + 90)
  }

  _drawActive() {
    const ctx = this._ctx
    const S   = CANVAS_SIZE

    // Fond
    ctx.fillStyle = '#16213e'
    ctx.fillRect(0, 0, S, S)

    // Scanlines subtiles
    ctx.fillStyle = 'rgba(0,0,0,0.05)'
    for (let y = 0; y < S; y += 4) {
      ctx.fillRect(0, y, S, 2)
    }

    // Header
    ctx.fillStyle    = 'rgba(255,255,255,0.08)'
    ctx.fillRect(0, 0, S, 70)

    ctx.fillStyle    = '#ffffff'
    ctx.font         = 'bold 32px system-ui, sans-serif'
    ctx.textAlign    = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('Menu', 40, 35)

    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.font      = '24px system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText('Select an item', S - 40, 35)

    // Grille 2x2
    const cols    = 2
    const rows    = 2
    const padH    = 40
    const padTop  = 90
    const padBot  = 140 // réservé pour le bouton Go Back
    const gap     = 20
    const cardW   = (S - padH * 2 - gap * (cols - 1)) / cols
    const cardH   = (S - padTop - padBot - gap * (rows - 1)) / rows

    ITEMS.forEach((item, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x   = padH + col * (cardW + gap)
      const y   = padTop + row * (cardH + gap)

      // Ombre portée (dessin avant)
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      this._roundRect(ctx, x + 4, y + 6, cardW, cardH, 18)
      ctx.fill()

      // Card
      ctx.fillStyle = item.color
      this._roundRect(ctx, x, y, cardW, cardH, 18)
      ctx.fill()

      // Reflet supérieur
      const grad = ctx.createLinearGradient(x, y, x, y + cardH * 0.55)
      grad.addColorStop(0, 'rgba(255,255,255,0.22)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = grad
      this._roundRect(ctx, x, y, cardW, cardH * 0.55, 18)
      ctx.fill()

      // Numéro de l'item (petit, coin haut gauche)
      ctx.fillStyle    = 'rgba(255,255,255,0.4)'
      ctx.font         = '22px system-ui, sans-serif'
      ctx.textAlign    = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(`0${i + 1}`, x + 18, y + 14)

      // Label centré
      ctx.fillStyle    = '#ffffff'
      ctx.font         = 'bold 52px system-ui, sans-serif'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor  = 'rgba(0,0,0,0.4)'
      ctx.shadowBlur   = 8
      ctx.fillText(item.label, x + cardW / 2, y + cardH / 2)
      ctx.shadowBlur   = 0

      this._hitZones.push({ x, y, w: cardW, h: cardH, label: item.label })
    })

    // Bouton "Go Back"
    const btnW = 320
    const btnH = 72
    const btnX = (S - btnW) / 2
    const btnY = S - padBot + 20

    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    this._roundRect(ctx, btnX, btnY, btnW, btnH, 36)
    ctx.fill()

    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth   = 2
    this._roundRect(ctx, btnX, btnY, btnW, btnH, 36)
    ctx.stroke()

    ctx.fillStyle    = '#ffffff'
    ctx.font         = '600 30px system-ui, sans-serif'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('← Go Back', S / 2, btnY + btnH / 2)

    this._hitZones.push({ x: btnX, y: btnY, w: btnW, h: btnH, label: '__back__' })
  }

  // ════════════════════════════════════════════════════════════
  //  Hit-test via coordonnées UV
  // ════════════════════════════════════════════════════════════

  /**
   * Appelé par InteractionManager avec les UV de l'intersection.
   * UV.x ∈ [0,1] de gauche à droite, UV.y ∈ [0,1] de bas en haut (Three.js).
   *
   * @param {THREE.Vector2} uv
   */
  onUVClick(uv) {
    // Conversion UV → pixel canvas (Y inversé)
    const px = Math.round(uv.x * CANVAS_SIZE)
    const py = Math.round((1 - uv.y) * CANVAS_SIZE)
    console.log(`Canvas pixel hit: ${px}, ${py}`)

    if (this._state === 'idle') {
      this._state = 'active'
      this._draw()
      return
    }

    // Hit-test sur les zones enregistrées par _drawActive()
    for (const zone of this._hitZones) {
      if (px >= zone.x && px <= zone.x + zone.w
       && py >= zone.y && py <= zone.y + zone.h) {
        if (zone.label === '__back__') {
          console.log('Back to idle state')
          this._state = 'idle'
          this._draw()
        } else {
          console.log(`Item clicked: ${zone.label}`)
        }
        return
      }
    }
  }

  // ════════════════════════════════════════════════════════════
  //  Utilitaires canvas
  // ════════════════════════════════════════════════════════════

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }

  // ════════════════════════════════════════════════════════════
  //  Lifecycle
  // ════════════════════════════════════════════════════════════

  dispose() {
    this.scene.remove(this.mesh)
    this._geo.dispose()
    this._mat.dispose()
    this._texture.dispose()
  }
}
