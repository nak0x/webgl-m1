import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { VehiclePart } from './usePartsData'

export function useCarScene() {
  let renderer: THREE.WebGLRenderer | null = null
  let scene: THREE.Scene | null = null
  let camera: THREE.PerspectiveCamera | null = null
  let controls: OrbitControls | null = null
  let animationId: number | null = null

  // Car meshes
  let carGroup: THREE.Group | null = null
  let xrayMesh: THREE.Mesh | null = null
  let xrayOutline: THREE.Mesh | null = null
  let xrayExtras: THREE.Object3D[] = []
  let xrayScanData: { mesh: THREE.Mesh; minY: number; maxY: number } | null = null
  const originalMaterials = new Map<THREE.Mesh, { opacity: number; transparent: boolean }>()

  // Indicator 3D objects → projected to 2D
  const indicatorScreenPositions = ref<{ id: string; x: number; y: number; visible: boolean; status: string }[]>([])

  // Parts with indicators for projection
  let indicatorParts: VehiclePart[] = []

  function init(container: HTMLElement) {
    const { width, height } = container.getBoundingClientRect()

    // Renderer
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    container.appendChild(renderer.domElement)

    // Scene
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf0f5ed)
    scene.fog = new THREE.Fog(0xf0f5ed, 15, 35)

    // Camera
    camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100)
    camera.position.set(5, 3.5, 6)
    camera.lookAt(0, 0.5, 0)

    // Controls
    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.minDistance = 4
    controls.maxDistance = 14
    controls.maxPolarAngle = Math.PI / 2.1
    controls.target.set(0, 0.5, 0)
    controls.update()

    // Lights
    setupLights()

    // Ground
    setupGround()

    // Build the car
    carGroup = buildCar()
    scene.add(carGroup)

    // Handle resize
    const ro = new ResizeObserver(() => {
      if (!renderer || !camera || !container) return
      const { width: w, height: h } = container.getBoundingClientRect()
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    })
    ro.observe(container)

    // Start
    animate()
  }

  function setupLights() {
    if (!scene) return

    // Ambient
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)

    // Hemisphere
    const hemi = new THREE.HemisphereLight(0xe8f5e0, 0xd4e8cf, 0.5)
    scene.add(hemi)

    // Main directional
    const dir = new THREE.DirectionalLight(0xffffff, 1.2)
    dir.position.set(5, 8, 4)
    dir.castShadow = true
    dir.shadow.mapSize.set(2048, 2048)
    dir.shadow.camera.far = 30
    dir.shadow.camera.left = -8
    dir.shadow.camera.right = 8
    dir.shadow.camera.top = 8
    dir.shadow.camera.bottom = -8
    dir.shadow.bias = -0.001
    scene.add(dir)

    // Fill
    const fill = new THREE.DirectionalLight(0xd4f5e0, 0.4)
    fill.position.set(-3, 4, -2)
    scene.add(fill)
  }

  function setupGround() {
    if (!scene) return

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(40, 40)
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xe8efe4,
      roughness: 0.95,
      metalness: 0.0,
    })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    // Grid helper
    const grid = new THREE.GridHelper(20, 30, 0xc8dcc4, 0xd8e8d4)
    grid.position.y = 0.005
    const gridMat = grid.material as THREE.Material
    if (gridMat instanceof THREE.Material) {
      gridMat.transparent = true
      gridMat.opacity = 0.35
    }
    scene.add(grid)
  }

  function buildCar(): THREE.Group {
    const group = new THREE.Group()

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xfafafa,
      roughness: 0.2,
      metalness: 0.3,
    })

    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.3,
      metalness: 0.4,
      emissive: 0x10b981,
      emissiveIntensity: 0.1,
    })

    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x2d3a2d,
      roughness: 0.6,
      metalness: 0.2,
    })

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xc8e8d8,
      roughness: 0.05,
      metalness: 0.1,
      transparent: true,
      opacity: 0.35,
    })

    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x3a4a3a,
      roughness: 0.7,
      metalness: 0.3,
    })

    // === Main body (lower) ===
    const bodyLowerGeo = new THREE.BoxGeometry(2, 0.5, 4.2)
    bodyLowerGeo.translate(0, 0.5, 0)
    const bodyLower = new THREE.Mesh(bodyLowerGeo, bodyMat)
    bodyLower.castShadow = true
    // Round it a bit
    group.add(bodyLower)

    // Body upper (cabin)
    const cabinGeo = new THREE.BoxGeometry(1.7, 0.55, 2.0)
    cabinGeo.translate(0, 1.0, -0.15)
    const cabin = new THREE.Mesh(cabinGeo, bodyMat)
    cabin.castShadow = true
    group.add(cabin)

    // Windshield (front glass)
    const windshieldGeo = new THREE.BoxGeometry(1.6, 0.5, 0.05)
    windshieldGeo.translate(0, 1.0, 0.8)
    const windshield = new THREE.Mesh(windshieldGeo, glassMat)
    // Tilt windshield  
    windshield.rotation.x = -0.25
    windshield.position.y += 0.05
    windshield.position.z += 0.05
    group.add(windshield)

    // Rear glass
    const rearGlassGeo = new THREE.BoxGeometry(1.6, 0.45, 0.05)
    rearGlassGeo.translate(0, 1.0, -1.1)
    const rearGlass = new THREE.Mesh(rearGlassGeo, glassMat)
    rearGlass.rotation.x = 0.2
    group.add(rearGlass)

    // Side windows
    for (const side of [-1, 1]) {
      const sideGlassGeo = new THREE.BoxGeometry(0.05, 0.4, 1.6)
      sideGlassGeo.translate(side * 0.85, 1.0, -0.15)
      const sideGlass = new THREE.Mesh(sideGlassGeo, glassMat)
      group.add(sideGlass)
    }

    // Hood accent stripe
    const stripeGeo = new THREE.BoxGeometry(0.4, 0.02, 1.5)
    stripeGeo.translate(0, 0.76, 1.2)
    const stripe = new THREE.Mesh(stripeGeo, accentMat)
    group.add(stripe)

    // Roof accent
    const roofStripe = new THREE.BoxGeometry(0.3, 0.02, 1.8)
    roofStripe.translate(0, 1.29, -0.15)
    const roofLine = new THREE.Mesh(roofStripe, accentMat)
    group.add(roofLine)

    // Front bumper
    const bumperFGeo = new THREE.BoxGeometry(2.1, 0.25, 0.15)
    bumperFGeo.translate(0, 0.38, 2.15)
    const bumperF = new THREE.Mesh(bumperFGeo, darkMat)
    group.add(bumperF)

    // Rear bumper
    const bumperRGeo = new THREE.BoxGeometry(2.1, 0.25, 0.15)
    bumperRGeo.translate(0, 0.38, -2.15)
    const bumperR = new THREE.Mesh(bumperRGeo, darkMat)
    group.add(bumperR)

    // Headlights
    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.6,
      roughness: 0.1,
      metalness: 0.8,
    })
    for (const side of [-0.7, 0.7]) {
      const hlGeo = new THREE.BoxGeometry(0.4, 0.12, 0.06)
      hlGeo.translate(side, 0.6, 2.13)
      const hl = new THREE.Mesh(hlGeo, headlightMat)
      group.add(hl)
    }

    // Taillights
    const taillightMat = new THREE.MeshStandardMaterial({
      color: 0xff4444,
      emissive: 0xff4444,
      emissiveIntensity: 0.3,
      roughness: 0.2,
    })
    for (const side of [-0.7, 0.7]) {
      const tlGeo = new THREE.BoxGeometry(0.35, 0.1, 0.06)
      tlGeo.translate(side, 0.6, -2.13)
      const tl = new THREE.Mesh(tlGeo, taillightMat)
      group.add(tl)
    }

    // Wheels
    const wheelPositions = [
      { x: -1.05, z: 1.3 },
      { x: 1.05, z: 1.3 },
      { x: -1.05, z: -1.3 },
      { x: 1.05, z: -1.3 },
    ]
    for (const wp of wheelPositions) {
      const wheelGroup = new THREE.Group()

      // Tire
      const tireGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 24)
      tireGeo.rotateZ(Math.PI / 2)
      const tire = new THREE.Mesh(tireGeo, wheelMat)
      tire.castShadow = true
      wheelGroup.add(tire)

      // Rim
      const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.27, 12)
      rimGeo.rotateZ(Math.PI / 2)
      const rim = new THREE.Mesh(rimGeo, accentMat)
      wheelGroup.add(rim)

      // Hub
      const hubGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.29, 8)
      hubGeo.rotateZ(Math.PI / 2)
      const hub = new THREE.Mesh(hubGeo, bodyMat)
      wheelGroup.add(hub)

      wheelGroup.position.set(wp.x, 0.35, wp.z)
      group.add(wheelGroup)
    }

    // Side skirts (accent)
    for (const side of [-1, 1]) {
      const skirtGeo = new THREE.BoxGeometry(0.04, 0.08, 3.8)
      skirtGeo.translate(side * 1.02, 0.3, 0)
      const skirt = new THREE.Mesh(skirtGeo, accentMat)
      group.add(skirt)
    }

    // Solar panel on roof (solar punk touch)
    const solarGeo = new THREE.BoxGeometry(1.4, 0.02, 1.4)
    solarGeo.translate(0, 1.3, -0.15)
    const solarMat = new THREE.MeshStandardMaterial({
      color: 0x1a3a2a,
      roughness: 0.15,
      metalness: 0.7,
    })
    const solar = new THREE.Mesh(solarGeo, solarMat)
    group.add(solar)

    // Solar panel grid lines
    for (let i = -2; i <= 2; i++) {
      const lineGeo = new THREE.BoxGeometry(0.01, 0.025, 1.38)
      lineGeo.translate(i * 0.28, 1.31, -0.15)
      const line = new THREE.Mesh(lineGeo, accentMat)
      group.add(line)
    }
    for (let i = -2; i <= 2; i++) {
      const lineGeo = new THREE.BoxGeometry(1.38, 0.025, 0.01)
      lineGeo.translate(0, 1.31, -0.15 + i * 0.28)
      const line = new THREE.Mesh(lineGeo, accentMat)
      group.add(line)
    }

    return group
  }

  function showXray(part: VehiclePart | null) {
    if (!scene || !carGroup) return

    // Remove existing xray
    clearXray()

    if (!part) {
      // Restore car opacity
      setCarOpacity(1.0, false)
      return
    }

    // Make car body semi-transparent for X-ray effect
    setCarOpacity(0.3, true)

    // Determine color based on status
    let color = 0x10b981
    if (part.status === 'warn') color = 0xf59e0b
    if (part.status === 'critical') color = 0xef4444

    const colorObj = new THREE.Color(color)

    // Inner glowing volume
    const geo = new THREE.BoxGeometry(part.scale.x, part.scale.y, part.scale.z)
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    xrayMesh = new THREE.Mesh(geo, mat)
    xrayMesh.position.set(part.position.x, part.position.y, part.position.z)
    scene.add(xrayMesh)

    // Wireframe outline
    const outlineGeo = new THREE.BoxGeometry(
      part.scale.x + 0.02,
      part.scale.y + 0.02,
      part.scale.z + 0.02
    )
    const outlineMat = new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0.8,
    })
    xrayOutline = new THREE.Mesh(outlineGeo, outlineMat)
    xrayOutline.position.copy(xrayMesh.position)
    scene.add(xrayOutline)

    // Edge lines (box edges)
    const edgesGeo = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(part.scale.x + 0.01, part.scale.y + 0.01, part.scale.z + 0.01)
    )
    const edgesMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 1.0,
      linewidth: 2,
    })
    const edgeLines = new THREE.LineSegments(edgesGeo, edgesMat)
    edgeLines.position.copy(xrayMesh.position)
    edgeLines.name = 'xray-edges'
    scene.add(edgeLines)
    xrayExtras.push(edgeLines)

    // Scanning plane that moves vertically inside the part
    const scanGeo = new THREE.PlaneGeometry(part.scale.x * 1.1, part.scale.z * 1.1)
    const scanMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const scanPlane = new THREE.Mesh(scanGeo, scanMat)
    scanPlane.rotation.x = -Math.PI / 2
    scanPlane.position.set(part.position.x, part.position.y, part.position.z)
    scanPlane.name = 'xray-scan'
    scene.add(scanPlane)
    xrayExtras.push(scanPlane)
    xrayScanData = {
      mesh: scanPlane,
      minY: part.position.y - part.scale.y / 2,
      maxY: part.position.y + part.scale.y / 2,
    }

    // Corner markers (small spheres at corners for extra visual flair)
    const halfScale = {
      x: part.scale.x / 2,
      y: part.scale.y / 2,
      z: part.scale.z / 2,
    }
    const corners: [number, number, number][] = [
      [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
      [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
    ]
    for (const [cx, cy, cz] of corners) {
      const sphereGeo = new THREE.SphereGeometry(0.03, 8, 8)
      const sphereMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
      })
      const sphere = new THREE.Mesh(sphereGeo, sphereMat)
      sphere.position.set(
        part.position.x + cx * halfScale.x,
        part.position.y + cy * halfScale.y,
        part.position.z + cz * halfScale.z
      )
      sphere.name = 'xray-corner'
      scene.add(sphere)
      xrayExtras.push(sphere)
    }
  }

  function clearXray() {
    if (xrayMesh && scene) {
      scene.remove(xrayMesh)
      xrayMesh.geometry.dispose()
      ;(xrayMesh.material as THREE.Material).dispose()
      xrayMesh = null
    }
    if (xrayOutline && scene) {
      scene.remove(xrayOutline)
      xrayOutline.geometry.dispose()
      ;(xrayOutline.material as THREE.Material).dispose()
      xrayOutline = null
    }
    // Clean up extras (edges, scan plane, corner spheres)
    for (const obj of xrayExtras) {
      scene?.remove(obj)
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        ;(obj.material as THREE.Material).dispose()
      } else if (obj instanceof THREE.LineSegments) {
        obj.geometry.dispose()
        ;(obj.material as THREE.Material).dispose()
      }
    }
    xrayExtras = []
    xrayScanData = null
    // Always restore car opacity when clearing xray
    setCarOpacity(1.0, false)
  }

  function setCarOpacity(opacity: number, transparent: boolean) {
    if (!carGroup) return
    carGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material as THREE.MeshStandardMaterial
        if (!originalMaterials.has(child)) {
          originalMaterials.set(child, { opacity: mat.opacity, transparent: mat.transparent })
        }
        if (opacity >= 1.0 && !transparent) {
          const orig = originalMaterials.get(child)!
          mat.transparent = orig.transparent
          mat.opacity = orig.opacity
        } else {
          mat.transparent = true
          mat.opacity = opacity
        }
        mat.needsUpdate = true
      }
    })
  }

  function setIndicatorParts(parts: VehiclePart[]) {
    indicatorParts = parts
  }

  function projectIndicators() {
    if (!camera || !renderer) return

    const canvas = renderer.domElement
    const rect = canvas.getBoundingClientRect()

    indicatorScreenPositions.value = indicatorParts.map(part => {
      const pos = new THREE.Vector3(part.position.x, part.position.y + part.scale.y / 2 + 0.15, part.position.z)
      pos.project(camera!)

      const x = (pos.x * 0.5 + 0.5) * rect.width
      const y = (-pos.y * 0.5 + 0.5) * rect.height
      const visible = pos.z < 1

      return { id: part.id, x, y, visible, status: part.status }
    })
  }

  function animate() {
    animationId = requestAnimationFrame(animate)

    if (controls) controls.update()

    // Animate xray
    if (xrayMesh) {
      const t = Date.now() * 0.002
      const mat = xrayMesh.material as THREE.MeshBasicMaterial
      mat.opacity = 0.15 + Math.sin(t) * 0.08
    }
    if (xrayOutline) {
      const t = Date.now() * 0.003
      const mat = xrayOutline.material as THREE.MeshBasicMaterial
      mat.opacity = 0.5 + Math.sin(t) * 0.3
    }
    // Animate scan plane
    if (xrayScanData) {
      const t = Date.now() * 0.001
      const range = xrayScanData.maxY - xrayScanData.minY
      const progress = (Math.sin(t) * 0.5 + 0.5)
      xrayScanData.mesh.position.y = xrayScanData.minY + progress * range
      const scanMat = xrayScanData.mesh.material as THREE.MeshBasicMaterial
      scanMat.opacity = 0.12 + Math.sin(t * 3) * 0.06
    }

    // Project indicators
    projectIndicators()

    if (renderer && scene && camera) {
      renderer.render(scene, camera)
    }
  }

  function dispose() {
    if (animationId) cancelAnimationFrame(animationId)
    clearXray()
    if (renderer) {
      renderer.dispose()
      renderer.domElement.remove()
    }
    scene = null
    camera = null
    controls = null
    renderer = null
    carGroup = null
  }

  return {
    init,
    showXray,
    clearXray,
    dispose,
    setIndicatorParts,
    indicatorScreenPositions,
  }
}
