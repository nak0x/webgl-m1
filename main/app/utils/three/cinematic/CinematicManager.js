import * as THREE from '/lib/three.js'
import EventEmitter from '../EventEmitter.js'

/**
 * CinematicManager — lecture de vidéo pre-rendue en overlay Three.js.
 *
 * Rend une VideoTexture sur un plane orthographique après le composer,
 * sans effacer le framebuffer (autoClear = false pendant son render).
 *
 * Évènements émis :
 *   start   — { duration }   vidéo prête et lancée
 *   end     — {}             vidéo terminée ou skippée
 *   pause   — {}
 *   resume  — {}
 *   progress — { current, total }   toutes les ~100ms
 *
 * Usage depuis un World :
 *   experience.cinematic.on('start', () => fps.enabled = false)
 *   experience.cinematic.on('end',   () => fps.enabled = true)
 *   experience.cinematic.play('/videos/intro.mp4')
 */
export default class CinematicManager extends EventEmitter {
  constructor(experience) {
    super()
    this.experience = experience

    this._active   = false
    this._paused   = false
    this._video    = null
    this._texture  = null
    this._material = null
    this._mesh     = null
    this._bgMesh   = null

    this._orthoScene  = new THREE.Scene()
    this._orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    this._progressTimer = null
  }

  // ── Public API ────────────────────────────────────────────────────────────

  get isActive() { return this._active }
  get isPaused() { return this._paused }

  play(url) {
    this._cleanupVideo()

    const video = document.createElement('video')
    video.src         = url
    video.crossOrigin = 'anonymous'
    video.playsInline = true
    video.loop        = false
    video.muted       = false
    this._video = video

    const texture = new THREE.VideoTexture(video)
    texture.colorSpace = THREE.SRGBColorSpace
    this._texture = texture

    this._bgMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false })
    )
    this._bgMesh.renderOrder = 0
    this._orthoScene.add(this._bgMesh)

    this._material = new THREE.MeshBasicMaterial({ map: texture, depthTest: false })
    this._mesh     = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this._material)
    this._mesh.renderOrder = 1
    this._orthoScene.add(this._mesh)

    video.addEventListener('ended', () => this._finish())
    video.addEventListener('loadedmetadata', () => {
      this._updatePlaneScale()
      this._active = true
      this.trigger('start', { duration: video.duration })
    })

    video.play().catch(() => {})
    this._paused = false

    this._progressTimer = setInterval(() => {
      if (!this._video) return
      this.trigger('progress', { current: this._video.currentTime, total: this._video.duration || 0 })
    }, 100)
  }

  pause() {
    if (!this._active || this._paused) return
    this._video?.pause()
    this._paused = true
    this.trigger('pause')
  }

  resume() {
    if (!this._active || !this._paused) return
    this._video?.play().catch(() => {})
    this._paused = false
    this.trigger('resume')
  }

  skip() {
    if (!this._active) return
    this._finish()
  }

  seek(seconds) {
    if (!this._video) return
    this._video.currentTime = Math.max(0, Math.min(seconds, this._video.duration || 0))
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  /** Appelé par Renderer.update() après composer.render(). */
  render(renderer) {
    if (!this._active || !this._texture) return
    this._texture.needsUpdate = true
    renderer.autoClear = false
    renderer.render(this._orthoScene, this._orthoCamera)
    renderer.autoClear = true
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  _finish() {
    this.trigger('end')
    this._cleanupVideo()
  }

  _updatePlaneScale() {
    if (!this._mesh || !this._video) return
    const { videoWidth, videoHeight } = this._video
    if (!videoWidth || !videoHeight) return

    const el = this.experience.renderer.instance.domElement
    const screenAR = el.width / el.height
    const videoAR  = videoWidth / videoHeight

    if (videoAR > screenAR) {
      this._mesh.scale.set(1, screenAR / videoAR, 1)
    } else {
      this._mesh.scale.set(videoAR / screenAR, 1, 1)
    }
  }

  _cleanupVideo() {
    clearInterval(this._progressTimer)
    this._progressTimer = null
    this._active = false
    this._paused = false

    if (this._video) {
      this._video.pause()
      this._video.removeAttribute('src')
      this._video.load()
      this._video = null
    }
    if (this._bgMesh) {
      this._orthoScene.remove(this._bgMesh)
      this._bgMesh.geometry.dispose()
      this._bgMesh.material.dispose()
      this._bgMesh = null
    }
    if (this._mesh) {
      this._orthoScene.remove(this._mesh)
      this._mesh.geometry.dispose()
      this._mesh = null
    }
    if (this._material) {
      this._material.dispose()
      this._material = null
    }
    if (this._texture) {
      this._texture.dispose()
      this._texture = null
    }
  }

  resize() {
    this._updatePlaneScale()
  }

  dispose() {
    this._cleanupVideo()
  }
}
