/**
 * useThreeApp — composable principal Three.js
 *
 * Gère : renderer, scene, env map, caméra principale, OrbitControls,
 * boucle d'animation, resize et cleanup.
 *
 * Usage :
 *   const canvas = useTemplateRef('canvas')
 *   const three  = useThreeApp(canvas, { shadows: true })
 *
 *   onMounted(() => {
 *     three.camera.position.set(0, 4, 8)
 *     scene.add(myMesh)
 *     three.onLoop((time, delta) => { myMesh.rotation.y += delta })
 *   })
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

export function useThreeApp(canvasRef, options = {}) {
  const {
    backgroundColor      = 0x111122,
    shadows              = true,
    toneMapping          = false,
    toneMappingExposure  = 1.0,
    orbitControls        = true,
    orbitDamping         = false,
    autoUpdateControls   = true,
  } = options

  // ── Objets Three.js (initialisés dans onMounted) ──────────────────────────
  let renderer
  let scene
  let camera
  let controls = null

  // Caméra active pour le rendu (peut être changée par la page)
  let _activeCamera = null

  // Listes de callbacks enregistrés par la page
  const _loopCbs    = []
  const _cleanupCbs = []

  let _lastTime = 0

  // ── Setup (onMounted du composable) ───────────────────────────────────────
  onMounted(() => {
    // — Renderer —
    const dpr = Math.min(window.devicePixelRatio, 2)
    renderer = new THREE.WebGLRenderer({
      antialias:       dpr < 2,
      canvas:          canvasRef.value,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(dpr)
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace

    if (shadows) {
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type    = THREE.PCFShadowMap
    }
    if (toneMapping) {
      renderer.toneMapping         = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = toneMappingExposure
    }

    // — Scène —
    scene            = new THREE.Scene()
    scene.background = new THREE.Color(backgroundColor)

    // — Env map PMREM (nécessaire pour MeshPhysical) —
    const pmrem  = new THREE.PMREMGenerator(renderer)
    const envTex = pmrem.fromScene(new RoomEnvironment()).texture
    scene.environment = envTex
    pmrem.dispose()

    // — Caméra principale —
    camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      200,
    )
    camera.position.set(0, 4, 8)
    _activeCamera = camera

    // — Controls —
    if (orbitControls) {
      controls = new OrbitControls(camera, renderer.domElement)
      controls.target.set(0, 0, 0)
      if (orbitDamping) {
        controls.enableDamping  = true
        controls.dampingFactor  = 0.05
      }
      controls.update()
    }

    // — Resize —
    function onResize() {
      const w = window.innerWidth
      const h = window.innerHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)
    _cleanupCbs.push(() => window.removeEventListener('resize', onResize))

    // — Boucle d'animation —
    renderer.setAnimationLoop((time) => {
      const delta = (time - _lastTime) / 1000
      _lastTime   = time

      if (autoUpdateControls) controls?.update()
      _loopCbs.forEach(cb => cb(time, delta))
      renderer.render(scene, _activeCamera ?? camera)
    })
  })

  // ── Cleanup (onUnmounted du composable) ───────────────────────────────────
  onUnmounted(() => {
    _cleanupCbs.forEach(cb => cb())
    renderer?.setAnimationLoop(null)
    controls?.dispose()
    renderer?.dispose()
  })

  // ── API publique ──────────────────────────────────────────────────────────
  return {
    /** Renderer WebGL (disponible après onMounted) */
    get renderer() { return renderer },
    /** Scène Three.js */
    get scene()    { return scene    },
    /** Caméra principale */
    get camera()   { return camera   },
    /** OrbitControls de la caméra principale (null si désactivé) */
    get controls() { return controls },

    /**
     * Change la caméra utilisée pour le rendu.
     * Utile pour les vues embarquées ou les multi-caméras.
     */
    setActiveCamera(cam) {
      _activeCamera = cam
    },

    /** Enregistre un callback appelé à chaque frame. */
    onLoop(cb) {
      _loopCbs.push(cb)
    },

    /** Enregistre un callback appelé au démontage du composant. */
    onCleanup(cb) {
      _cleanupCbs.push(cb)
    },
  }
}
