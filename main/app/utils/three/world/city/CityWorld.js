import * as THREE        from '/lib/three.js'
import FpsController    from '../../FpsController.js'
import CrosshairTarget  from '../../CrosshairTarget.js'
import DialogueManager  from '../../dialogue/DialogueManager.js'
import GlassesManager   from '../../glasses/GlassesManager.js'
import { buildOctree }  from '../../buildOctree.js'
import CityChunkManager from './CityChunkManager.js'
import CityCollisionManager from './CityCollisionManager.js'
import { SPAWN, EYE_HEIGHT, worldToChunk } from './CityConfig.js'

// FpsController capsule radius is 0.3, EYE_HEIGHT constant is 1.0.
// Settled camera height = floor_y + 0.3 + 1.0.
// To get settled eye at EYE_HEIGHT (1.45m): floor_y = 1.45 - 1.3 = 0.15.
const FLOOR_Y = EYE_HEIGHT - 1.3          // 0.15 m — capsule settles at eye 1.45 m
const SKY     = new THREE.Color(0xf5c46a) // warm golden pre-sunset sky
const FOG     = new THREE.Color(0xf0b85c) // slightly deeper haze toward horizon

export default class CityWorld {
  constructor(experience, callbacks = {}) {
    this.experience = experience
    this.scene      = experience.scene
    this.camera     = experience.camera
    this._callbacks = callbacks

    this.scene.background = SKY.clone()
    this.scene.fog         = new THREE.FogExp2(FOG.clone(), 0.007)

    this.dialogue = new DialogueManager()
    experience.setDialogue(this.dialogue)

    this._glasses = new GlassesManager()
    experience.setGlasses(this._glasses)
    this._callbacks.onGlassesReady?.(this._glasses)
    this._glasses.equip()

    // No preloaded resources — start immediately once Resources fires 'ready'.
    experience.resources.on('ready', () => this._setup())
  }

  async _setup() {
    this._setupLights()
    this._setupFloor()
    this._setupFps()
    this._registerAtmosphere()   // also loads city_sky.json + adds Atmosphere lil-gui folder
    this._setupDebug()
    this._setupChunks()          // async, fire-and-forget — chunks load progressively
  }

  _setupLights() {
    this._ambient = new THREE.AmbientLight(0xffb87a, 0.85)
    this.scene.add(this._ambient)

    // Sun ~5° above horizon, WSW — deep amber-orange pre-sunset rake
    this._sun = new THREE.DirectionalLight(0xff7822, 3.6)
    this._sun.position.set(-10, 0.9, 1.8)
    this._sun.castShadow = true
    this._sun.shadow.mapSize.set(2048, 2048)
    this._sun.shadow.camera.near   = 1
    this._sun.shadow.camera.far    = 800
    this._sun.shadow.camera.left   = -220
    this._sun.shadow.camera.right  = 220
    this._sun.shadow.camera.top    = 220
    this._sun.shadow.camera.bottom = -220
    this._sun.shadow.bias = -0.002
    this._sun.shadow.camera.updateProjectionMatrix()
    this.scene.add(this._sun)

    // Cool blue sky fill from ENE (opposite the sun)
    this._fill = new THREE.DirectionalLight(0x6080b8, 0.38)
    this._fill.position.set(8, 4, -5)
    this.scene.add(this._fill)

    this._hemi = new THREE.HemisphereLight(0xf0c880, 0x806040, 0.50)
    this.scene.add(this._hemi)
  }

  // Invisible flat ground used by FpsController's octree.
  // Placed at FLOOR_Y so the capsule settles with camera at exactly EYE_HEIGHT.
  _setupFloor() {
    const geo  = new THREE.PlaneGeometry(4000, 4000)
    const mat  = new THREE.MeshBasicMaterial({ visible: false })
    this._floor = new THREE.Mesh(geo, mat)
    this._floor.rotation.x  = -Math.PI / 2
    this._floor.position.y  = FLOOR_Y
    this._floor.updateMatrixWorld(true)
    this.scene.add(this._floor)
    this._floorOctree = buildOctree(this._floor)
  }

  _setupFps() {
    this.camera.instance.position.copy(SPAWN)
    this.camera.instance.lookAt(SPAWN.x + 1, SPAWN.y, SPAWN.z)

    this._fps      = new FpsController(this.experience, this._floorOctree)
    this._crosshair = new CrosshairTarget(this.experience)
    this.experience.interaction.setFpsMode(true)

    this.dialogue.on('open',     () => { this._fps.enabled = false; this._fps.controls.unlock() })
    this.dialogue.on('complete', () => { this._fps.enabled = true;  this._fps.lock() })

    this._callbacks.onFpsReady?.(this._fps)
  }

  _registerAtmosphere() {
    this.experience.renderProfile.registerAtmosphere({
      key:   'city',
      file:  'city_sky.json',          // preserved filename — existing tuning survives
      getSettings:   () => this._buildAtmosphere(),
      applySettings: s  => this._applyAtmosphere(s),
      setupDebug:    folder => this._setupAtmosphereDebug(folder),
    })
  }

  _setupAtmosphereDebug(root) {
    const skyF    = root.addFolder('Sky & Fog'); skyF.close()
    const skyProxy = { color: '#' + this.scene.background.getHexString() }
    const fogProxy = { color: '#' + this.scene.fog.color.getHexString() }
    skyF.addColor(skyProxy, 'color').name('sky').onChange(v => this.scene.background.set(v))
    skyF.addColor(fogProxy, 'color').name('fog').onChange(v => this.scene.fog.color.set(v))
    skyF.add(this.scene.fog, 'density', 0, 0.05, 0.001).name('density')

    const lightsF = root.addFolder('Lights'); lightsF.close()

    const ambProxy = { color: '#' + this._ambient.color.getHexString() }
    const ambF     = lightsF.addFolder('Ambient'); ambF.close()
    ambF.addColor(ambProxy, 'color').onChange(v => this._ambient.color.set(v))
    ambF.add(this._ambient, 'intensity', 0, 3, 0.01)

    const sunProxy = { color: '#' + this._sun.color.getHexString() }
    const sunF     = lightsF.addFolder('Sun'); sunF.close()
    sunF.addColor(sunProxy, 'color').onChange(v => this._sun.color.set(v))
    sunF.add(this._sun, 'intensity', 0, 10, 0.1)
    sunF.add(this._sun.position, 'x', -30, 30, 0.1 ).name('pos X')
    sunF.add(this._sun.position, 'y',  -2, 20, 0.05).name('elevation')
    sunF.add(this._sun.position, 'z', -30, 30, 0.1 ).name('pos Z')
    const shadowProxy = { resolution: this._sun.shadow.mapSize.x }
    sunF.add(shadowProxy, 'resolution', [512, 1024, 2048, 4096]).name('shadow map res').onChange(v => {
      this._sun.shadow.mapSize.set(v, v)
      this._sun.shadow.map?.dispose()
      this._sun.shadow.map = null
    })

    const fillProxy = { color: '#' + this._fill.color.getHexString() }
    const fillF     = lightsF.addFolder('Fill'); fillF.close()
    fillF.addColor(fillProxy, 'color').onChange(v => this._fill.color.set(v))
    fillF.add(this._fill, 'intensity', 0, 3, 0.01)
    fillF.add(this._fill.position, 'x', -30, 30, 0.1).name('pos X')
    fillF.add(this._fill.position, 'y',   0, 20, 0.1).name('pos Y')
    fillF.add(this._fill.position, 'z', -30, 30, 0.1).name('pos Z')

    const hemiSkyProxy    = { color: '#' + this._hemi.color.getHexString() }
    const hemiGroundProxy = { color: '#' + this._hemi.groundColor.getHexString() }
    const hemiF           = lightsF.addFolder('Hemisphere'); hemiF.close()
    hemiF.addColor(hemiSkyProxy,    'color').name('sky').onChange(v => this._hemi.color.set(v))
    hemiF.addColor(hemiGroundProxy, 'color').name('ground').onChange(v => this._hemi.groundColor.set(v))
    hemiF.add(this._hemi, 'intensity', 0, 2, 0.01)
  }

  _setupDebug() {
    const { debug } = this.experience
    if (!debug.active) return

    const root = debug.gui.addFolder('City'); root.close()
    this._debugFolder = root
    this._setupMinimap()
  }

  _setupMinimap() {
    const MAP_PX = 256

    const wrapper = document.createElement('div')
    Object.assign(wrapper.style, {
      position:      'fixed',
      bottom:        '16px',
      right:         '16px',
      zIndex:        '1000',
      pointerEvents: 'none',
    })

    const canvas = document.createElement('canvas')
    canvas.width  = MAP_PX
    canvas.height = MAP_PX
    Object.assign(canvas.style, {
      display:        'block',
      border:         '1px solid rgba(0,255,255,0.35)',
      imageRendering: 'pixelated',
    })

    const coords = document.createElement('div')
    Object.assign(coords.style, {
      marginTop:  '4px',
      background: 'rgba(0,0,0,0.72)',
      padding:    '3px 8px',
      font:       '11px/1.5 monospace',
      color:      '#0ff',
      whiteSpace: 'pre',
    })
    coords.textContent = 'x:   0.0   y:   0.0   z:   0.0'

    wrapper.appendChild(canvas)
    wrapper.appendChild(coords)
    document.body.appendChild(wrapper)

    // Ortho camera looking straight down, -Z is screen up (= world north).
    // Covers 64 WU (1 CHUNK_SIZE) from edge to edge.
    const orthoCamera = new THREE.OrthographicCamera(-32, 32, 32, -32, 0.1, 600)
    orthoCamera.up.set(0, 0, -1)

    // Height-based shader: light grey below 0.4 m (streets/ground), dark grey above (buildings).
    const heightShader = new THREE.ShaderMaterial({
      vertexShader: /* glsl */`
        varying float vWorldY;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldY = worldPos.y;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: /* glsl */`
        varying float vWorldY;
        void main() {
          float grey = mix(0.72, 0.22, step(0.4, vWorldY));
          gl_FragColor = vec4(vec3(grey), 1.0);
        }
      `,
      side: THREE.DoubleSide,
    })

    // Reusable pixel buffers — avoid allocating on every throttled frame.
    const pixelBuffer   = new Uint8Array(MAP_PX * MAP_PX * 4)
    const flippedBuffer = new Uint8ClampedArray(MAP_PX * MAP_PX * 4)
    const savedClearColor = new THREE.Color()

    this._minimap = {
      wrapper, canvas, ctx: canvas.getContext('2d'), coords, timer: 0,
      renderTarget: new THREE.WebGLRenderTarget(MAP_PX, MAP_PX),
      orthoCamera, heightShader, pixelBuffer, flippedBuffer, savedClearColor,
    }
  }

  _updateMinimap(delta) {
    if (!this._minimap) return

    const cam        = this.camera.instance
    const { x, y, z } = cam.position

    // Coordinates — updated every frame.
    this._minimap.coords.textContent =
      `x: ${x.toFixed(1).padStart(7)}   y: ${y.toFixed(1).padStart(5)}   z: ${z.toFixed(1).padStart(7)}`

    // Canvas — throttled to ~20 fps.
    this._minimap.timer += delta
    if (this._minimap.timer < 50) return
    this._minimap.timer = 0

    const { canvas, ctx, renderTarget, orthoCamera, heightShader,
            pixelBuffer, flippedBuffer, savedClearColor } = this._minimap
    const MAP_PX   = canvas.width
    const renderer = this.experience.renderer.instance
    const scene    = this.scene

    // Position ortho camera 400 m above player, looking straight down.
    orthoCamera.position.set(x, 400, z)
    orthoCamera.lookAt(x, 0, z)
    orthoCamera.updateMatrixWorld()

    // Override scene state for the minimap render.
    const savedBackground     = scene.background
    const savedFog            = scene.fog
    const savedOverride       = scene.overrideMaterial
    const savedClearAlpha     = renderer.getClearAlpha()
    renderer.getClearColor(savedClearColor)

    scene.background      = null
    scene.fog             = null
    scene.overrideMaterial = heightShader
    renderer.setClearColor(0x0a0c16, 1)

    // Render scene top-down into the minimap render target.
    renderer.setRenderTarget(renderTarget)
    renderer.clearColor()
    renderer.clearDepth()
    renderer.render(scene, orthoCamera)

    // Read pixels back (WebGL stores rows bottom-to-top).
    renderer.readRenderTargetPixels(renderTarget, 0, 0, MAP_PX, MAP_PX, pixelBuffer)

    // Restore renderer + scene state before any other use.
    renderer.setRenderTarget(null)
    renderer.setClearColor(savedClearColor, savedClearAlpha)
    scene.background       = savedBackground
    scene.fog              = savedFog
    scene.overrideMaterial = savedOverride

    // Flip Y: WebGL = bottom-to-top, Canvas 2D = top-to-bottom.
    const stride = MAP_PX * 4
    for (let row = 0; row < MAP_PX; row++) {
      const src = (MAP_PX - 1 - row) * stride
      flippedBuffer.set(pixelBuffer.subarray(src, src + stride), row * stride)
    }
    ctx.putImageData(new ImageData(flippedBuffer, MAP_PX, MAP_PX), 0, 0)

    // Crosshair guide.
    const HW = MAP_PX / 2, HH = MAP_PX / 2
    ctx.strokeStyle = 'rgba(0,255,255,0.15)'
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.moveTo(HW, 0);   ctx.lineTo(HW, MAP_PX)
    ctx.moveTo(0,  HH);  ctx.lineTo(MAP_PX, HH)
    ctx.stroke()

    // Direction arrow.
    const dir   = new THREE.Vector3()
    cam.getWorldDirection(dir)
    const ARROW = 14
    const ax    = HW + dir.x * ARROW
    const ay    = HH + dir.z * ARROW
    const angle = Math.atan2(dir.x, dir.z)
    const WING  = 6

    ctx.strokeStyle = '#00ffff'
    ctx.lineWidth   = 2
    ctx.beginPath()
    ctx.moveTo(HW, HH); ctx.lineTo(ax, ay)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(ax + Math.sin(angle + 2.4) * WING, ay + Math.cos(angle + 2.4) * WING)
    ctx.moveTo(ax, ay)
    ctx.lineTo(ax + Math.sin(angle - 2.4) * WING, ay + Math.cos(angle - 2.4) * WING)
    ctx.stroke()

    // Player dot.
    ctx.fillStyle = '#00ffff'
    ctx.beginPath()
    ctx.arc(HW, HH, 3, 0, Math.PI * 2)
    ctx.fill()
  }

  _setupCollisionDebug() {
    if (!this._debugFolder) return

    const colF  = this._debugFolder.addFolder('Collision')
    const proxy = { radius: this._collision.radius, showSphere: false }

    colF.add(proxy, 'radius', 0.1, 2.0, 0.05).name('radius').onChange(v => {
      this._collision.radius = v
    })

    const geo = new THREE.SphereGeometry(1, 16, 8)
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true })
    this._debugCollisionSphere = new THREE.Mesh(geo, mat)
    this._debugCollisionSphere.visible = false
    this.scene.add(this._debugCollisionSphere)

    colF.add(proxy, 'showSphere').name('show sphere').onChange(v => {
      this._debugCollisionSphere.visible = v
    })
  }

  _updateDebugMap() {
    if (!this._collision || !this._debugCollisionSphere?.visible) return
    this._debugCollisionSphere.position.copy(this.camera.instance.position)
    this._debugCollisionSphere.scale.setScalar(this._collision.radius)
  }

  // ── Atmosphere import/export (delegated to RenderProfile) ────────────────

  _applyAtmosphere(s) {
    if (s.sky) this.scene.background.set(s.sky.color)
    if (s.fog) {
      this.scene.fog.color.set(s.fog.color)
      this.scene.fog.density = s.fog.density
    }
    if (s.ambient) {
      this._ambient.color.set(s.ambient.color)
      this._ambient.intensity = s.ambient.intensity
    }
    if (s.sun) {
      this._sun.color.set(s.sun.color)
      this._sun.intensity = s.sun.intensity
      this._sun.position.set(s.sun.x, s.sun.y, s.sun.z)
      if (s.sun.shadowRes) {
        this._sun.shadow.mapSize.set(s.sun.shadowRes, s.sun.shadowRes)
        this._sun.shadow.map?.dispose()
        this._sun.shadow.map = null
      }
    }
    if (s.fill) {
      this._fill.color.set(s.fill.color)
      this._fill.intensity = s.fill.intensity
      this._fill.position.set(s.fill.x, s.fill.y, s.fill.z)
    }
    if (s.hemi) {
      this._hemi.color.set(s.hemi.sky)
      this._hemi.groundColor.set(s.hemi.ground)
      this._hemi.intensity = s.hemi.intensity
    }
  }

  _buildAtmosphere() {
    return {
      sky:  { color: '#' + this.scene.background.getHexString() },
      fog:  { color: '#' + this.scene.fog.color.getHexString(), density: this.scene.fog.density },
      ambient: {
        color:     '#' + this._ambient.color.getHexString(),
        intensity: this._ambient.intensity,
      },
      sun: {
        color:     '#' + this._sun.color.getHexString(),
        intensity: this._sun.intensity,
        x:         this._sun.position.x,
        y:         this._sun.position.y,
        z:         this._sun.position.z,
        shadowRes: this._sun.shadow.mapSize.x,
      },
      fill: {
        color:     '#' + this._fill.color.getHexString(),
        intensity: this._fill.intensity,
        x:         this._fill.position.x,
        y:         this._fill.position.y,
        z:         this._fill.position.z,
      },
      hemi: {
        sky:       '#' + this._hemi.color.getHexString(),
        ground:    '#' + this._hemi.groundColor.getHexString(),
        intensity: this._hemi.intensity,
      },
    }
  }

  async _setupChunks() {
    this._chunks = new CityChunkManager(this.scene, this.experience.renderProfile.material)
    try {
      await this._chunks.init()

      if (this._chunks.manifest?.chunks?.some(c => c.collision?.bin)) {
        this._collision = new CityCollisionManager(this._chunks.manifest)
        this._fps.setCollisionManager(this._collision)
        const { col, row } = worldToChunk(SPAWN.x, SPAWN.z)
        this._collision.preload(col, row, SPAWN.x, SPAWN.z)
        this._setupCollisionDebug()
      }

      this._chunks.update(SPAWN.x, SPAWN.z)
    } catch (err) {
      console.error('[CityWorld] manifest load failed:', err)
    }
  }

  update() {
    this._fps?.update(this.experience.time.delta)
    this._crosshair?.update()

    if (this._chunks) {
      const { x, z } = this.camera.instance.position
      this._chunks.update(x, z)

      if (this._collision) {
        const { col, row } = worldToChunk(x, z)
        this._collision.preload(col, row, x, z)
      }
    }

    if (this.experience.debug.active) {
      this._updateMinimap(this.experience.time.delta)
      this._updateDebugMap()
    }
  }

  resize() {}

  dispose() {
    this._glasses?.destroy()
    this.dialogue.dispose()
    this._fps?.dispose()
    this._crosshair?.dispose()
    this.experience.interaction.setFpsMode(false)
    this._chunks?.dispose()
    this._collision?.dispose()
    this._floor?.geometry?.dispose()
    this._floor?.material?.dispose()
    this._sun.castShadow = false
    this._sun.shadow.map?.dispose()
    this._sun.shadow.map = null
    if (this._debugCollisionSphere) {
      this.scene.remove(this._debugCollisionSphere)
      this._debugCollisionSphere.geometry?.dispose()
      this._debugCollisionSphere.material?.dispose()
    }
    if (this._minimap) {
      document.body.removeChild(this._minimap.wrapper)
      this._minimap.renderTarget.dispose()
      this._minimap.heightShader.dispose()
      this._minimap = null
    }
    if (this._debugFolder) {
      this._debugFolder.destroy()
      this._debugFolder = null
    }
    this.experience.renderProfile.unregisterAtmosphere()
  }
}
