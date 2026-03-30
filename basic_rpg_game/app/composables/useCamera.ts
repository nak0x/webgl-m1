import * as THREE from 'three'
import type { InputState } from './useGameEngine'

export type CameraMode = 'third' | 'first'

export interface CameraController {
  camera: THREE.PerspectiveCamera
  mode: CameraMode
  update: (dt: number, input: InputState, playerPos: THREE.Vector3, canvas: HTMLCanvasElement) => THREE.Vector3
  getMode: () => CameraMode
}

export function useCamera(): CameraController {
  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 250)

  let mode: CameraMode = 'third'

  // ── Third Person Orbit Settings ────────────────────────
  let orbitYaw = Math.PI       // start facing forward (behind player)
  let orbitPitch = 0.35        // elevation angle in radians (~20°)
  const TP_DISTANCE = 4.5      // distance from player
  const TP_HEIGHT_OFFSET = 1.2 // look target at player's torso
  const TP_ORBIT_SENSITIVITY = 0.003
  const TP_PITCH_MIN = 0.05
  const TP_PITCH_MAX = 1.2

  // ── First Person Settings ─────────────────────────────
  let fpYaw = 0
  let fpPitch = 0
  const FP_EYE_HEIGHT = 1.5
  const FP_MOUSE_SENSITIVITY = 0.002

  // ── Smooth camera interpolation ───────────────────────
  const currentCamPos = new THREE.Vector3()
  const currentLookAt = new THREE.Vector3()
  let camInitialized = false

  const update = (dt: number, input: InputState, playerPos: THREE.Vector3, canvas: HTMLCanvasElement): THREE.Vector3 => {
    // Toggle mode
    if (input.toggleView) {
      mode = mode === 'third' ? 'first' : 'third'
      if (mode === 'first') {
        // Sync FP yaw from orbit so direction doesn't jump
        fpYaw = orbitYaw - Math.PI
        fpPitch = 0
      } else {
        // Sync orbit yaw from FP
        orbitYaw = fpYaw + Math.PI
      }
      // Keep pointer lock active in both modes — don't exit it
    }

    const moveDir = new THREE.Vector3()

    if (mode === 'third') {
      // ── Orbit camera with mouse (always apply when we have deltas) ──
      orbitYaw -= input.mouseDeltaX * TP_ORBIT_SENSITIVITY
      orbitPitch += input.mouseDeltaY * TP_ORBIT_SENSITIVITY
      orbitPitch = Math.max(TP_PITCH_MIN, Math.min(TP_PITCH_MAX, orbitPitch))

      // Calculate camera position on orbit sphere around player
      const camX = playerPos.x + TP_DISTANCE * Math.sin(orbitYaw) * Math.cos(orbitPitch)
      const camY = playerPos.y + TP_HEIGHT_OFFSET + TP_DISTANCE * Math.sin(orbitPitch)
      const camZ = playerPos.z + TP_DISTANCE * Math.cos(orbitYaw) * Math.cos(orbitPitch)

      const targetPos = new THREE.Vector3(camX, camY, camZ)
      const targetLook = new THREE.Vector3(playerPos.x, playerPos.y + TP_HEIGHT_OFFSET, playerPos.z)

      if (!camInitialized) {
        currentCamPos.copy(targetPos)
        currentLookAt.copy(targetLook)
        camInitialized = true
      }

      // Smooth follow with configurable smoothing
      const smoothing = 1.0 - Math.pow(0.0001, dt)
      currentCamPos.lerp(targetPos, smoothing)
      currentLookAt.lerp(targetLook, smoothing)

      camera.position.copy(currentCamPos)
      camera.lookAt(currentLookAt)

      // ── WASD relative to camera-facing direction ─────
      const forward = new THREE.Vector3(
        -Math.sin(orbitYaw),
        0,
        -Math.cos(orbitYaw)
      ).normalize()
      const right = new THREE.Vector3(-forward.z, 0, forward.x)

      if (input.forward) moveDir.add(forward)
      if (input.backward) moveDir.sub(forward)
      if (input.right) moveDir.add(right)
      if (input.left) moveDir.sub(right)

    } else {
      // ── First Person ─────────────────────────────────
      fpYaw -= input.mouseDeltaX * FP_MOUSE_SENSITIVITY
      fpPitch -= input.mouseDeltaY * FP_MOUSE_SENSITIVITY
      fpPitch = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, fpPitch))

      camera.position.set(playerPos.x, playerPos.y + FP_EYE_HEIGHT, playerPos.z)

      const lookDir = new THREE.Vector3(
        Math.sin(fpYaw) * Math.cos(fpPitch),
        Math.sin(fpPitch),
        Math.cos(fpYaw) * Math.cos(fpPitch)
      )

      camera.lookAt(camera.position.clone().add(lookDir))

      // WASD relative to look direction
      const forward = new THREE.Vector3(Math.sin(fpYaw), 0, Math.cos(fpYaw))
      const right = new THREE.Vector3(-Math.cos(fpYaw), 0, Math.sin(fpYaw))

      if (input.forward) moveDir.add(forward)
      if (input.backward) moveDir.sub(forward)
      if (input.right) moveDir.add(right)
      if (input.left) moveDir.sub(right)
    }

    return moveDir
  }

  const getMode = (): CameraMode => mode

  return { camera, mode, update, getMode }
}
