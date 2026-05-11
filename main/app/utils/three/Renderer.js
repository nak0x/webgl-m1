/**
 * Renderer — WebGLRenderer + EffectComposer
 *
 * Pipeline complet :
 *   RenderPass → SSAOPass → BokehPass → OutlinePass → UnrealBloomPass
 *   → AfterimagePass → ACESShaderPass → LUTPass → VignettePass
 *   → RGBShiftPass → FilmPass → OutputPass
 *
 * Toutes les nouvelles passes démarrent avec enabled = false.
 * Utiliser les méthodes setXxx() pour les activer depuis CinematicPlayer.
 * disableEffect('all') remet tout à false.
 */
import * as THREE                       from 'three'
import { RoomEnvironment }              from 'three/addons/environments/RoomEnvironment.js'
import { EffectComposer }               from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass }                   from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass }                   from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass }                   from 'three/addons/postprocessing/OutputPass.js'
import { OutlinePass }                  from 'three/addons/postprocessing/OutlinePass.js'
import { SSAOPass }                     from 'three/addons/postprocessing/SSAOPass.js'
import { BokehPass }                    from 'three/addons/postprocessing/BokehPass.js'
import { UnrealBloomPass }              from 'three/addons/postprocessing/UnrealBloomPass.js'
import { AfterimagePass }               from 'three/addons/postprocessing/AfterimagePass.js'
import { LUTPass }                      from 'three/addons/postprocessing/LUTPass.js'
import { ACESFilmicToneMappingShader }  from 'three/addons/shaders/ACESFilmicToneMappingShader.js'
import { VignetteShader }               from 'three/addons/shaders/VignetteShader.js'
import { RGBShiftShader }               from 'three/addons/shaders/RGBShiftShader.js'
import { FilmShader }                   from 'three/addons/shaders/FilmShader.js'

export default class Renderer {
  constructor(experience) {
    this.experience = experience
    this.sizes  = experience.sizes
    this.scene  = experience.scene
    this.camera = experience.camera
    this.canvas = experience.canvas

    this._setInstance()
    this._setComposer()
  }

  // ── Initialisation ────────────────────────────────────────────────────────

  _setInstance() {
    const { sizes } = this

    this.instance = new THREE.WebGLRenderer({
      antialias:       sizes.pixelRatio < 2,
      canvas:          this.canvas,
      powerPreference: 'high-performance',
    })
    this.instance.setPixelRatio(sizes.pixelRatio)
    this.instance.setSize(sizes.width, sizes.height)
    this.instance.outputColorSpace  = THREE.SRGBColorSpace
    this.instance.shadowMap.enabled = true
    this.instance.shadowMap.type    = THREE.PCFShadowMap
    this.instance.toneMapping       = THREE.NoToneMapping

    const pmrem = new THREE.PMREMGenerator(this.instance)
    pmrem.compileEquirectangularShader()
    this.scene.environment = pmrem.fromScene(new RoomEnvironment()).texture
    pmrem.dispose()
  }

  _setComposer() {
    const { sizes, scene, camera } = this

    this.composer = new EffectComposer(this.instance)

    // 1. Rendu de la scène
    this.renderPass = new RenderPass(scene, camera.instance)
    this.composer.addPass(this.renderPass)

    // 2. SSAO — avant tout pass colorimétrique, accède au depth buffer
    this.ssaoPass = new SSAOPass(scene, camera.instance, sizes.width, sizes.height)
    this.ssaoPass.kernelRadius = 8
    this.ssaoPass.minDistance  = 0.005
    this.ssaoPass.maxDistance  = 0.1
    this.ssaoPass.enabled      = false
    this.composer.addPass(this.ssaoPass)

    // 3. DOF — accède au depth buffer
    this.bokehPass = new BokehPass(scene, camera.instance, {
      focus:    5.0,
      aperture: 0.025,
      maxblur:  0.01,
    })
    this.bokehPass.enabled = false
    this.composer.addPass(this.bokehPass)

    // 4. Outline — blanc, AdditiveBlending (ne peut pas être noir)
    this.outlinePass = new OutlinePass(
      new THREE.Vector2(sizes.width, sizes.height),
      scene,
      camera.instance,
    )
    this.outlinePass.edgeStrength  = 4
    this.outlinePass.edgeThickness = 1
    this.outlinePass.edgeGlow      = 0
    this.outlinePass.visibleEdgeColor.set('#ffffff')
    this.outlinePass.hiddenEdgeColor.set('#ffffff')
    this.composer.addPass(this.outlinePass)

    // 5. Bloom
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(sizes.width, sizes.height),
      1.5, 0.4, 0.85,
    )
    this.bloomPass.enabled = false
    this.composer.addPass(this.bloomPass)

    // 6. Motion blur (accumulation)
    this.afterimagePass = new AfterimagePass(0.96)
    this.afterimagePass.enabled = false
    this.composer.addPass(this.afterimagePass)

    // 7. ACES Filmic tone mapping + exposition EV -1.64
    this.acesPass = new ShaderPass(ACESFilmicToneMappingShader)
    this.acesPass.uniforms['exposure'].value = Math.pow(2, -1.64)
    this.composer.addPass(this.acesPass)

    // 8. LUT — opère sur valeurs déjà tone-mappées
    this.lutPass = new LUTPass()
    this.lutPass.intensity = 1.0
    this.lutPass.enabled   = false
    this.composer.addPass(this.lutPass)

    // 9. Vignette WebGL
    this.vignettePass = new ShaderPass(VignetteShader)
    this.vignettePass.uniforms['offset'].value   = 0.95
    this.vignettePass.uniforms['darkness'].value = 1.6
    this.vignettePass.enabled = false
    this.composer.addPass(this.vignettePass)

    // 10. Aberration chromatique
    this.rgbShiftPass = new ShaderPass(RGBShiftShader)
    this.rgbShiftPass.uniforms['amount'].value = 0.003
    this.rgbShiftPass.enabled = false
    this.composer.addPass(this.rgbShiftPass)

    // 11. Film grain
    this.filmPass = new ShaderPass(FilmShader)
    this.filmPass.uniforms['intensity'].value = 0.35
    this.filmPass.uniforms['grayscale'].value = false
    this.filmPass.enabled = false
    this.composer.addPass(this.filmPass)

    // 12. Conversion linéaire → sRGB (toujours en dernier)
    this.composer.addPass(new OutputPass())
  }

  // ── API publique effets ───────────────────────────────────────────────────

  setBloom({ strength, radius, threshold } = {}) {
    this.bloomPass.enabled = true
    if (strength  !== undefined) this.bloomPass.strength  = strength
    if (radius    !== undefined) this.bloomPass.radius    = radius
    if (threshold !== undefined) this.bloomPass.threshold = threshold
  }

  setDof({ focus, aperture, maxblur } = {}) {
    this.bokehPass.enabled = true
    const u = this.bokehPass.uniforms
    if (focus    !== undefined) u['focus'].value    = focus
    if (aperture !== undefined) u['aperture'].value = aperture
    if (maxblur  !== undefined) u['maxblur'].value  = maxblur
  }

  setSsao({ radius, minDistance, maxDistance } = {}) {
    this.ssaoPass.enabled = true
    if (radius      !== undefined) this.ssaoPass.kernelRadius = radius
    if (minDistance !== undefined) this.ssaoPass.minDistance  = minDistance
    if (maxDistance !== undefined) this.ssaoPass.maxDistance  = maxDistance
  }

  setMotionBlur({ damp } = {}) {
    this.afterimagePass.enabled = true
    if (damp !== undefined) this.afterimagePass.uniforms['damp'].value = damp
  }

  setVignette({ offset, darkness } = {}) {
    this.vignettePass.enabled = true
    if (offset   !== undefined) this.vignettePass.uniforms['offset'].value   = offset
    if (darkness !== undefined) this.vignettePass.uniforms['darkness'].value = darkness
  }

  setChromaticAberration({ amount } = {}) {
    this.rgbShiftPass.enabled = true
    if (amount !== undefined) this.rgbShiftPass.uniforms['amount'].value = amount
  }

  setFilmGrain({ intensity, grayscale } = {}) {
    this.filmPass.enabled = true
    if (intensity !== undefined) this.filmPass.uniforms['intensity'].value = intensity
    if (grayscale !== undefined) this.filmPass.uniforms['grayscale'].value = !!grayscale
  }

  /** ev en stops EV, converti en linéaire : Math.pow(2, ev) */
  setExposure({ ev } = {}) {
    if (ev !== undefined) this.acesPass.uniforms['exposure'].value = Math.pow(2, ev)
  }

  setLut({ texture3D, intensity = 1.0 } = {}) {
    if (!texture3D) return
    this.lutPass.lut       = texture3D
    this.lutPass.intensity = intensity
    this.lutPass.enabled   = true
  }

  /**
   * Désactive une ou toutes les passes d'effet.
   * @param {'bloom'|'dof'|'ssao'|'motionBlur'|'vignette'|'chromaticAberration'|'filmGrain'|'lut'|'all'} name
   */
  disableEffect(name) {
    const map = {
      bloom:               this.bloomPass,
      dof:                 this.bokehPass,
      ssao:                this.ssaoPass,
      motionBlur:          this.afterimagePass,
      vignetteGl:          this.vignettePass,
      chromaticAberration: this.rgbShiftPass,
      filmGrain:           this.filmPass,
      lut:                 this.lutPass,
    }
    if (name === 'all') {
      Object.values(map).forEach(p => { if (p) p.enabled = false })
    } else if (map[name]) {
      map[name].enabled = false
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Appelé par Experience._resize() */
  resize() {
    const { width, height, pixelRatio } = this.sizes
    this.instance.setSize(width, height)
    this.instance.setPixelRatio(pixelRatio)
    this.composer.setSize(width, height)
    this.outlinePass.resolution.set(width, height)
  }

  /** Appelé par Experience._update() */
  update() {
    this.renderPass.camera = this.camera.instance
    if (this.filmPass.enabled) {
      this.filmPass.uniforms['time'].value += 0.016
    }
    this.composer.render()
  }

  dispose() {
    this.composer.dispose()
    this.instance.dispose()
  }
}
