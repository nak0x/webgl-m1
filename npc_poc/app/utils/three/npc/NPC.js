/**
 * NPC — Abstract base class for all NPCs (pedestrians and vehicles).
 *
 * Responsibilities:
 * - Move along traffic-network edges (node-to-node interpolation).
 * - Apply lateral "liberty area" offset when visible in camera frustum.
 * - Cast forward + side collision rays to avoid clipping.
 * - Pick next node on arrival via weighted-random selection.
 *
 * Subclasses MUST implement:
 *   _createMesh()   → THREE.Object3D
 *   getWidth()      → number       (body half-width for side rays)
 *   getHeight()     → number       (ray origin height)
 *   getBaseSpeed()  → number       (units/second before settings multiplier)
 *
 * Follows Open/Closed: extend to create new NPC types without modifying this.
 */
import * as THREE from 'three'

const _frustum  = new THREE.Frustum()
const _projView = new THREE.Matrix4()
const _forward  = new THREE.Vector3()
const _rayOrigin = new THREE.Vector3()
const _sideDir   = new THREE.Vector3()

export default class NPC {
  /**
   * @param {THREE.Scene}    scene
   * @param {TrafficNetwork} network
   * @param {object}         settings — from NPC_SETTINGS
   */
  constructor(scene, network, settings = {}) {
    if (new.target === NPC) {
      throw new Error('NPC is abstract and cannot be instantiated directly.')
    }

    this._scene    = scene
    this._network  = network
    this._settings = settings

    this.speed          = settings.speed ?? this.getBaseSpeed()
    this._libertyRadius = settings.libertyRadius ?? 0
    this._colRayLength  = settings.collisionRayLength ?? 5
    this._sideRayAngle  = THREE.MathUtils.degToRad(settings.sideRayAngle ?? 15)
    this._sideRayLength = settings.sideRayLength ?? 2

    // Navigation state
    this.currentNode = null
    this.targetNode  = null
    this.previousNode = null
    this._progress    = 0        // 0→1 along current edge
    this._libertyOffset = new THREE.Vector3()  // perpendicular offset
    this._stopped     = false
    this._stopTimer   = 0

    // Raycaster (reused)
    this._raycaster = new THREE.Raycaster()

    /** @type {boolean} controlled by NPCController */
    this.isActive = false

    // Build mesh via subclass
    this.mesh = this._createMesh()
    this._scene.add(this.mesh)
  }

  /* ── abstract interface ─────────────────────────────────── */

  /** @abstract @returns {THREE.Object3D} */
  _createMesh() {
    throw new Error('Subclass must implement _createMesh()')
  }

  /** @abstract @returns {number} half-width of the NPC body */
  getWidth() {
    throw new Error('Subclass must implement getWidth()')
  }

  /** @abstract @returns {number} height at which to cast rays */
  getHeight() {
    throw new Error('Subclass must implement getHeight()')
  }

  /** @abstract @returns {number} base speed in units/second */
  getBaseSpeed() {
    throw new Error('Subclass must implement getBaseSpeed()')
  }

  /* ── initialisation ─────────────────────────────────────── */

  /**
   * Place NPC at a starting node and pick a target.
   * @param {TrafficNode} startNode
   */
  spawn(startNode) {
    this.currentNode  = startNode
    this.previousNode = null
    this.targetNode   = startNode.getNextNode(null)
    this._progress    = 0
    this.isActive     = true

    this.mesh.position.copy(startNode.position)
    this.mesh.position.y = 0
    this.mesh.visible = true

    this._generateLibertyOffset()
  }

  /* ── per-frame update ───────────────────────────────────── */

  /**
   * @param {number}            delta  — ms since last frame
   * @param {THREE.Camera}      camera — active rendering camera
   * @param {THREE.Object3D[]}  obstacles — meshes to raycast against
   */
  update(delta, camera, obstacles) {
    if (!this.isActive || !this.currentNode || !this.targetNode) return

    const dt = delta / 1000 // seconds

    // ── collision detection ──
    this._stopped = this._checkCollisions(obstacles)
    if (this._stopped) {
      this._stopTimer += dt
      // After being stuck for 3s, try to unstick by picking a new target
      if (this._stopTimer > 3) {
        this._pickNextTarget()
        this._stopTimer = 0
      }
      return
    }
    this._stopTimer = 0

    // ── movement ──
    const edgeLength = this.currentNode.distanceTo(this.targetNode)
    if (edgeLength < 0.01) {
      this._arriveAtTarget()
      return
    }

    const step = (this.speed * dt) / edgeLength
    this._progress = Math.min(this._progress + step, 1)

    // Interpolate base position
    const basePos = new THREE.Vector3().lerpVectors(
      this.currentNode.position,
      this.targetNode.position,
      this._progress,
    )

    // Apply liberty offset only if in frustum
    const inFrustum = this._isInFrustum(camera)
    if (inFrustum && this._libertyRadius > 0) {
      basePos.add(this._libertyOffset)
    }

    basePos.y = 0
    this.mesh.position.copy(basePos)

    // Face direction of movement
    _forward.subVectors(this.targetNode.position, this.currentNode.position).normalize()
    if (_forward.lengthSq() > 0.001) {
      const angle = Math.atan2(_forward.x, _forward.z)
      this.mesh.rotation.y = angle
    }

    // ── arrival ──
    if (this._progress >= 1) {
      this._arriveAtTarget()
    }
  }

  /* ── navigation helpers ─────────────────────────────────── */

  _arriveAtTarget() {
    this.previousNode = this.currentNode
    this.currentNode  = this.targetNode
    this._pickNextTarget()
    this._progress = 0
    this._generateLibertyOffset()
  }

  _pickNextTarget() {
    this.targetNode = this.currentNode.getNextNode(this.previousNode)
    if (!this.targetNode) {
      // Dead end: reverse
      this.targetNode = this.previousNode ?? this.currentNode
    }
  }

  _generateLibertyOffset() {
    if (this._libertyRadius <= 0) {
      this._libertyOffset.set(0, 0, 0)
      return
    }

    // Perpendicular direction to the edge
    if (!this.targetNode) {
      this._libertyOffset.set(0, 0, 0)
      return
    }

    _forward.subVectors(this.targetNode.position, this.currentNode.position).normalize()
    // Perpendicular in XZ plane
    const perpX = -_forward.z
    const perpZ =  _forward.x

    const offset = (Math.random() * 2 - 1) * this._libertyRadius
    this._libertyOffset.set(perpX * offset, 0, perpZ * offset)
  }

  /* ── collision rays ─────────────────────────────────────── */

  /**
   * Cast forward + side rays. Returns true if should stop.
   * @param {THREE.Object3D[]} obstacles
   * @returns {boolean}
   */
  _checkCollisions(obstacles) {
    if (!obstacles || obstacles.length === 0) return false

    _forward.subVectors(this.targetNode.position, this.currentNode.position).normalize()
    if (_forward.lengthSq() < 0.001) return false

    const rayY = this.getHeight() * 0.5
    _rayOrigin.copy(this.mesh.position)
    _rayOrigin.y = rayY

    // Forward ray
    this._raycaster.set(_rayOrigin, _forward)
    this._raycaster.far = this._colRayLength
    const fwdHits = this._raycaster.intersectObjects(obstacles, true)
    if (fwdHits.length > 0 && fwdHits[0].distance < this._colRayLength * 0.4) {
      return true
    }

    // Side rays (angled ± sideRayAngle from forward)
    const hw = this.getWidth()

    // Left ray
    _sideDir.copy(_forward)
    _sideDir.applyAxisAngle(THREE.Object3D.DEFAULT_UP, this._sideRayAngle)
    this._raycaster.set(_rayOrigin, _sideDir)
    this._raycaster.far = this._sideRayLength
    const leftHits = this._raycaster.intersectObjects(obstacles, true)
    if (leftHits.length > 0 && leftHits[0].distance < hw + 0.2) {
      return true
    }

    // Right ray
    _sideDir.copy(_forward)
    _sideDir.applyAxisAngle(THREE.Object3D.DEFAULT_UP, -this._sideRayAngle)
    this._raycaster.set(_rayOrigin, _sideDir)
    this._raycaster.far = this._sideRayLength
    const rightHits = this._raycaster.intersectObjects(obstacles, true)
    if (rightHits.length > 0 && rightHits[0].distance < hw + 0.2) {
      return true
    }

    return false
  }

  /* ── frustum check ──────────────────────────────────────── */

  /**
   * @param {THREE.Camera} camera
   * @returns {boolean}
   */
  _isInFrustum(camera) {
    _projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    _frustum.setFromProjectionMatrix(_projView)
    return _frustum.containsPoint(this.mesh.position)
  }

  /* ── deactivation & cleanup ─────────────────────────────── */

  deactivate() {
    this.isActive = false
    this.mesh.visible = false
  }

  activate(startNode) {
    this.spawn(startNode)
  }

  dispose() {
    this._scene.remove(this.mesh)
    if (this.mesh.geometry) this.mesh.geometry.dispose()
    if (this.mesh.material) {
      if (Array.isArray(this.mesh.material)) {
        this.mesh.material.forEach(m => m.dispose())
      } else {
        this.mesh.material.dispose()
      }
    }
  }
}
