<template>
  <div class="app-root">
    <div ref="canvasContainer" class="canvas-container"></div>

    <!-- Settings Panel Toggle -->
    <button class="panel-toggle" @click="panelOpen = !panelOpen" :class="{ active: panelOpen }">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>

    <!-- Settings Panel -->
    <Transition name="slide">
      <div v-if="panelOpen" class="settings-panel">
        <div class="panel-header">
          <h2>Scene Settings</h2>
          <span class="badge">FBX Loader</span>
        </div>

        <!-- Model Selector -->
        <div class="setting-group">
          <label class="setting-label">Model</label>
          <div class="model-list">
            <button
              v-for="model in availableModels"
              :key="model.name"
              class="model-card"
              :class="{ selected: currentModel === model.path }"
              @click="loadModel(model.path)"
            >
              <div class="model-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
              <div class="model-info">
                <span class="model-name">{{ model.name }}</span>
                <span class="model-type">{{ model.type }}</span>
              </div>
            </button>
          </div>
        </div>

        <div class="divider"></div>

        <!-- Camera Controls -->
        <div class="setting-group">
          <label class="setting-label">Camera</label>
          <div class="slider-row">
            <span class="slider-label">Orbit Speed</span>
            <input type="range" v-model.number="orbitSpeed" min="0" max="2" step="0.05" class="slider" />
            <span class="slider-value">{{ orbitSpeed.toFixed(2) }}</span>
          </div>
          <div class="slider-row">
            <span class="slider-label">Distance</span>
            <input type="range" v-model.number="cameraDistance" min="1" max="20" step="0.5" class="slider" />
            <span class="slider-value">{{ cameraDistance.toFixed(1) }}</span>
          </div>
          <div class="slider-row">
            <span class="slider-label">Height</span>
            <input type="range" v-model.number="cameraHeight" min="0.5" max="15" step="0.5" class="slider" />
            <span class="slider-value">{{ cameraHeight.toFixed(1) }}</span>
          </div>
        </div>

        <div class="divider"></div>

        <!-- Scene Controls -->
        <div class="setting-group">
          <label class="setting-label">Scene</label>
          <div class="toggle-row">
            <span>Grid</span>
            <button class="toggle-btn" :class="{ on: showGrid }" @click="showGrid = !showGrid">
              <span class="toggle-knob"></span>
            </button>
          </div>
          <div class="toggle-row">
            <span>Wireframe</span>
            <button class="toggle-btn" :class="{ on: wireframe }" @click="wireframe = !wireframe">
              <span class="toggle-knob"></span>
            </button>
          </div>
          <div class="toggle-row">
            <span>Auto-Rotate</span>
            <button class="toggle-btn" :class="{ on: autoRotate }" @click="autoRotate = !autoRotate">
              <span class="toggle-knob"></span>
            </button>
          </div>
        </div>

        <div class="divider"></div>

        <!-- Lighting -->
        <div class="setting-group">
          <label class="setting-label">Lighting</label>
          <div class="slider-row">
            <span class="slider-label">Intensity</span>
            <input type="range" v-model.number="lightIntensity" min="0" max="5" step="0.1" class="slider" />
            <span class="slider-value">{{ lightIntensity.toFixed(1) }}</span>
          </div>
          <div class="color-row">
            <span class="slider-label">Ambient</span>
            <input type="color" v-model="ambientColor" class="color-input" />
          </div>
        </div>

        <!-- Loading Indicator -->
        <Transition name="fade">
          <div v-if="loading" class="loading-bar">
            <div class="loading-progress"></div>
            <span>Loading model…</span>
          </div>
        </Transition>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

const canvasContainer = ref(null)

// Settings state
const panelOpen = ref(true)
const orbitSpeed = ref(0.5)
const cameraDistance = ref(5)
const cameraHeight = ref(3)
const showGrid = ref(true)
const wireframe = ref(false)
const autoRotate = ref(true)
const lightIntensity = ref(10)
const ambientColor = ref('#ffffff')
const loading = ref(false)
const currentModel = ref('')
const currentModelName = ref('')

const availableModels = ref([
  { name: 'Annecy', path: '/models/annecy.fbx', type: 'FBX' },
  { name: 'Annecy (GLTF)', path: '/models/annecy.gltf', type: 'GLTF' },
  { name: 'Model', path: '/models/model.gltf', type: 'GLTF' },
])

// Three.js references (not reactive to avoid proxy overhead)
let scene, camera, renderer, clock
let gridHelper, currentLoadedModel
let animationId
let mouseX = 0, mouseY = 0
let angle = 0

const loadModel = async (path) => {
  if (!scene) return

  loading.value = true
  currentModel.value = path
  const modelEntry = availableModels.value.find(m => m.path === path)
  currentModelName.value = modelEntry ? modelEntry.name : ''

  // Remove existing model
  if (currentLoadedModel) {
    scene.remove(currentLoadedModel)
    currentLoadedModel = null
  }

  try {
    const THREE = await import('three')
    let loader
    let loaded

    if (path.endsWith('.fbx')) {
      const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js')
      loader = new FBXLoader()
      loaded = await new Promise((resolve, reject) => {
        loader.load(path, resolve, undefined, reject)
      })
    } else if (path.endsWith('.gltf') || path.endsWith('.glb')) {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
      loader = new GLTFLoader()
      const gltf = await new Promise((resolve, reject) => {
        loader.load(path, resolve, undefined, reject)
      })
      loaded = gltf.scene
    }

    if (loaded) {
      // Normalize scale and center
      const box = new THREE.Box3().setFromObject(loaded)
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())

      const maxDim = Math.max(size.x, size.y, size.z)
      const scale = 3 / maxDim
      loaded.scale.setScalar(scale)

      loaded.position.sub(center.multiplyScalar(scale))
      loaded.position.y -= (box.min.y * scale)

      currentLoadedModel = loaded
      scene.add(loaded)
    }
  } catch (e) {
    console.error('Failed to load model:', e)
  }

  loading.value = false
}

const initScene = async () => {
  const THREE = await import('three')

  // Scene
  scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x0a0a0f, 0.04)

  // Camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.set(cameraDistance.value, cameraHeight.value, cameraDistance.value)

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.outputColorSpace = THREE.SRGBColorSpace
  canvasContainer.value.appendChild(renderer.domElement)

  // Grid
  gridHelper = new THREE.GridHelper(20, 40, 0x222244, 0x111128)
  gridHelper.material.opacity = 0.4
  gridHelper.material.transparent = true
  scene.add(gridHelper)

  // Ground
  const groundGeom = new THREE.PlaneGeometry(40, 40)
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a12,
    roughness: 0.8,
    metalness: 0.2,
  })
  const ground = new THREE.Mesh(groundGeom, groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.01
  ground.receiveShadow = true
  scene.add(ground)

  // Lights
  const ambientLight = new THREE.AmbientLight(ambientColor.value, 0.4)
  ambientLight.name = 'ambient'
  scene.add(ambientLight)

  const dirLight = new THREE.DirectionalLight(0xffffff, lightIntensity.value)
  dirLight.name = 'directional'
  dirLight.position.set(5, 10, 7)
  dirLight.castShadow = true
  dirLight.shadow.mapSize.width = 2048
  dirLight.shadow.mapSize.height = 2048
  scene.add(dirLight)

  const fillLight = new THREE.DirectionalLight(0x4466ff, 0.5)
  fillLight.position.set(-5, 3, -5)
  scene.add(fillLight)

  const rimLight = new THREE.PointLight(0x00f2ff, 1, 30)
  rimLight.position.set(-3, 5, 3)
  scene.add(rimLight)

  const accentLight = new THREE.PointLight(0x7000ff, 0.8, 25)
  accentLight.position.set(5, 2, -5)
  scene.add(accentLight)

  // Clock for time-based animations
  clock = new THREE.Clock()

  // Mouse tracking for parallax
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('resize', onResize)

  animate()

  // Load first model by default
  if (availableModels.value.length > 0) {
    loadModel(availableModels.value[0].path)
  }
}

const onMouseMove = (e) => {
  mouseX = (e.clientX / window.innerWidth) * 2 - 1
  mouseY = (e.clientY / window.innerHeight) * 2 - 1
}

const onResize = () => {
  if (!camera || !renderer) return
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

const animate = () => {
  animationId = requestAnimationFrame(animate)
  if (!scene || !camera || !renderer) return

  const delta = clock.getDelta()

  if (autoRotate.value) {
    angle += orbitSpeed.value * delta
  }

  // Camera orbit with mouse parallax
  const targetX = Math.cos(angle) * cameraDistance.value + mouseX * 0.5
  const targetZ = Math.sin(angle) * cameraDistance.value + mouseY * 0.5
  const targetY = cameraHeight.value + Math.sin(angle * 0.3) * 0.3

  camera.position.x += (targetX - camera.position.x) * 0.05
  camera.position.z += (targetZ - camera.position.z) * 0.05
  camera.position.y += (targetY - camera.position.y) * 0.05
  camera.lookAt(0, 1, 0)

  renderer.render(scene, camera)
}

// Watchers for settings
watch(showGrid, (v) => {
  if (gridHelper) gridHelper.visible = v
})

watch(wireframe, (v) => {
  if (!currentLoadedModel) return
  currentLoadedModel.traverse((child) => {
    if (child.isMesh && child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.wireframe = v)
      } else {
        child.material.wireframe = v
      }
    }
  })
})

watch(lightIntensity, (v) => {
  if (!scene) return
  const dl = scene.getObjectByName('directional')
  if (dl) dl.intensity = v
})

watch(ambientColor, (v) => {
  if (!scene) return
  const al = scene.getObjectByName('ambient')
  if (al) {
    import('three').then((THREE) => {
      al.color = new THREE.Color(v)
    })
  }
})

onMounted(() => {
  initScene()
})

onBeforeUnmount(() => {
  if (animationId) cancelAnimationFrame(animationId)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('resize', onResize)
  if (renderer) {
    renderer.dispose()
  }
})
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Outfit:wght@600;700&display=swap');

:root {
  --bg: #08080c;
  --panel-bg: rgba(12, 12, 20, 0.85);
  --panel-border: rgba(255, 255, 255, 0.06);
  --accent: #00f2ff;
  --accent-purple: #7c3aed;
  --text: #e2e2e8;
  --text-dim: rgba(255, 255, 255, 0.4);
  --radius: 12px;
  --radius-sm: 8px;
}

*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bg);
  font-family: 'Inter', -apple-system, sans-serif;
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}

.app-root {
  width: 100vw;
  height: 100vh;
  position: relative;
}

.canvas-container {
  position: absolute;
  inset: 0;
}

.canvas-container canvas {
  display: block;
}

/* ── Panel Toggle ─────────────────────────── */
.panel-toggle {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 100;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--panel-border);
  background: var(--panel-bg);
  backdrop-filter: blur(20px);
  color: var(--text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.panel-toggle:hover,
.panel-toggle.active {
  color: var(--accent);
  border-color: rgba(0, 242, 255, 0.2);
  box-shadow: 0 0 20px rgba(0, 242, 255, 0.1);
}

/* ── Settings Panel ───────────────────────── */
.settings-panel {
  position: absolute;
  top: 76px;
  right: 20px;
  z-index: 90;
  width: 320px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  background: var(--panel-bg);
  backdrop-filter: blur(30px);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius);
  padding: 20px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.1) transparent;
}

.settings-panel::-webkit-scrollbar {
  width: 4px;
}
.settings-panel::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.1);
  border-radius: 4px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.panel-header h2 {
  font-family: 'Outfit', sans-serif;
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: -0.3px;
}

.badge {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  padding: 4px 10px;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(0, 242, 255, 0.15), rgba(124, 58, 237, 0.15));
  border: 1px solid rgba(0, 242, 255, 0.2);
  color: var(--accent);
}

/* ── Setting Groups ───────────────────────── */
.setting-group {
  margin-bottom: 4px;
}

.setting-label {
  display: block;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-dim);
  margin-bottom: 12px;
}

.divider {
  height: 1px;
  background: var(--panel-border);
  margin: 16px 0;
}

/* ── Model Cards ──────────────────────────── */
.model-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.model-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--panel-border);
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  transition: all 0.25s ease;
  color: var(--text);
  text-align: left;
  width: 100%;
}

.model-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
}

.model-card.selected {
  background: linear-gradient(135deg, rgba(0, 242, 255, 0.08), rgba(124, 58, 237, 0.08));
  border-color: rgba(0, 242, 255, 0.3);
  box-shadow: 0 0 20px rgba(0, 242, 255, 0.05);
}

.model-card.selected .model-icon {
  color: var(--accent);
}

.model-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
  flex-shrink: 0;
  transition: color 0.25s ease;
}

.model-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.model-name {
  font-size: 0.85rem;
  font-weight: 500;
}

.model-type {
  font-size: 0.7rem;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* ── Sliders ──────────────────────────────── */
.slider-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.slider-label {
  font-size: 0.78rem;
  color: var(--text-dim);
  min-width: 80px;
}

.slider {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  outline: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  box-shadow: 0 0 10px rgba(0, 242, 255, 0.3);
  transition: box-shadow 0.2s ease;
}

.slider::-webkit-slider-thumb:hover {
  box-shadow: 0 0 16px rgba(0, 242, 255, 0.5);
}

.slider-value {
  font-size: 0.75rem;
  color: var(--text-dim);
  min-width: 32px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* ── Toggles ──────────────────────────────── */
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 0.8rem;
  color: var(--text-dim);
}

.toggle-btn {
  width: 40px;
  height: 22px;
  border-radius: 11px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  position: relative;
  transition: all 0.3s ease;
  padding: 0;
}

.toggle-btn.on {
  background: linear-gradient(135deg, var(--accent), var(--accent-purple));
  border-color: transparent;
}

.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.toggle-btn.on .toggle-knob {
  transform: translateX(18px);
}

/* ── Color Input ──────────────────────────── */
.color-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.color-input {
  -webkit-appearance: none;
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  width: 32px;
  height: 24px;
  padding: 0;
  cursor: pointer;
  background: transparent;
}

.color-input::-webkit-color-swatch-wrapper {
  padding: 2px;
}

.color-input::-webkit-color-swatch {
  border-radius: 4px;
  border: none;
}

/* ── Loading Bar ──────────────────────────── */
.loading-bar {
  margin-top: 16px;
  padding: 12px;
  border-radius: var(--radius-sm);
  background: rgba(0, 242, 255, 0.05);
  border: 1px solid rgba(0, 242, 255, 0.15);
  font-size: 0.75rem;
  color: var(--accent);
  overflow: hidden;
  position: relative;
}

.loading-progress {
  position: absolute;
  top: 0;
  left: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--accent), var(--accent-purple));
  animation: loading-sweep 1.5s ease-in-out infinite;
}

@keyframes loading-sweep {
  0% { width: 0; left: 0; }
  50% { width: 60%; left: 20%; }
  100% { width: 0; left: 100%; }
}

/* ── Info Overlay ─────────────────────────── */
.info-overlay {
  position: absolute;
  bottom: 40px;
  left: 40px;
  z-index: 10;
  pointer-events: none;
}

.info-badge {
  display: inline-block;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 2px;
  padding: 4px 12px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  margin-bottom: 12px;
  color: var(--text-dim);
}

.info-title {
  font-family: 'Outfit', sans-serif;
  font-size: 2.8rem;
  font-weight: 700;
  letter-spacing: -1.5px;
  line-height: 1;
  background: linear-gradient(135deg, var(--accent), var(--accent-purple));
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.info-sub {
  font-size: 0.9rem;
  color: var(--text-dim);
  margin-top: 8px;
}

/* ── Transitions ──────────────────────────── */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
