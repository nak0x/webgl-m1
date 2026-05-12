import * as THREE from '/lib/three.js'
import EventEmitter from '../EventEmitter.js'
import { applyEasing, lerpParam } from './CinematicInterpolator.js'

const STATEFUL_TYPES = [
  'bloom', 'dof', 'ssao', 'motionBlur', 'vignetteGl',
  'chromaticAberration', 'filmGrain', 'exposure', 'lut', 'fov', 'disableEffect',
]

export default class CinematicPlayer extends EventEmitter {
  constructor(experience, config = null) {
    super()
    this.experience = experience
    this.scene      = experience.scene
    this.resources  = experience.resources
    this._cam       = experience.camera
    this._renderer  = experience.renderer

    this._config           = config
    this._mixer            = null
    this._clips            = []
    this._cameras          = []
    this._model            = null
    this._currentFrame     = 0
    this._totalFrames      = 0
    this._fps              = config?.fps ?? 24
    this._isPlaying        = false
    this._triggeredIds     = new Set()
    this._activeCameraName = null
    this._shakeState       = null
    this._fovOverride      = null

    // Transitions en cours : type d'effet → event JSON de référence
    this._activeTransitions = new Map()

    // AfterimagePass : countdown pour vider le buffer après un seek.
    // La restauration doit se faire au cycle N+1 car CinematicPlayer.update
    // s'exécute avant Renderer.update dans le même cycle.
    this._afterimageResetCountdown = 0
    this._afterimageTargetDamp     = 0.96

    this._cam.autoUpdate       = false
    this._cam.controls.enabled = false

    // État final de chaque effet après son dernier event traité (pour transitions progressives)
    this._effectEndState = {}

    this._lutCache = new Map() // filename → { texture3D, intensity }

    this.resources.on('ready', () => this._setup())
  }

  // ─── Setup ────────────────────────────────────────────────────────────────

  _setup() {
    const gltf = this.resources.items.cinematic
    if (!gltf) return

    this._model = gltf.scene
    this.scene.add(this._model)

    this._cameras = [...(gltf.cameras ?? [])]
    this._model.traverse(child => {
      if (child.isCamera && !this._cameras.includes(child)) this._cameras.push(child)
    })

    this._clips = gltf.animations ?? []
    if (this._clips.length > 0) {
      this._mixer = new THREE.AnimationMixer(this._model)
      this._clips.forEach(clip => {
        const action = this._mixer.clipAction(clip)
        action.loop              = THREE.LoopOnce
        action.clampWhenFinished = true
        action.play()
        action.paused = true
      })
    }

    this._fps = this._config?.fps ?? 24
    const maxDuration  = this._clips.length
      ? Math.max(...this._clips.map(c => c.duration))
      : 0
    this._totalFrames = this._config?.totalFrames ?? Math.ceil(maxDuration * this._fps)

    this._activeCameraName = this._config?.defaultCamera ?? (this._cameras[0]?.name ?? null)
    if (this._activeCameraName) this._applyCamera(this._activeCameraName)

    console.log(
      `[CinematicPlayer] glb loaded — ${this._cameras.length} caméras :`,
      this._cameras.map(c => c.name),
    )

    this.trigger('ready', {
      cameras:     this._cameras.map(c => c.name),
      totalFrames: this._totalFrames,
      fps:         this._fps,
    })
  }

  _applyCamera(name) {
    const cam = this._cameras.find(c => c.name === name)
    if (!cam) return
    cam.updateWorldMatrix(true, false)
    const pos  = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    cam.matrixWorld.decompose(pos, quat, new THREE.Vector3())
    this._cam.instance.position.copy(pos)
    this._cam.instance.quaternion.copy(quat)
    // Copie le FOV depuis la caméra GLB si pas d'override JSON actif
    if (cam.isPerspectiveCamera && this._fovOverride === null) {
      this._cam.instance.fov = cam.fov
      this._cam.instance.updateProjectionMatrix()
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  get currentFrame()     { return this._currentFrame }
  get totalFrames()      { return this._totalFrames }
  get fps()              { return this._fps }
  get cameras()          { return this._cameras.map(c => c.name) }
  get isPlaying()        { return this._isPlaying }
  get activeCameraName() { return this._activeCameraName }

  setDefaultCamera(name) {
    if (!this._cameras.find(c => c.name === name)) return
    this._config = this._config ?? {}
    this._config.defaultCamera = name
    if (!this._config.events?.some(e => e.type === 'cameraCut' && e.frame === 0)) {
      this._activeCameraName = name
      this._applyCamera(name)
    }
  }

  play() {
    if (!this._mixer) return
    this._isPlaying = true
    this._clips.forEach(clip => {
      this._mixer.clipAction(clip).paused = false
    })
  }

  pause() {
    this._isPlaying = false
    this._clips.forEach(clip => {
      if (this._mixer) this._mixer.clipAction(clip).paused = true
    })
  }

  stop() {
    this._isPlaying = false
    this._triggeredIds.clear()
    this._activeTransitions.clear()
    this._clips.forEach(clip => this._mixer?.clipAction(clip).stop())
    this.seek(0)
  }

  seek(frame) {
    this._shakeState  = null
    this._fovOverride = null
    this._activeTransitions.clear()
    this._currentFrame = Math.round(Math.max(0, Math.min(frame, this._totalFrames)))

    if (this._mixer) {
      this._clips.forEach(clip => this._mixer.clipAction(clip).paused = false)
      this._mixer.setTime(this._currentFrame / this._fps)
      if (!this._isPlaying) {
        this._clips.forEach(clip => this._mixer.clipAction(clip).paused = true)
      }
    }

    this._replayStateUpTo(this._currentFrame)
    this.trigger('frame_change', this._currentFrame)
  }

  loadConfig(config) {
    this._config      = config
    this._fps         = config.fps ?? this._fps
    this._totalFrames = config.totalFrames ?? this._totalFrames
    this._triggeredIds.clear()
    this.seek(0)
  }

  syncConfig(config) {
    this._config = config
    this._replayStateUpTo(this._currentFrame)
  }

  /** Appelé par editor.vue après chargement async d'un fichier .cube */
  setLutTexture(file, texture3D, intensity = 1.0) {
    this._lutCache.set(file, { texture3D, intensity })
    this._renderer?.setLut({ texture3D, intensity })
  }

  // ─── Interpolation ───────────────────────────────────────────────────────

  /** Calcule t ∈ [0,1] d'un event à un frame donné, avec easing. */
  _computeT(event, frame) {
    const duration = event.duration ?? 0
    if (duration <= 0) return 1
    const raw = Math.min(Math.max((frame - event.frame) / duration, 0), 1)
    return applyEasing(raw, event.easing ?? 'linear')
  }

  /**
   * Avance toutes les transitions actives au frame courant.
   * Appelé après chaque changement de frame pendant la lecture.
   * Ignore les events dont la frame de départ est identique (déjà appliqués par _fireEvent).
   */
  _tickActiveTransitions(frame) {
    if (this._activeTransitions.size === 0) return
    for (const [type, event] of this._activeTransitions) {
      if (frame === event.frame) continue
      const endFrame = event.frame + (event.duration ?? 0)
      if (frame >= endFrame) {
        this._applyEffect(event, endFrame)
        this._activeTransitions.delete(type)
      } else {
        this._applyEffect(event, frame)
      }
    }
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  _replayStateUpTo(frame) {
    this._triggeredIds.clear()
    this._fovOverride = null
    this._activeTransitions.clear()
    this._effectEndState = {}

    const defaultCam = this._config?.defaultCamera ?? (this._cameras[0]?.name ?? null)

    if (!this._config?.events) {
      this._activeCameraName = defaultCam
      if (this._activeCameraName) this._applyCamera(this._activeCameraName)
      this._renderer?.disableEffect('all')
      return
    }

    this._config.events.filter(e => e.frame < frame).forEach(e => this._triggeredIds.add(e.id))

    // Caméra active
    const lastCut = [...this._config.events]
      .filter(e => e.type === 'cameraCut' && e.frame <= frame)
      .sort((a, b) => b.frame - a.frame)[0]
    this._activeCameraName = lastCut ? lastCut.camera : defaultCam
    if (this._activeCameraName) this._applyCamera(this._activeCameraName)

    // Vignette CSS (overlay Vue)
    this.trigger('vignette_change', { opacity: this._computeVignetteAt(frame), durationMs: 0 })

    // Effets WebGL : reset puis replay chronologique avec interpolation
    this._renderer?.disableEffect('all')

    const effectEvents = this._config.events
      .filter(e => STATEFUL_TYPES.includes(e.type) && e.frame <= frame)
      .sort((a, b) => a.frame - b.frame)

    for (const ev of effectEvents) {
      this._applyEffect(ev, frame)
    }

    // Enregistrer les transitions encore en cours (pour reprise après seek)
    for (const ev of effectEvents) {
      if (ev.type !== 'disableEffect') {
        const endFrame = ev.frame + (ev.duration ?? 0)
        if (endFrame > frame) {
          this._activeTransitions.set(ev.type, ev)
        }
      }
    }

    // Vider le buffer AfterimagePass sur les 2 prochains cycles
    if (this._renderer?.afterimagePass?.enabled) {
      this._afterimageTargetDamp     = this._renderer.afterimagePass.uniforms['damp'].value
      this._afterimageResetCountdown = 2
      this._renderer.afterimagePass.uniforms['damp'].value = 0
    }
  }

  _computeVignetteAt(frame) {
    if (!this._config?.events) return 0
    const last = [...this._config.events]
      .filter(e => e.type === 'vignette' && e.frame <= frame)
      .sort((a, b) => b.frame - a.frame)[0]
    if (!last) return 0
    const duration = last.duration ?? 30
    const progress = Math.min((frame - last.frame) / duration, 1)
    return last.direction === 'in' ? progress : 1 - progress
  }

  /**
   * Applique un effet WebGL en interpolant ses paramètres au `frame` donné.
   * - Si duration = 0 → instantané (t = 1)
   * - Si duration > 0 → t = f(easing, elapsed / duration), lerp sur chaque param
   * - Les champs `*From` sont optionnels : si absent, le paramètre est appliqué tel quel
   */
  _applyEffect(event, frame) {
    const t    = this._computeT(event, frame ?? this._currentFrame)
    const prog = !!event.progressive

    switch (event.type) {
      case 'fov': {
        const prev = prog ? (this._effectEndState.fov ?? {}) : {}
        const v = lerpParam(prog ? prev.fov : event.fovFrom, event.fov, t)
        this._fovOverride = v
        this._cam.instance.fov = v
        this._cam.instance.updateProjectionMatrix()
        this._effectEndState.fov = { fov: event.fov }
        break
      }
      case 'bloom': {
        const prev = prog ? (this._effectEndState.bloom ?? {}) : {}
        this._renderer?.setBloom({
          strength:  lerpParam(prog ? prev.strength  : event.strengthFrom,  event.strength,  t),
          radius:    lerpParam(prog ? prev.radius     : event.radiusFrom,    event.radius,    t),
          threshold: lerpParam(prog ? prev.threshold  : event.thresholdFrom, event.threshold, t),
        })
        this._effectEndState.bloom = { strength: event.strength, radius: event.radius, threshold: event.threshold }
        break
      }
      case 'dof': {
        const prev = prog ? (this._effectEndState.dof ?? {}) : {}
        this._renderer?.setDof({
          focus:    lerpParam(prog ? prev.focus    : event.focusFrom,    event.focus,    t),
          aperture: lerpParam(prog ? prev.aperture : event.apertureFrom, event.aperture, t),
          maxblur:  lerpParam(prog ? prev.maxblur  : event.maxblurFrom,  event.maxblur,  t),
        })
        this._effectEndState.dof = { focus: event.focus, aperture: event.aperture, maxblur: event.maxblur }
        break
      }
      case 'ssao': {
        const prev = prog ? (this._effectEndState.ssao ?? {}) : {}
        this._renderer?.setSsao({
          radius:      lerpParam(prog ? prev.radius      : event.radiusFrom,      event.radius,      t),
          minDistance: lerpParam(prog ? prev.minDistance : event.minDistanceFrom, event.minDistance, t),
          maxDistance: lerpParam(prog ? prev.maxDistance : event.maxDistanceFrom, event.maxDistance, t),
        })
        this._effectEndState.ssao = { radius: event.radius, minDistance: event.minDistance, maxDistance: event.maxDistance }
        break
      }
      case 'motionBlur': {
        const prev = prog ? (this._effectEndState.motionBlur ?? {}) : {}
        const damp = lerpParam(prog ? prev.damp : event.dampFrom, event.damp, t)
        this._afterimageTargetDamp = damp
        this._renderer?.setMotionBlur({ damp })
        this._effectEndState.motionBlur = { damp: event.damp }
        break
      }
      case 'vignetteGl': {
        const prev = prog ? (this._effectEndState.vignetteGl ?? {}) : {}
        this._renderer?.setVignette({
          offset:   lerpParam(prog ? prev.offset   : event.offsetFrom,   event.offset,   t),
          darkness: lerpParam(prog ? prev.darkness : event.darknessFrom, event.darkness, t),
        })
        this._effectEndState.vignetteGl = { offset: event.offset, darkness: event.darkness }
        break
      }
      case 'chromaticAberration': {
        const prev = prog ? (this._effectEndState.chromaticAberration ?? {}) : {}
        this._renderer?.setChromaticAberration({
          amount: lerpParam(prog ? prev.amount : event.amountFrom, event.amount, t),
        })
        this._effectEndState.chromaticAberration = { amount: event.amount }
        break
      }
      case 'filmGrain': {
        const prev = prog ? (this._effectEndState.filmGrain ?? {}) : {}
        this._renderer?.setFilmGrain({
          nIntensity: lerpParam(prog ? prev.nIntensity : event.nIntensityFrom, event.nIntensity, t),
          grayscale:  event.grayscale,
        })
        this._effectEndState.filmGrain = { nIntensity: event.nIntensity, grayscale: event.grayscale }
        break
      }
      case 'exposure': {
        const prev = prog ? (this._effectEndState.exposure ?? {}) : {}
        this._renderer?.setExposure({
          ev: lerpParam(prog ? prev.ev : event.evFrom, event.ev, t),
        })
        this._effectEndState.exposure = { ev: event.ev }
        break
      }
      case 'lut': {
        const prev   = prog ? (this._effectEndState.lut ?? {}) : {}
        const cached = this._lutCache.get(event.file)
        if (cached) {
          this._renderer?.setLut({
            texture3D: cached.texture3D,
            intensity: lerpParam(prog ? prev.intensity : event.intensityFrom, event.intensity ?? 1.0, t),
          })
        } else {
          this.trigger('load_lut', { file: event.file, intensity: event.intensity ?? 1.0 })
        }
        this._effectEndState.lut = { intensity: event.intensity ?? 1.0 }
        break
      }
      case 'disableEffect':
        this._renderer?.disableEffect(event.effectName)
        delete this._effectEndState[event.effectName]
        break
    }
  }

  _fireEvent(event) {
    this.trigger('event_trigger', event)

    if (event.type === 'cameraCut') {
      this._activeCameraName = event.camera
      this._applyCamera(event.camera)
    } else if (event.type === 'sound') {
      this.trigger('play_sound', { file: event.file, volume: event.volume ?? 0.8 })
    } else if (event.type === 'shake') {
      this._shakeState = {
        intensity: event.intensity ?? 0.5,
        elapsed:   0,
        duration:  event.duration  ?? 20,
      }
    } else if (event.type === 'vignette') {
      this.trigger('vignette_change', {
        opacity:    event.direction === 'out' ? 0 : 1,
        durationMs: Math.round((event.duration ?? 30) / this._fps * 1000),
      })
    } else {
      // Effets WebGL : appliquer à t=0 (début de transition)
      this._applyEffect(event, event.frame)
      // Enregistrer si la transition a une durée
      if ((event.duration ?? 0) > 0) {
        this._activeTransitions.set(event.type, event)
      }
    }
  }

  _applyShake() {
    if (!this._shakeState) return
    const { intensity, elapsed, duration } = this._shakeState
    if (elapsed >= duration) { this._shakeState = null; return }
    const fade = 1 - elapsed / duration
    const s    = intensity * fade * 0.05
    const cam  = this._cam.instance
    cam.position.x += (Math.random() - 0.5) * s
    cam.position.y += (Math.random() - 0.5) * s * 0.5
    cam.position.z += (Math.random() - 0.5) * s * 0.3
    this._shakeState.elapsed++
  }

  // ─── Loop ────────────────────────────────────────────────────────────────

  update() {
    // Restaure le damp AfterimagePass après N cycles (s'exécute avant le rendu)
    if (this._afterimageResetCountdown > 0) {
      this._afterimageResetCountdown--
      if (this._afterimageResetCountdown === 0 && this._renderer?.afterimagePass) {
        this._renderer.afterimagePass.uniforms['damp'].value = this._afterimageTargetDamp
      }
    }

    if (!this._mixer || !this._isPlaying) return

    const delta = this.experience.time.delta / 1000
    this._mixer.update(delta)

    if (this._activeCameraName) {
      this._applyCamera(this._activeCameraName)
      if (this._fovOverride !== null) {
        this._cam.instance.fov = this._fovOverride
        this._cam.instance.updateProjectionMatrix()
      }
    }
    this._applyShake()

    const newFrame = Math.round(this._mixer.time * this._fps)
    if (newFrame === this._currentFrame) return

    this._currentFrame = newFrame
    this.trigger('frame_change', this._currentFrame)

    // Déclencher les events ponctuels au frame courant
    for (const event of this._config?.events ?? []) {
      if (event.frame === this._currentFrame && !this._triggeredIds.has(event.id)) {
        this._triggeredIds.add(event.id)
        this._fireEvent(event)
      }
    }

    // Avancer les transitions en cours (ignore ceux qui viennent d'être ajoutés)
    this._tickActiveTransitions(this._currentFrame)

    if (this._currentFrame >= this._totalFrames) {
      this._isPlaying = false
      this.trigger('ended')
    }
  }

  resize() {}

  dispose() {
    this._mixer?.stopAllAction()
    this._renderer?.disableEffect('all')
    this._activeTransitions.clear()
    this._cam.autoUpdate       = true
    this._cam.controls.enabled = true
    if (this._model) {
      this._model.traverse(child => {
        child.geometry?.dispose()
        const mats = child.material
          ? (Array.isArray(child.material) ? child.material : [child.material])
          : []
        mats.forEach(m => m.dispose?.())
      })
      this._model.removeFromParent()
    }
    this._lutCache.clear()
  }
}
