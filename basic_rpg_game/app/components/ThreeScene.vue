<template>
  <div ref="containerRef" class="scene-container">
    <canvas ref="canvasRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { useGameEngine } from '~/composables/useGameEngine'
import { usePlayer } from '~/composables/usePlayer'
import { useCamera } from '~/composables/useCamera'
import { useCityGenerator } from '~/composables/useCityGenerator'
import { useLensEffect } from '~/shaders/smallPlanet'

const props = defineProps<{
  started: boolean
}>()

const emit = defineEmits<{
  (e: 'modeChange', mode: string): void
  (e: 'lensToggle', enabled: boolean): void
}>()

const containerRef = ref<HTMLDivElement>()
const canvasRef = ref<HTMLCanvasElement>()

let renderer: THREE.WebGLRenderer
let scene: THREE.Scene
let city: ReturnType<typeof useCityGenerator>
let lens: ReturnType<typeof useLensEffect>

const { start, stop } = useGameEngine()

onMounted(() => {
  if (!canvasRef.value || !containerRef.value) return

  const canvas = canvasRef.value
  const container = containerRef.value

  // ── Scene ──────────────────────────────────────────────
  scene = new THREE.Scene()

  // ── Fog (atmospheric) ─────────────────────────────────
  const fogColor = new THREE.Color(0xf0ece4)
  scene.fog = new THREE.FogExp2(fogColor, 0.018)
  scene.background = fogColor

  // ── Renderer ──────────────────────────────────────────
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1

  // ── Lighting ──────────────────────────────────────────
  const ambient = new THREE.AmbientLight(0xf5f0e8, 0.6)
  scene.add(ambient)

  const hemi = new THREE.HemisphereLight(0xd4e8f7, 0xd4cfc7, 0.5)
  scene.add(hemi)

  const sun = new THREE.DirectionalLight(0xfff8e7, 1.2)
  sun.position.set(30, 50, 20)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.near = 0.5
  sun.shadow.camera.far = 120
  sun.shadow.camera.left = -40
  sun.shadow.camera.right = 40
  sun.shadow.camera.top = 40
  sun.shadow.camera.bottom = -40
  sun.shadow.bias = -0.001
  scene.add(sun)
  scene.add(sun.target)

  // ── Generate City ─────────────────────────────────────
  city = useCityGenerator(scene)

  // ── Player ────────────────────────────────────────────
  const player = usePlayer(scene)

  // ── Camera ────────────────────────────────────────────
  const cameraCtrl = useCamera()

  // ── Lens Effect ───────────────────────────────────────
  lens = useLensEffect(renderer, scene, cameraCtrl.camera)
  lens.resize(container.clientWidth, container.clientHeight)

  // ── Resize ────────────────────────────────────────────
  const onResize = () => {
    if (!container) return
    const w = container.clientWidth
    const h = container.clientHeight
    renderer.setSize(w, h)
    cameraCtrl.camera.aspect = w / h
    cameraCtrl.camera.updateProjectionMatrix()
    lens.resize(w, h)
  }
  window.addEventListener('resize', onResize)

  // ── Game Loop ─────────────────────────────────────────
  let currentMode = 'third'

  start((dt, input) => {
    // Handle lens toggle
    if (input.togglePlanet) {
      lens.toggle()
      emit('lensToggle', lens.enabled)
    }

    // Update camera & get movement direction
    const moveDir = cameraCtrl.update(dt, input, player.position, canvas)

    // Update player
    player.update(dt, moveDir)

    // Toggle player visibility on mode change
    const mode = cameraCtrl.getMode()
    if (mode !== currentMode) {
      currentMode = mode
      player.setVisible(mode !== 'first')
      emit('modeChange', mode)
    }

    // Update sun target to follow player for shadows
    sun.target.position.copy(player.position)
    sun.position.set(
      player.position.x + 30,
      50,
      player.position.z + 20
    )

    // Render
    lens.render()
  })

  // Cleanup
  onUnmounted(() => {
    stop()
    window.removeEventListener('resize', onResize)
    city.dispose()
    renderer.dispose()
  })
})
</script>

<style scoped>
.scene-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.scene-container canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
