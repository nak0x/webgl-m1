import * as THREE        from 'three'
import FpsController    from '../../FpsController.js'
import CrosshairTarget  from '../../CrosshairTarget.js'
import DialogueManager  from '../../dialogue/DialogueManager.js'
import { buildOctree }  from '../../buildOctree.js'
import CityChunkManager from './CityChunkManager.js'
import { SPAWN, EYE_HEIGHT } from './CityConfig.js'

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

    // No preloaded resources — start immediately once Resources fires 'ready'.
    experience.resources.on('ready', () => this._setup())
  }

  async _setup() {
    this._setupLights()
    this._setupFloor()
    this._setupFps()
    this._setupDebug()
    this._loadCitySky()    // async, applies atmosphere overrides after lights are ready
    this._setupChunks()    // async, fire-and-forget — chunks load progressively
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

  _setupDebug() {
    const { debug } = this.experience
    if (!debug.active) return

    const root = debug.gui.addFolder('City')

    // ── Sky & Fog ─────────────────────────────────────────────────────────
    const skyF    = root.addFolder('Sky & Fog')
    const skyProxy = { color: '#' + this.scene.background.getHexString() }
    const fogProxy = { color: '#' + this.scene.fog.color.getHexString() }
    skyF.addColor(skyProxy, 'color').name('sky').onChange(v => this.scene.background.set(v))
    skyF.addColor(fogProxy, 'color').name('fog').onChange(v => this.scene.fog.color.set(v))
    skyF.add(this.scene.fog, 'density', 0, 0.05, 0.001).name('density')

    // ── Lights ────────────────────────────────────────────────────────────
    const lightsF = root.addFolder('Lights')

    const ambProxy = { color: '#' + this._ambient.color.getHexString() }
    const ambF     = lightsF.addFolder('Ambient')
    ambF.addColor(ambProxy, 'color').onChange(v => this._ambient.color.set(v))
    ambF.add(this._ambient, 'intensity', 0, 3, 0.01)

    const sunProxy = { color: '#' + this._sun.color.getHexString() }
    const sunF     = lightsF.addFolder('Sun')
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
    const fillF     = lightsF.addFolder('Fill')
    fillF.addColor(fillProxy, 'color').onChange(v => this._fill.color.set(v))
    fillF.add(this._fill, 'intensity', 0, 3, 0.01)
    fillF.add(this._fill.position, 'x', -30, 30, 0.1).name('pos X')
    fillF.add(this._fill.position, 'y',   0, 20, 0.1).name('pos Y')
    fillF.add(this._fill.position, 'z', -30, 30, 0.1).name('pos Z')

    const hemiSkyProxy    = { color: '#' + this._hemi.color.getHexString() }
    const hemiGroundProxy = { color: '#' + this._hemi.groundColor.getHexString() }
    const hemiF           = lightsF.addFolder('Hemisphere')
    hemiF.addColor(hemiSkyProxy,    'color').name('sky').onChange(v => this._hemi.color.set(v))
    hemiF.addColor(hemiGroundProxy, 'color').name('ground').onChange(v => this._hemi.groundColor.set(v))
    hemiF.add(this._hemi, 'intensity', 0, 2, 0.01)

    root.add({ export: () => this._exportCitySky() }, 'export').name('Export sky ↓')

    this._debugFolder = root
  }

  // ── City sky / atmosphere persistence ────────────────────────────────────

  async _loadCitySky() {
    try {
      const res = await fetch('/settings/city_sky.json')
      if (!res.ok) return
      this._applyCitySky(await res.json())
    } catch {
      // file absent or malformed — scene defaults remain
    }
  }

  _applyCitySky(s) {
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

  _buildCitySkySettings() {
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

  _exportCitySky() {
    const json = JSON.stringify(this._buildCitySkySettings(), null, 2)
    const url  = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'city_sky.json' })
    a.click()
    URL.revokeObjectURL(url)
  }

  async _setupChunks() {
    this._chunks = new CityChunkManager(this.scene, this.experience.renderProfile.material)
    try {
      await this._chunks.init()
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
    }
  }

  resize() {}

  dispose() {
    this.dialogue.dispose()
    this._fps?.dispose()
    this._crosshair?.dispose()
    this.experience.interaction.setFpsMode(false)
    this._chunks?.dispose()
    this._floor?.geometry?.dispose()
    this._floor?.material?.dispose()
    this._sun.castShadow = false
    this._sun.shadow.map?.dispose()
    this._sun.shadow.map = null
    this._debugFolder?.destroy()
  }
}
