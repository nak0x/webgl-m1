<template>
  <canvas ref="canvas" />

  <UiAppNav />

  <UiMaterialLabel
    v-for="lbl in labels"
    :key="lbl.name"
    :x="lbl.x"
    :y="lbl.y"
    :name="lbl.name"
    :description="lbl.description"
  />
</template>

<script setup>
import * as THREE from 'three'

// ─── Composable principal ────────────────────────────────────────────────────
const canvas = useTemplateRef('canvas')
const three  = useThreeApp(canvas, {
  backgroundColor:   0x0d0d1a,
  shadows:           true,
  toneMapping:       true,
  toneMappingExposure: 1.2,
  orbitControls:     true,
  orbitDamping:      true,
})

// ─── Labels réactifs (mis à jour à chaque frame) ─────────────────────────────
const labels = ref([
  { name: 'Plexiglass', description: 'Acrylique · IOR 1.48', x: 0, y: 0 },
  { name: 'Verre',      description: 'Crystal · IOR 1.52',   x: 0, y: 0 },
  { name: 'Bois',       description: 'Chêne · PBR naturel',  x: 0, y: 0 },
  { name: 'Eau',        description: 'Fresnel · IOR 1.33',   x: 0, y: 0 },
])

// ─── Setup de la scène ───────────────────────────────────────────────────────
onMounted(() => {
  const { scene, camera, controls } = three

  // — Caméra & controls —
  camera.position.set(0, 2, 10)
  controls.target.set(0, 0, 0)
  controls.minDistance     = 4
  controls.maxDistance     = 25
  controls.maxPolarAngle   = Math.PI * 0.58
  controls.update()

  // — Brouillard —
  scene.fog = new THREE.FogExp2(0x0d0d1a, 0.04)

  // ── Lumières ──────────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0x223355, 0.8))

  const keyLight = new THREE.DirectionalLight(0xfff5e0, 3)
  keyLight.position.set(6, 10, 6)
  keyLight.castShadow               = true
  keyLight.shadow.mapSize.set(1024, 1024)
  keyLight.shadow.camera.near       = 1
  keyLight.shadow.camera.far        = 30
  keyLight.shadow.camera.left       = -10
  keyLight.shadow.camera.right      = 10
  keyLight.shadow.camera.top        = 10
  keyLight.shadow.camera.bottom     = -10
  scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight(0x4488ff, 1.2)
  fillLight.position.set(-6, 4, -4)
  scene.add(fillLight)

  const rimLight = new THREE.PointLight(0x00ffcc, 8, 20)
  rimLight.position.set(0, 6, -6)
  scene.add(rimLight)

  // ── Sol réfléchissant ─────────────────────────────────────────────────────
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.15, metalness: 0.6 }),
  )
  floor.rotation.x    = -Math.PI / 2
  floor.position.y    = -1.5
  floor.receiveShadow = true
  scene.add(floor)

  // ── Matériaux (depuis utils/) ─────────────────────────────────────────────
  const plexi = createPlexiglass()
  const verre = createVerre()
  const bois  = createBois()
  const eau   = createEau()

  three.onCleanup(() => {
    plexi.dispose()
    verre.dispose()
    bois.dispose()
    eau.dispose()
  })

  // ── Sphères ───────────────────────────────────────────────────────────────
  const GEO = new THREE.SphereGeometry(1.1, 64, 48)
  three.onCleanup(() => GEO.dispose())

  const POSITIONS = [-4.5, -1.5, 1.5, 4.5]
  const matList   = [plexi.material, verre.material, bois.material, eau.material]

  const spheres = matList.map((mat, i) => {
    const mesh = new THREE.Mesh(GEO, mat)
    mesh.position.set(POSITIONS[i], 0, 0)
    mesh.castShadow    = i >= 2   // bois et eau projettent des ombres
    mesh.receiveShadow = true
    scene.add(mesh)
    return mesh
  })

  // ── Piédestaux ────────────────────────────────────────────────────────────
  const pedGeo = new THREE.CylinderGeometry(0.5, 0.65, 0.18, 32)
  const pedMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.4, metalness: 0.7 })
  three.onCleanup(() => { pedGeo.dispose(); pedMat.dispose() })

  POSITIONS.forEach(x => {
    const ped = new THREE.Mesh(pedGeo, pedMat)
    ped.position.set(x, -1.22, 0)
    ped.receiveShadow = true
    scene.add(ped)
  })

  // ── Projection screen-space pour les labels ───────────────────────────────
  const _v3 = new THREE.Vector3()
  function project(worldPos) {
    _v3.copy(worldPos).project(camera)
    return {
      x: (_v3.x *  0.5 + 0.5) * window.innerWidth,
      y: (_v3.y * -0.5 + 0.5) * window.innerHeight,
    }
  }

  // ── Boucle d'animation ────────────────────────────────────────────────────
  const clock = new THREE.Clock()

  three.onLoop(() => {
    const t = clock.getElapsedTime()

    // Rotation & lévitation
    spheres[0].rotation.y =  t * 0.18
    spheres[1].rotation.y = -t * 0.14
    spheres[2].rotation.y =  t * 0.22
    spheres[3].rotation.y =  t * 0.10
    spheres.forEach((s, i) => { s.position.y = Math.sin(t * 0.7 + i * 1.1) * 0.12 })

    // Mise à jour des uniforms eau
    eau.uniforms.uTime.value = t
    eau.uniforms.uCameraPos.value.copy(camera.position)

    // Mise à jour des labels (sous les sphères)
    spheres.forEach((s, i) => {
      const { x, y } = project(new THREE.Vector3(s.position.x, s.position.y - 1.45, s.position.z))
      labels.value[i].x = x
      labels.value[i].y = y
    })
  })
})
</script>
