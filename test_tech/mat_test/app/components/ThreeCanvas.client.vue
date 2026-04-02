<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick } from 'vue'
import * as THREE from 'three'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let sphere: THREE.Mesh
let animationFrameId: number

onMounted(async () => {
  console.log('ThreeCanvas checking canvasRef...', canvasRef.value)
  await nextTick()
  if (!canvasRef.value) {
    console.error('Canvas element not found')
    return
  }
  console.log('Canvas found, initializing THREE...')

  // Scene setup
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.z = 4 // Changed zoom slightly

  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true
  })
  renderer.setClearColor(0x000000, 0) // Transparent background
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  // Sphere with premium material
  const geometry = new THREE.SphereGeometry(1.5, 64, 64)
  const material = new THREE.MeshSSSNodeMaterial({
    color: 0x6366f1, // Indigo
  })
  sphere = new THREE.Mesh(geometry, material)
  scene.add(sphere)

  // Lighting
  const light = new THREE.DirectionalLight(0xffffff, 3)
  light.position.set(5, 5, 5)
  scene.add(light)

  const pointLight1 = new THREE.PointLight(0xff00ff, 50)
  pointLight1.position.set(-5, -5, 2)
  scene.add(pointLight1)

  const pointLight2 = new THREE.PointLight(0x00ffff, 50)
  pointLight2.position.set(2, 2, -2)
  scene.add(pointLight2)

  const ambLight = new THREE.AmbientLight(0x404040, 2)
  scene.add(ambLight)

  console.log('Scene setup complete, starting animation loop')

  // Responsive logic
  const handleResize = () => {
    if (!renderer || !camera) return
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }
  window.addEventListener('resize', handleResize)

  // Animation Loop
  const animate = () => {
    animationFrameId = requestAnimationFrame(animate)
    
    if (sphere) {
      sphere.rotation.y += 0.005
      sphere.rotation.x += 0.003
      
      // Bubble floating effect
      sphere.position.y = Math.sin(Date.now() * 0.001) * 0.2
    }

    if (renderer && scene && camera) {
      renderer.render(scene, camera)
    }
  }
  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
    cancelAnimationFrame(animationFrameId)
    if (renderer) renderer.dispose()
    if (sphere) {
      sphere.geometry.dispose()
      if (Array.isArray(sphere.material)) {
        sphere.material.forEach((m: any) => m.dispose())
      } else {
        sphere.material.dispose()
      }
    }
  })

  animate()
})
</script>

<template>
  <div class="scene-container">
    <canvas ref="canvasRef" />
  </div>
</template>

<style scoped>
.scene-container {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background: radial-gradient(circle at center, #1e1b4b 0%, #020617 100%);
}

canvas {
  display: block;
}

</style>
