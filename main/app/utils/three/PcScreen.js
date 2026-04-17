/**
 * PcScreen — écran interactif via CSS3DRenderer
 *
 * Visibilité :
 *   - FPS mode    : CSS3D caché, dalle garde son matériau GLB
 *   - PC mode     : CSS3D visible + pointer-events auto, dalle transparente
 *
 * Debug (#debug) :
 *   - Flèche rouge sur le centre du plane → pointe dans la direction de la normale (+Z local)
 *   - Le contenu CSS3D apparaît du côté où la flèche pointe
 *   - Fond de l'iframe coloré pour confirmer visuellement le bon côté
 */
import * as THREE from 'three'
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js'

const TRANSITION_MS = 500

export default class PcScreen {
  /**
   * @param {import('./Experience.js').default} experience
   * @param {THREE.Object3D} screenMesh — mesh GLB nommé "dalle_css3d"
   * @param {string} [src] — URL à charger dans l'iframe (optionnel)
   */
  constructor(experience, screenMesh, src = '') {
    this._exp    = experience
    this._camera = experience.camera.instance
    this._scene  = experience.scene
    this._mesh   = screenMesh
    this._src    = src
    this._fps    = null

    this._active = false
    this._trans  = false
    this._tProg  = 0
    this._tDir   = 1

    this._fromPos  = new THREE.Vector3()
    this._fromQuat = new THREE.Quaternion()
    this._toPos    = new THREE.Vector3()
    this._toQuat   = new THREE.Quaternion()
    this._savedPos = new THREE.Vector3()
    this._savedQuat= new THREE.Quaternion()

    this._targetPos  = null
    this._targetQuat = null

    this._onKey = this._onKey.bind(this)
    this._onMsg = this._onMsg.bind(this)

    this._initRenderer()
    this._initObject()
    this._saveOriginalMaterial()
    this._initVisibility()

    if (experience.debug.active) this._initDebugArrow()
  }

  setFpsController(fps) { this._fps = fps }

  // ─── Setup ───────────────────────────────────────────────────────────────────

  _initRenderer() {
    const { width, height } = this._exp.sizes
    this._cssRenderer = new CSS3DRenderer()
    this._cssRenderer.setSize(width, height)

    const el = this._cssRenderer.domElement
    // Même position que le canvas (position:fixed inset:0 dans global.css)
    el.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;background:transparent;'
    document.body.appendChild(el)
  }

  _initObject() {
    this._mesh.updateWorldMatrix(true, false)

    // ── Dimensions : bounding box LOCAL (géométrie) × scale monde ──────────────
    // Le bounding box world-space est faussé par la rotation du mesh.
    // On lit les dimensions en espace local, puis on applique uniquement le scale.
    if (!this._mesh.geometry.boundingBox) this._mesh.geometry.computeBoundingBox()
    const localBox  = this._mesh.geometry.boundingBox
    const localSize = new THREE.Vector3()
    localBox.getSize(localSize)

    const worldScale = new THREE.Vector3()
    this._mesh.getWorldScale(worldScale)

    // Trie les 3 dimensions pour prendre les 2 plus grandes (la 3e ≈ 0 = épaisseur)
    const axes = [
      { v: Math.abs(localSize.x * worldScale.x), key: 'x' },
      { v: Math.abs(localSize.y * worldScale.y), key: 'y' },
      { v: Math.abs(localSize.z * worldScale.z), key: 'z' },
    ].sort((a, b) => b.v - a.v)

    this._worldW = axes[0].v  // plus grande dimension = largeur
    this._worldH = axes[1].v  // seconde = hauteur

    const PX_W = 1280
    const PX_H = this._worldH > 0 ? Math.round(PX_W * (this._worldH / this._worldW)) : 720

    this._iframe = document.createElement('iframe')
    this._iframe.style.cssText = `width:${PX_W}px;height:${PX_H}px;border:none;background:transparent;`

    if (this._src) {
      this._iframe.src = this._src
    } else {
      // Placeholder visible tant qu'aucune URL n'est définie via setSrc()
      this._iframe.srcdoc = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  *,html,body{margin:0;padding:0;box-sizing:border-box;width:100%;height:100%;}
  body{background:#1a003a;display:flex;align-items:center;justify-content:center;}
  p{color:#cc88ff;font:bold 32px monospace;text-align:center;line-height:1.6;}
  span{font-size:16px;opacity:.6;}
</style>
</head>
<body>
  <p>CSS3D FRONT<br><span>dalle_css3d</span></p>
</body>
</html>`
    }

    this._cssObj = new CSS3DObject(this._iframe)
    this._cssObj.scale.set(this._worldW / PX_W, this._worldH / PX_H, 1)

    // ── Position : centre visuel du mesh (pas l'origine qui peut être décalée) ──
    const worldCenter = new THREE.Vector3()
    new THREE.Box3().setFromObject(this._mesh).getCenter(worldCenter)
    this._cssObj.position.copy(worldCenter)

    // ── Rotation : construite depuis la normale réelle du plane ─────────────────
    // On ne copie PAS le quaternion du mesh (peut contenir des rotations Blender
    // qui ne correspondent pas à l'axe face du CSS3DObject).
    // On construit une base orthonormée : normal=Z, screenUp=Y, right=X
    const normal   = this._getGeometryNormal()

    // Axe "haut" du plane en world-space (local Y transformé)
    const worldQuat = new THREE.Quaternion()
    this._mesh.getWorldQuaternion(worldQuat)
    const screenUp = new THREE.Vector3(0, 1, 0).applyQuaternion(worldQuat).normalize()

    // Si normale et screenUp sont quasi-parallèles, fallback
    const up = Math.abs(normal.dot(screenUp)) > 0.99
      ? new THREE.Vector3(0, 0, 1)
      : screenUp

    const right = new THREE.Vector3().crossVectors(up, normal).normalize()
    const finalUp = new THREE.Vector3().crossVectors(normal, right).normalize()

    // makeBasis(X, Y, Z) → Z = normal = direction face du CSS3DObject
    const rotMat = new THREE.Matrix4().makeBasis(right, finalUp, normal)
    this._cssObj.quaternion.setFromRotationMatrix(rotMat)

    this._scene.add(this._cssObj)
  }

  _saveOriginalMaterial() {
    // Sauvegarde l'opacité d'origine pour pouvoir la restaurer à la sortie
    this._origOpacity     = []
    this._origTransparent = []
    this._mesh.traverse(child => {
      if (!child.isMesh) return
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      mats.forEach(m => {
        this._origOpacity.push(m.opacity)
        this._origTransparent.push(m.transparent)
      })
    })
  }

  // ─── Normale réelle depuis la géométrie ──────────────────────────────────────

  /**
   * Lit la normale du premier vertex du mesh (attribut geometry.normal).
   * Transformée en world-space → direction réelle de la face, indépendante
   * de l'orientation locale supposée (+Z, +Y, etc.)
   */
  _getGeometryNormal() {
    let target = null
    if (this._mesh.isMesh) {
      target = this._mesh
    } else {
      this._mesh.traverse(child => { if (child.isMesh && !target) target = child })
    }

    if (target?.geometry?.attributes?.normal) {
      const attr = target.geometry.attributes.normal
      const local = new THREE.Vector3(attr.getX(0), attr.getY(0), attr.getZ(0)).normalize()
      target.updateWorldMatrix(true, false)
      return local.transformDirection(target.matrixWorld).normalize()
    }

    // Fallback si la géométrie n'a pas d'attribut normal
    console.warn('PcScreen: pas de normal attribute, fallback +Z')
    const wq = new THREE.Quaternion()
    this._mesh.getWorldQuaternion(wq)
    return new THREE.Vector3(0, 0, 1).applyQuaternion(wq)
  }

  // ─── Visibilité (occlusion par les murs) ────────────────────────────────────

  _initVisibility() {
    this._visRaycaster  = new THREE.Raycaster()
    this._cssIsVisible  = false

    // Centre du plane en world-space (static — le mesh ne bouge pas)
    this._planeCenter = new THREE.Vector3()
    new THREE.Box3().setFromObject(this._mesh).getCenter(this._planeCenter)

    // Normale du plane (world-space)
    this._planeNormal = this._getGeometryNormal()

    // Cache le layer CSS3D par défaut
    this._cssRenderer.domElement.style.opacity = '0'
  }

  _updateVisibility() {
    // Pendant les transitions, l'opacité est gérée par enter()/exit() — ne pas interférer
    if (this._trans) return

    // En mode PC actif → toujours visible (caméra collée à l'écran)
    if (this._active) {
      this._setCssVisible(true)
      return
    }

    // 1. Back-face : la caméra regarde le dos du plane → caché
    const toCam = new THREE.Vector3().subVectors(this._camera.position, this._planeCenter)
    if (this._planeNormal.dot(toCam) <= 0) {
      this._setCssVisible(false)
      return
    }

    // 2. Raycast caméra → centre du plane — vérifie qu'aucun mur ne bloque
    const dirToPlane = toCam.clone().negate().normalize()
    this._visRaycaster.set(this._camera.position, dirToPlane)
    this._visRaycaster.far = toCam.length() + 0.1

    const hits = this._visRaycaster.intersectObjects(this._scene.children, true)

    if (hits.length === 0) {
      this._setCssVisible(false)
      return
    }

    // Le premier hit doit être le mesh de l'écran (ou un enfant)
    let obj = hits[0].object
    let isScreen = false
    while (obj) {
      if (obj === this._mesh) { isScreen = true; break }
      obj = obj.parent
    }

    this._setCssVisible(isScreen)
  }

  _setCssVisible(visible) {
    if (this._cssIsVisible === visible) return
    this._cssIsVisible = visible
    const el = this._cssRenderer.domElement
    if (visible) {
      el.style.display = 'block'
      el.style.opacity = '1'
    } else {
      el.style.opacity = '0'
    }
  }

  // ─── Debug : flèche normale ───────────────────────────────────────────────────

  _initDebugArrow() {
    const wp = new THREE.Vector3()
    this._mesh.updateWorldMatrix(true, false)
    this._mesh.getWorldPosition(wp)

    const normal = this._getGeometryNormal()

    this._arrowHelper = new THREE.ArrowHelper(
      normal,   // direction réelle lue depuis la géométrie
      wp,       // origine = centre du plane
      0.4,      // longueur
      0xff2200, // rouge
      0.12,     // taille tête
      0.06,     // largeur tête
    )
    // Désactive le raycast sur la flèche pour ne pas interférer avec _updateVisibility
    this._arrowHelper.traverse(obj => { obj.raycast = () => {} })
    this._scene.add(this._arrowHelper)
  }

  // ─── Target caméra ───────────────────────────────────────────────────────────

  _computeTarget() {
    // Utilise le centre visuel du plane (Box3) — pas l'origine Blender décalée
    const screenCenter = this._planeCenter.clone()

    const normal = this._getGeometryNormal()
    // S'assure que la normale pointe vers la caméra (bon côté)
    if (normal.dot(new THREE.Vector3().subVectors(this._camera.position, screenCenter)) < 0) {
      normal.negate()
    }

    const fovY  = THREE.MathUtils.degToRad(this._camera.fov)
    const fovX  = 2 * Math.atan(Math.tan(fovY / 2) * this._camera.aspect)
    const distW = (this._worldW / 2) / Math.tan(fovX / 2) / 0.9
    const distH = (this._worldH / 2) / Math.tan(fovY / 2) / 0.9

    // Caméra positionnée face au centre du plane → page centrée à l'écran
    this._targetPos = screenCenter.clone().addScaledVector(normal, Math.max(distW, distH))

    const m = new THREE.Matrix4().lookAt(this._targetPos, screenCenter, new THREE.Vector3(0, 1, 0))
    this._targetQuat = new THREE.Quaternion().setFromRotationMatrix(m)
  }

  // ─── Entrée / Sortie ─────────────────────────────────────────────────────────

  enter() {
    if (this._active || this._trans) return
    if (!this._targetPos) this._computeTarget()

    this._savedPos.copy(this._camera.position)
    this._savedQuat.copy(this._camera.quaternion)
    this._fromPos.copy(this._camera.position)
    this._fromQuat.copy(this._camera.quaternion)
    this._toPos.copy(this._targetPos)
    this._toQuat.copy(this._targetQuat)
    this._tDir  = 1
    this._tProg = 0
    this._trans = true

    if (this._fps) {
      this._fps.enabled = false
      this._fps.controls.unlock()
    }

    // Prépare le layer CSS3D invisible (opacity 0) — il fade in en fin de transition
    const el = this._cssRenderer.domElement
    el.style.display  = 'block'
    el.style.opacity  = '0'
    el.style.transition = 'opacity 0.25s ease'

    window.addEventListener('keydown', this._onKey)
    window.addEventListener('message', this._onMsg)
  }

  exit() {
    if (!this._active && !this._trans) return

    this._active = false
    this._fromPos.copy(this._camera.position)
    this._fromQuat.copy(this._camera.quaternion)
    this._toPos.copy(this._savedPos)
    this._toQuat.copy(this._savedQuat)
    this._tDir  = -1
    this._tProg = 0
    this._trans = true

    const el = this._cssRenderer.domElement
    el.style.pointerEvents = 'none'
    el.style.opacity = '0'

    window.removeEventListener('keydown', this._onKey)
    window.removeEventListener('message', this._onMsg)
  }

  _onKey(e) { if (e.key === 'Escape') this.exit() }
  _onMsg(e) { if (e.data?.type === 'pcscreen:exit') this.exit() }

  _onTransitionEnd() {
    this._trans = false
    if (this._tDir === 1) {
      this._active = true
      const el = this._cssRenderer.domElement
      el.style.pointerEvents = 'auto'
      el.style.opacity = '1'   // fade in CSS (0.25s)
    } else {
      // Fade out terminé → cache complètement et restaure
      this._cssRenderer.domElement.style.display = 'none'
      this._cssIsVisible = false   // permet à _updateVisibility de reprendre la main
      if (this._fps) this._fps.enabled = true
    }
  }

  // ─── Matériau dalle ──────────────────────────────────────────────────────────

  _setMeshOpacity(opacity) {
    this._mesh.traverse(child => {
      if (!child.isMesh) return
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      mats.forEach(m => {
        m.transparent = true
        m.opacity     = opacity
        m.needsUpdate = true
      })
    })
  }

  _restoreMeshOpacity() {
    let i = 0
    this._mesh.traverse(child => {
      if (!child.isMesh) return
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      mats.forEach(m => {
        m.transparent = this._origTransparent[i] ?? false
        m.opacity     = this._origOpacity[i]     ?? 1
        m.needsUpdate = true
        i++
      })
    })
  }

  // ─── Boucle ──────────────────────────────────────────────────────────────────

  update(deltaMs) {
    if (this._trans) {
      this._tProg = Math.min(1, this._tProg + deltaMs / TRANSITION_MS)
      const t = _ease(this._tProg)
      this._camera.position.lerpVectors(this._fromPos, this._toPos, t)
      this._camera.quaternion.slerpQuaternions(this._fromQuat, this._toQuat, t)
      if (this._tProg >= 1) this._onTransitionEnd()
    }

    this._updateVisibility()
    this._cssRenderer.render(this._scene, this._camera)
  }

  resize() {
    const { width, height } = this._exp.sizes
    this._cssRenderer.setSize(width, height)
  }

  dispose() {
    window.removeEventListener('keydown', this._onKey)
    window.removeEventListener('message', this._onMsg)
    this._scene.remove(this._cssObj)
    if (this._arrowHelper) this._scene.remove(this._arrowHelper)
    document.body.removeChild(this._cssRenderer.domElement)
  }

  /** Charge ou change l'URL affichée dans l'iframe */
  setSrc(url) {
    this._src = url
    this._iframe.src = url
  }
}

function _ease(t) { return t * t * (3 - 2 * t) }
