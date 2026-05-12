import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from '/lib/three.js'
import EventEmitter from './EventEmitter.js'

const CHAR_HALF_HEIGHT = 0.3
const CHAR_RADIUS      = 0.35

export default class PhysicsWorld extends EventEmitter {
  constructor() {
    super()
    this._world     = null
    this._debugMesh = null
    RAPIER.init().then(() => {
      this._world = new RAPIER.World({ x: 0, y: -20, z: 0 })
      this.trigger('ready')
    })
  }

  addMeshCollider(mesh) {
    mesh.updateWorldMatrix(true, false)
    const geo = mesh.geometry.clone()
    geo.applyMatrix4(mesh.matrixWorld)

    const vertices = new Float32Array(geo.attributes.position.array)
    const indices  = geo.index
      ? new Uint32Array(geo.index.array)
      : _makeIndices(geo.attributes.position.count)

    this._world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices))
    geo.dispose()
  }

  createCharacter(startPos) {
    const body = this._world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(startPos.x, startPos.y, startPos.z)
    )
    const collider = this._world.createCollider(
      RAPIER.ColliderDesc.capsule(CHAR_HALF_HEIGHT, CHAR_RADIUS),
      body
    )

    const controller = this._world.createCharacterController(0.01)
    controller.setUp({ x: 0, y: 1, z: 0 })
    controller.setMaxSlopeClimbAngle(45 * Math.PI / 180)
    controller.setMinSlopeSlideAngle(60 * Math.PI / 180)
    controller.enableSnapToGround(0.3)
    controller.enableAutostep(0.15, 0.05, true)
    controller.setApplyImpulsesToDynamicBodies(false)

    return { body, collider, controller }
  }

  enableDebug(scene) {
    const geo = new THREE.BufferGeometry()
    const mat = new THREE.LineBasicMaterial({ vertexColors: true })
    this._debugMesh = new THREE.LineSegments(geo, mat)
    this._debugMesh.frustumCulled = false
    scene.add(this._debugMesh)
  }

  step(deltaMs) {
    if (!this._world) return
    this._world.timestep = Math.min(deltaMs / 1000, 0.05)
    this._world.step()
    this._updateDebug()
  }

  _updateDebug() {
    if (!this._debugMesh) return
    const { vertices, colors } = this._world.debugRender()
    this._debugMesh.geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
    this._debugMesh.geometry.setAttribute('color',    new THREE.BufferAttribute(colors,   4))
  }

  destroy() {
    if (this._debugMesh) {
      this._debugMesh.geometry.dispose()
      this._debugMesh.material.dispose()
      this._debugMesh.removeFromParent()
    }
    this._world?.free()
    this._world = null
  }
}

function _makeIndices(count) {
  const idx = new Uint32Array(count)
  for (let i = 0; i < count; i++) idx[i] = i
  return idx
}
