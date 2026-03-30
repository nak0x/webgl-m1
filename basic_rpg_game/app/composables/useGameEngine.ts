import { ref, onUnmounted } from 'vue'

export interface InputState {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  mouseX: number
  mouseY: number
  mouseDeltaX: number
  mouseDeltaY: number
  toggleView: boolean
  togglePlanet: boolean
  isPointerLocked: boolean
}

export function useGameEngine() {
  const keys = ref<Record<string, boolean>>({})
  const mouse = ref({ x: 0, y: 0, dx: 0, dy: 0 })
  const toggleViewPressed = ref(false)
  const togglePlanetPressed = ref(false)
  const isPointerLocked = ref(false)
  let lastTime = 0
  let animationId = 0

  const onKeyDown = (e: KeyboardEvent) => {
    keys.value[e.key.toLowerCase()] = true
    if (e.key === '1') toggleViewPressed.value = true
    if (e.key === '2') togglePlanetPressed.value = true
  }

  const onKeyUp = (e: KeyboardEvent) => {
    keys.value[e.key.toLowerCase()] = false
  }

  const onMouseMove = (e: MouseEvent) => {
    mouse.value.dx = e.movementX || 0
    mouse.value.dy = e.movementY || 0
    mouse.value.x = e.clientX
    mouse.value.y = e.clientY
  }

  const onPointerLockChange = () => {
    isPointerLocked.value = !!document.pointerLockElement
  }

  const getInput = (): InputState => {
    const input: InputState = {
      forward: !!keys.value['w'],
      backward: !!keys.value['s'],
      left: !!keys.value['a'],
      right: !!keys.value['d'],
      mouseX: mouse.value.x,
      mouseY: mouse.value.y,
      mouseDeltaX: mouse.value.dx,
      mouseDeltaY: mouse.value.dy,
      toggleView: toggleViewPressed.value,
      togglePlanet: togglePlanetPressed.value,
      isPointerLocked: isPointerLocked.value,
    }
    // Reset deltas after reading
    mouse.value.dx = 0
    mouse.value.dy = 0
    toggleViewPressed.value = false
    togglePlanetPressed.value = false
    return input
  }

  const start = (updateFn: (dt: number, input: InputState) => void) => {
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('pointerlockchange', onPointerLockChange)

    lastTime = performance.now()

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05) // Cap at 50ms
      lastTime = now
      const input = getInput()
      updateFn(dt, input)
      animationId = requestAnimationFrame(loop)
    }

    animationId = requestAnimationFrame(loop)
  }

  const stop = () => {
    cancelAnimationFrame(animationId)
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('keyup', onKeyUp)
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('pointerlockchange', onPointerLockChange)
  }

  onUnmounted(stop)

  return { start, stop, isPointerLocked }
}
