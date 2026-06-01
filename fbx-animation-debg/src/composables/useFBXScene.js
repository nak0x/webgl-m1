import { ref, reactive, shallowRef, onUnmounted } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'

export function useFBXScene() {
  const renderer = shallowRef(null)
  const scene = shallowRef(null)
  const camera = shallowRef(null)
  const controls = shallowRef(null)
  const mixer = shallowRef(null)
  const model = shallowRef(null)

  const animations = ref([])
  const activeClip = ref(null)
  const activeAction = shallowRef(null)

  const playback = reactive({
    playing: false,
    currentTime: 0,
    duration: 0,
  })

  const clock = new THREE.Clock()
  let animFrameId = null

  function init(canvas) {
    const w = canvas.clientWidth
    const h = canvas.clientHeight

    // Renderer
    const r = new THREE.WebGLRenderer({ canvas, antialias: true })
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    r.setSize(w, h, false)
    r.shadowMap.enabled = true
    r.shadowMap.type = THREE.PCFSoftShadowMap
    r.outputColorSpace = THREE.SRGBColorSpace
    r.toneMapping = THREE.ACESFilmicToneMapping
    r.toneMappingExposure = 1.0
    renderer.value = r

    // Scene
    const s = new THREE.Scene()
    s.background = new THREE.Color(0x141418)
    s.fog = new THREE.Fog(0x141418, 20, 80)
    scene.value = s

    // Camera
    const c = new THREE.PerspectiveCamera(50, w / h, 0.01, 200)
    c.position.set(3, 2.5, 4)
    camera.value = c

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.4)
    s.add(ambient)

    const sun = new THREE.DirectionalLight(0xfff0e0, 1.8)
    sun.position.set(5, 10, 7)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near = 0.5
    sun.shadow.camera.far = 50
    sun.shadow.camera.top = 10
    sun.shadow.camera.bottom = -10
    sun.shadow.camera.left = -10
    sun.shadow.camera.right = 10
    sun.shadow.bias = -0.001
    s.add(sun)

    const fill = new THREE.DirectionalLight(0xc0d8ff, 0.6)
    fill.position.set(-5, 3, -5)
    s.add(fill)

    // Grid
    const grid = new THREE.GridHelper(30, 30, 0x2a2a35, 0x1e1e28)
    s.add(grid)

    // Shadow plane
    const planeGeo = new THREE.PlaneGeometry(30, 30)
    const planeMat = new THREE.ShadowMaterial({ opacity: 0.3 })
    const plane = new THREE.Mesh(planeGeo, planeMat)
    plane.rotation.x = -Math.PI / 2
    plane.receiveShadow = true
    s.add(plane)

    // Controls
    const ctrl = new OrbitControls(c, canvas)
    ctrl.enableDamping = true
    ctrl.dampingFactor = 0.08
    ctrl.minDistance = 0.5
    ctrl.maxDistance = 50
    controls.value = ctrl

    // Resize observer
    const ro = new ResizeObserver(() => onResize(canvas))
    ro.observe(canvas.parentElement)

    // Loop
    function loop() {
      animFrameId = requestAnimationFrame(loop)
      const delta = clock.getDelta()

      if (mixer.value && playback.playing) {
        mixer.value.update(delta)
        if (activeAction.value) {
          playback.currentTime = activeAction.value.time
        }
      }

      ctrl.update()
      r.render(s, c)
    }
    loop()

    return () => {
      ro.disconnect()
      cancelAnimationFrame(animFrameId)
      r.dispose()
    }
  }

  function onResize(canvas) {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    camera.value.aspect = w / h
    camera.value.updateProjectionMatrix()
    renderer.value.setSize(w, h, false)
  }

  function loadFBX(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const loader = new FBXLoader()

      loader.load(
        url,
        (fbx) => {
          URL.revokeObjectURL(url)

          // Remove previous model
          if (model.value) {
            scene.value.remove(model.value)
            model.value.traverse((o) => {
              if (o.geometry) o.geometry.dispose()
              if (o.material) {
                const mats = Array.isArray(o.material) ? o.material : [o.material]
                mats.forEach((m) => m.dispose())
              }
            })
          }
          if (mixer.value) {
            mixer.value.stopAllAction()
            mixer.value = null
          }
          activeAction.value = null
          activeClip.value = null
          playback.playing = false
          playback.currentTime = 0
          playback.duration = 0

          // Normalize scale & position
          const box = new THREE.Box3().setFromObject(fbx)
          const size = new THREE.Vector3()
          box.getSize(size)
          const maxDim = Math.max(size.x, size.y, size.z)
          const scale = maxDim > 0 ? 2.5 / maxDim : 1
          fbx.scale.setScalar(scale)

          const center = new THREE.Vector3()
          box.getCenter(center).multiplyScalar(scale)
          fbx.position.set(-center.x, -box.min.y * scale, -center.z)

          fbx.traverse((o) => {
            if (o.isMesh) {
              o.castShadow = true
              o.receiveShadow = true
            }
          })

          scene.value.add(fbx)
          model.value = fbx

          // Animations
          animations.value = fbx.animations.map((clip, i) => ({
            index: i,
            name: clip.name || `Animation ${i + 1}`,
            duration: clip.duration,
            clip,
          }))

          // Setup mixer
          const mx = new THREE.AnimationMixer(fbx)
          mixer.value = mx

          // Frame camera
          const newBox = new THREE.Box3().setFromObject(fbx)
          const newSize = new THREE.Vector3()
          newBox.getSize(newSize)
          const newCenter = new THREE.Vector3()
          newBox.getCenter(newCenter)
          const dist = Math.max(newSize.x, newSize.y, newSize.z) * 1.8
          camera.value.position.set(
            newCenter.x + dist,
            newCenter.y + dist * 0.6,
            newCenter.z + dist
          )
          controls.value.target.copy(newCenter)
          controls.value.update()

          resolve(animations.value)
        },
        undefined,
        (err) => {
          URL.revokeObjectURL(url)
          reject(err)
        }
      )
    })
  }

  function playAnimation(animItem) {
    if (!mixer.value) return

    // Stop current
    if (activeAction.value) {
      activeAction.value.fadeOut(0.2)
    }

    const action = mixer.value.clipAction(animItem.clip)
    action.reset()
    action.setLoop(THREE.LoopRepeat, Infinity)
    action.fadeIn(0.2)
    action.play()

    activeAction.value = action
    activeClip.value = animItem
    playback.playing = true
    playback.currentTime = 0
    playback.duration = animItem.duration
  }

  function togglePlayback() {
    if (!activeAction.value) return
    playback.playing = !playback.playing
    if (playback.playing) {
      activeAction.value.paused = false
    } else {
      activeAction.value.paused = true
    }
  }

  function seekTo(time) {
    if (!activeAction.value) return
    activeAction.value.time = Math.max(0, Math.min(time, playback.duration))
    playback.currentTime = activeAction.value.time
    // Force mixer update at current time so frame is rendered
    mixer.value.update(0)
  }

  return {
    animations,
    activeClip,
    playback,
    init,
    loadFBX,
    playAnimation,
    togglePlayback,
    seekTo,
  }
}
