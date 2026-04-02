<template>
  <canvas ref="canvas" />

  <UiAppNav />

  <UiHudBadge v-if="isEmbedded" position="bottom-center">
    Vue embarquée · ESC ou clic pour quitter
  </UiHudBadge>

  <UiHudBadge position="bottom-left" color="blue">
    A / Z : changer caméra · Clic cube : vue embarquée
  </UiHudBadge>
</template>

<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

// ─── Composable principal ────────────────────────────────────────────────────
const canvas = useTemplateRef('canvas')
const three  = useThreeApp(canvas, {
  backgroundColor:    0x111122,
  shadows:            true,
  autoUpdateControls: false, // la page gère plusieurs controls
})

// ─── État réactif UI ─────────────────────────────────────────────────────────
const isEmbedded = ref(false)

// ─── Setup de la scène ───────────────────────────────────────────────────────
onMounted(async () => {
  const { scene, camera, renderer } = three

  // — Position caméra principale (camera1) —
  camera.position.set(0, 6, -8)
  camera.lookAt(0, 0, 0)
  three.controls.target.set(0, 0, 0)
  three.controls.update()

  // ── Caméra secondaire ──────────────────────────────────────────────────────
  const camera2 = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100)
  camera2.position.set(0, 6, 8)

  // ── Caméra embarquée (parente du cube) ────────────────────────────────────
  const cameraOnCube = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 100)
  cameraOnCube.position.set(0, 0.8, 0)
  cameraOnCube.rotation.y = Math.PI

  // ── Controls caméra 2 ──────────────────────────────────────────────────────
  const controls2 = new OrbitControls(camera2, renderer.domElement)
  controls2.target.set(0, 0, 0)
  controls2.enabled = false
  controls2.update()
  three.onCleanup(() => controls2.dispose())

  // Caméra active pour la boucle
  let activeControls = three.controls

  // ── Resize des caméras supplémentaires ────────────────────────────────────
  function onExtraResize() {
    const a = window.innerWidth / window.innerHeight
    camera2.aspect    = a; camera2.updateProjectionMatrix()
    cameraOnCube.aspect = a; cameraOnCube.updateProjectionMatrix()
  }
  window.addEventListener('resize', onExtraResize)
  three.onCleanup(() => window.removeEventListener('resize', onExtraResize))

  // ── Lumières ──────────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0xffffff, 0.4))

  const pointLight = new THREE.PointLight(0xffffff, 25)
  pointLight.position.set(0, 5, 0)
  pointLight.castShadow = true
  pointLight.shadow.mapSize.set(1024, 1024)
  pointLight.shadow.camera.near = 0.5
  pointLight.shadow.camera.far  = 15
  scene.add(pointLight)

  // ── Sol ───────────────────────────────────────────────────────────────────
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshStandardMaterial({ color: 0x334455 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  // ── Cube (se déplace sur la courbe) ───────────────────────────────────────
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x00ff88, roughness: 0.3, metalness: 0.2 }),
  )
  cube.position.set(-2, 0.8, 0)
  cube.castShadow = true
  cube.add(cameraOnCube) // caméra embarquée parentée au cube
  scene.add(cube)

  // ── Tore ──────────────────────────────────────────────────────────────────
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.2, 16, 48),
    new THREE.MeshStandardMaterial({ color: 0xff4400, roughness: 0.4, metalness: 0.3 }),
  )
  torus.position.set(2, 0.8, 0)
  torus.castShadow = true
  scene.add(torus)

  // ── Sphère plexiglass (matériau partagé avec la page /materiaux) ──────────
  const { material: plexiMat, dispose: disposePlexi } = createPlexiglass()
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.8, 48, 32), plexiMat)
  sphere.position.set(0, 0.8, -3)
  scene.add(sphere)
  three.onCleanup(disposePlexi)

  // ── Modèle GLTF ───────────────────────────────────────────────────────────
  const loader = new GLTFLoader()
  const gltf   = await loader.loadAsync('/models/roue_test.gltf')
  scene.add(gltf.scene)

  // ── Courbe CatmullRom ─────────────────────────────────────────────────────
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2, 0.5, -2),
    new THREE.Vector3( 2, 0.5, -2),
    new THREE.Vector3( 2, 0.5,  2),
    new THREE.Vector3(-2, 0.5,  2),
  ], true)

  scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(curve.getPoints(120)),
    new THREE.LineBasicMaterial({ color: 0xffee00 }),
  ))

  // ── Raycaster ─────────────────────────────────────────────────────────────
  const raycaster  = new THREE.Raycaster()
  const mouse      = new THREE.Vector2()
  const selectables = [cube, torus, gltf.scene]

  const _focusPos = new THREE.Vector3()
  function focusObject(obj) {
    obj.getWorldPosition(_focusPos)
    activeControls?.target.copy(_focusPos)
    activeControls?.update()
  }

  function enterEmbedded() {
    isEmbedded.value = true
    three.setActiveCamera(cameraOnCube)
    activeControls = null
    three.controls.enabled = false
    controls2.enabled       = false
  }

  function exitEmbedded() {
    isEmbedded.value = false
    three.setActiveCamera(camera)
    activeControls          = three.controls
    three.controls.enabled = true
  }

  function onClick(e) {
    if (isEmbedded.value) { exitEmbedded(); return }

    const rect = renderer.domElement.getBoundingClientRect()
    mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
    mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1

    raycaster.setFromCamera(mouse, three.controls.enabled ? camera : camera2)
    const hits = raycaster.intersectObjects(selectables, true)
    if (!hits.length) return

    // Remonte la hiérarchie pour trouver l'objet sélectionnable racine
    let hit = hits[0].object
    while (hit.parent && !selectables.includes(hit)) {
      hit = hit.parent
    }
    hit === cube ? enterEmbedded() : focusObject(hits[0].object)
  }

  function onKeyDown(e) {
    if (e.key === 'Escape' && isEmbedded.value) { exitEmbedded(); return }
    if (isEmbedded.value) return

    if (e.key === 'a') {
      three.setActiveCamera(camera)
      activeControls          = three.controls
      three.controls.enabled = true
      controls2.enabled       = false
    } else if (e.key === 'z') {
      three.setActiveCamera(camera2)
      activeControls          = controls2
      controls2.enabled       = true
      three.controls.enabled = false
    }
  }

  window.addEventListener('click', onClick)
  window.addEventListener('keydown', onKeyDown)
  three.onCleanup(() => {
    window.removeEventListener('click', onClick)
    window.removeEventListener('keydown', onKeyDown)
  })

  // ── Boucle d'animation ────────────────────────────────────────────────────
  const _pos       = new THREE.Vector3()
  const _tangent   = new THREE.Vector3()
  const _lookAt    = new THREE.Vector3()

  three.onLoop((time) => {
    const t = (time / 5000) % 1
    curve.getPoint(t, _pos)
    curve.getTangent(t, _tangent)

    cube.position.copy(_pos)
    cube.lookAt(_lookAt.copy(_pos).add(_tangent))

    torus.rotation.y   = time / 2000
    sphere.rotation.y  = time / 4000

    activeControls?.update()
  })
})
</script>
