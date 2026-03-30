import * as THREE from 'three'

export interface PlayerState {
  mesh: THREE.Group
  position: THREE.Vector3
  rotation: number // Y-axis rotation in radians
  update: (dt: number, moveDir: THREE.Vector3) => void
  setVisible: (visible: boolean) => void
}

export function usePlayer(scene: THREE.Scene): PlayerState {
  const group = new THREE.Group()

  // Capsule body
  const bodyGeo = new THREE.CapsuleGeometry(0.3, 0.8, 8, 16)
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xf5f2ed,
    roughness: 0.4,
    metalness: 0.1,
  })
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  body.position.y = 0.7
  body.castShadow = true
  group.add(body)

  // Small head indicator for direction
  const headGeo = new THREE.SphereGeometry(0.15, 12, 8)
  const headMat = new THREE.MeshStandardMaterial({
    color: 0x88b87a,
    roughness: 0.3,
    metalness: 0.1,
  })
  const head = new THREE.Mesh(headGeo, headMat)
  head.position.y = 1.35
  head.castShadow = true
  group.add(head)

  group.position.set(0, 0, 0)
  scene.add(group)

  // ── Velocity-based movement for smooth starts/stops ──
  const MAX_SPEED = 6.0
  const ACCELERATION = 28.0  // how fast we reach max speed
  const FRICTION = 10.0       // how fast we decelerate when no input
  const velocity = new THREE.Vector3()
  let currentYaw = 0

  const update = (dt: number, moveDir: THREE.Vector3) => {
    if (moveDir.lengthSq() > 0) {
      moveDir.normalize()

      // Accelerate toward desired direction
      const targetVel = moveDir.clone().multiplyScalar(MAX_SPEED)
      const accelStep = ACCELERATION * dt

      velocity.x += (targetVel.x - velocity.x) * Math.min(accelStep, 1)
      velocity.z += (targetVel.z - velocity.z) * Math.min(accelStep, 1)

      // Smoothly rotate toward movement direction
      const targetYaw = Math.atan2(moveDir.x, moveDir.z)
      let yawDiff = targetYaw - currentYaw
      // Wrap to -PI..PI
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2
      currentYaw += yawDiff * Math.min(12 * dt, 1)
      group.rotation.y = currentYaw
    } else {
      // Apply friction to decelerate smoothly
      const frictionStep = FRICTION * dt
      velocity.x *= Math.max(0, 1 - frictionStep)
      velocity.z *= Math.max(0, 1 - frictionStep)

      // Stop completely if very slow (avoid drift)
      if (velocity.lengthSq() < 0.001) {
        velocity.set(0, 0, 0)
      }
    }

    // Apply velocity
    group.position.addScaledVector(velocity, dt)

    // Keep on ground
    group.position.y = 0
  }

  const setVisible = (visible: boolean) => {
    group.visible = visible
  }

  return {
    mesh: group,
    position: group.position,
    rotation: group.rotation.y,
    update,
    setVisible,
  }
}
