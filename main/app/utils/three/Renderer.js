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
import * as THREE                       from '/lib/three.js'
import { RoomEnvironment }              from '/lib/addons/environments/RoomEnvironment.js'
import { EffectComposer }               from '/lib/addons/postprocessing/EffectComposer.js'
import { RenderPass }                   from '/lib/addons/postprocessing/RenderPass.js'
import { ShaderPass }                   from '/lib/addons/postprocessing/ShaderPass.js'
import { OutputPass }                   from '/lib/addons/postprocessing/OutputPass.js'
import { OutlinePass }                  from '/lib/addons/postprocessing/OutlinePass.js'
import { SSAOPass }                     from '/lib/addons/postprocessing/SSAOPass.js'
import { BokehPass }                    from '/lib/addons/postprocessing/BokehPass.js'
import { UnrealBloomPass }              from '/lib/addons/postprocessing/UnrealBloomPass.js'
import { AfterimagePass }               from '/lib/addons/postprocessing/AfterimagePass.js'
import { LUTPass }                      from '/lib/addons/postprocessing/LUTPass.js'
import { ACESFilmicToneMappingShader }  from '/lib/addons/shaders/ACESFilmicToneMappingShader.js'
import { VignetteShader }               from '/lib/addons/shaders/VignetteShader.js'
import { RGBShiftShader }               from '/lib/addons/shaders/RGBShiftShader.js'
import { FilmShader }                   from '/lib/addons/shaders/FilmShader.js'
import { TAARenderPass }                from '/lib/addons/postprocessing/TAARenderPass.js'
import { SMAAPass }                     from '/lib/addons/postprocessing/SMAAPass.js'

// Depth-based edge detection — Roberts cross on linearised depth buffer.
// Responds only to geometry discontinuities (silhouettes, corners, rooftops),
// not to lighting, shadowing, or colour gradients.
const EdgeShader = {
  name: 'EdgeShader',
  uniforms: {
    tDiffuse:     { value: null },
    tDepth:       { value: null },
    resolution:   { value: new THREE.Vector2(1, 1) },
    edgeStrength: { value: 0.40 },
    edgeScale:    { value: 2.20 },
    edgeColor:    { value: new THREE.Color(0x000000) },
    cameraNear:   { value: 0.1 },
    cameraFar:    { value: 1000.0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform vec2  resolution;
    uniform float edgeStrength;
    uniform float edgeScale;
    uniform vec3  edgeColor;
    uniform float cameraNear;
    uniform float cameraFar;
    varying vec2 vUv;

    // Convert non-linear depth buffer value to [0,1] linear view-space depth.
    float linearize(float d) {
      return (2.0 * cameraNear) / (cameraFar + cameraNear - d * (cameraFar - cameraNear));
    }

    void main(){
      vec2 p = edgeScale / resolution;

      // Roberts cross — four corners of a 2×2 pixel neighbourhood
      float d00 = linearize(texture2D(tDepth, vUv).r);
      float d10 = linearize(texture2D(tDepth, vUv + vec2(p.x, 0.0)).r);
      float d01 = linearize(texture2D(tDepth, vUv + vec2(0.0, p.y)).r);
      float d11 = linearize(texture2D(tDepth, vUv + vec2(p.x, p.y)).r);

      float gx = d11 - d00;
      float gy = d01 - d10;

      // Normalise by centre depth: makes the response the same at any distance
      // (perspective naturally compresses depth differences for far objects).
      float edge = sqrt(gx * gx + gy * gy) / max(d00, 0.001);
      edge = clamp(edge * edgeStrength, 0.0, 1.0);

      vec3 col = texture2D(tDiffuse, vUv).rgb;
      gl_FragColor = vec4(mix(col, edgeColor, edge), 1.0);
    }
  `,
}

// Brightness / Contrast / Saturation / Temperature / Gamma / Gain — operates on LDR after tone-mapping.
const ColorGradingShader = {
  name: 'ColorGradingShader',
  uniforms: {
    tDiffuse:    { value: null },
    brightness:  { value: 0.0 },
    contrast:    { value: 0.0 },
    saturation:  { value: 1.0 },
    temperature: { value: 0.0 },
    gamma:       { value: 1.0 },
    gain:        { value: 1.0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float brightness;
    uniform float contrast;
    uniform float saturation;
    uniform float temperature;
    uniform float gamma;
    uniform float gain;
    varying vec2 vUv;

    float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 col = tex.rgb;

      col += brightness;
      col  = (col - 0.5) * (1.0 + contrast) + 0.5;

      float grey = lum(col);
      col = mix(vec3(grey), col, saturation);

      col.r += temperature * 0.1;
      col.b -= temperature * 0.1;

      col  = pow(max(col, vec3(0.0)), vec3(1.0 / max(gamma, 0.001)));
      col *= gain;

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), tex.a);
    }
  `,
}

// Tints SSAO-darkened areas with a chosen color instead of plain black.
// Works on luminance: darker pixels get more tint → AO shadows gain hue.
const AOColorShader = {
  name: 'AOColorShader',
  uniforms: {
    tDiffuse:   { value: null },
    aoColor:    { value: new THREE.Color(0x000000) },
    aoStrength: { value: 0.0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec3  aoColor;
    uniform float aoStrength;
    varying vec2 vUv;

    float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }

    void main(){
      vec4 col = texture2D(tDiffuse, vUv);
      float darkness = 1.0 - lum(col.rgb);
      gl_FragColor = vec4(mix(col.rgb, aoColor, darkness * aoStrength), col.a);
    }
  `,
}

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

    // 1a. Rendu de la scène (standard)
    this.renderPass = new RenderPass(scene, camera.instance)
    this.composer.addPass(this.renderPass)

    // 1b. TAA — mutuellement exclusif avec renderPass (un seul activé à la fois)
    this.taaPass = new TAARenderPass(scene, camera.instance, 0x000000, 0)
    this.taaPass.sampleLevel = 2   // 4 jittered samples per frame
    this.taaPass.enabled     = false
    this.composer.addPass(this.taaPass)

    // 2. SSAO — avant tout pass colorimétrique, accède au depth buffer
    this.ssaoPass = new SSAOPass(scene, camera.instance, sizes.width, sizes.height, 64)
    this.ssaoPass.kernelRadius = 0.5
    this.ssaoPass.minDistance  = 0.001
    this.ssaoPass.maxDistance  = 0.05
    this.ssaoPass.enabled      = false
    this.composer.addPass(this.ssaoPass)

    // 3. AO color tint — hue-shifts SSAO-darkened areas
    this.aoColorPass = new ShaderPass(AOColorShader)
    this.aoColorPass.enabled = false
    this.composer.addPass(this.aoColorPass)

    // 4. Depth-based edge detection — needs its own depth render target so the
    //    scene depth survives the ping-pong buffer swaps of subsequent passes.
    this.edgePass = new ShaderPass(EdgeShader)
    this.edgePass.uniforms['resolution'].value.set(sizes.width, sizes.height)
    this.edgePass.enabled = false
    this.composer.addPass(this.edgePass)

    const pw = Math.floor(sizes.width * sizes.pixelRatio)
    const ph = Math.floor(sizes.height * sizes.pixelRatio)
    this.depthTarget = new THREE.WebGLRenderTarget(pw, ph, {
      minFilter:       THREE.NearestFilter,
      magFilter:       THREE.NearestFilter,
      generateMipmaps: false,
    })
    this.depthTarget.depthTexture      = new THREE.DepthTexture(pw, ph)
    this.depthTarget.depthTexture.type = THREE.UnsignedShortType

    // 4. DOF — accède au depth buffer
    this.bokehPass = new BokehPass(scene, camera.instance, {
      focus:    5.0,
      aperture: 0.025,
      maxblur:  0.01,
    })
    this.bokehPass.enabled = false
    this.composer.addPass(this.bokehPass)

    // 5. Outline — blanc, AdditiveBlending (ne peut pas être noir)
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

    // 6. Bloom
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(sizes.width, sizes.height),
      1.5, 0.4, 0.85,
    )
    this.bloomPass.enabled = false
    this.composer.addPass(this.bloomPass)

    // 7. Motion blur (accumulation)
    this.afterimagePass = new AfterimagePass(0.96)
    this.afterimagePass.enabled = false
    this.composer.addPass(this.afterimagePass)

    // 8. ACES Filmic tone mapping + exposition EV -1.64
    this.acesPass = new ShaderPass(ACESFilmicToneMappingShader)
    this.acesPass.uniforms['exposure'].value = Math.pow(2, -1.64)
    this.composer.addPass(this.acesPass)

    // 9. LUT — opère sur valeurs déjà tone-mappées
    this.lutPass = new LUTPass()
    this.lutPass.intensity = 1.0
    this.lutPass.enabled   = false
    this.composer.addPass(this.lutPass)

    // 10. Color grading — brightness / contrast / saturation / temperature / gamma / gain
    this.colorGradingPass = new ShaderPass(ColorGradingShader)
    this.colorGradingPass.enabled = false
    this.composer.addPass(this.colorGradingPass)

    // 11. SMAA — antialiasing spatial, après tone-mapping pour opérer sur LDR
    this.smaaPass = new SMAAPass(
      Math.floor(sizes.width  * sizes.pixelRatio),
      Math.floor(sizes.height * sizes.pixelRatio),
    )
    this.smaaPass.enabled = false
    this.composer.addPass(this.smaaPass)

    // 12. Vignette WebGL
    this.vignettePass = new ShaderPass(VignetteShader)
    this.vignettePass.uniforms['offset'].value   = 0.95
    this.vignettePass.uniforms['darkness'].value = 1.6
    this.vignettePass.enabled = false
    this.composer.addPass(this.vignettePass)

    // 13. Aberration chromatique
    this.rgbShiftPass = new ShaderPass(RGBShiftShader)
    this.rgbShiftPass.uniforms['amount'].value = 0.003
    this.rgbShiftPass.enabled = false
    this.composer.addPass(this.rgbShiftPass)

    // 14. Film grain
    this.filmPass = new ShaderPass(FilmShader)
    this.filmPass.uniforms['intensity'].value = 0.35
    this.filmPass.uniforms['grayscale'].value = false
    this.filmPass.enabled = false
    this.composer.addPass(this.filmPass)

    // 15. Conversion linéaire → sRGB (toujours en dernier)
    this.composer.addPass(new OutputPass())
  }

  // ── API publique effets ───────────────────────────────────────────────────

  /** Switch between TAA (scene re-rendered each frame with jitter) and standard RenderPass. */
  setTaa({ enabled, sampleLevel, accumulate } = {}) {
    this.taaPass.enabled     = !!enabled
    this.renderPass.enabled  = !enabled
    if (sampleLevel !== undefined) this.taaPass.sampleLevel = sampleLevel
    if (accumulate  !== undefined) this.taaPass.accumulate  = accumulate
  }

  /** SMAA spatial antialiasing — works independently of TAA. */
  setSMAA({ enabled } = {}) {
    this.smaaPass.enabled = !!enabled
  }

  setColorGrading({ brightness, contrast, saturation, temperature, gamma, gain } = {}) {
    this.colorGradingPass.enabled = true
    const u = this.colorGradingPass.uniforms
    if (brightness  !== undefined) u.brightness.value  = brightness
    if (contrast    !== undefined) u.contrast.value    = contrast
    if (saturation  !== undefined) u.saturation.value  = saturation
    if (temperature !== undefined) u.temperature.value = temperature
    if (gamma       !== undefined) u.gamma.value       = gamma
    if (gain        !== undefined) u.gain.value        = gain
  }

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

  setSsao({ radius, minDistance, maxDistance, kernelSize } = {}) {
    this.ssaoPass.enabled = true
    if (radius      !== undefined) this.ssaoPass.kernelRadius = radius
    if (minDistance !== undefined) this.ssaoPass.minDistance  = minDistance
    if (maxDistance !== undefined) this.ssaoPass.maxDistance  = maxDistance
    if (kernelSize  !== undefined && kernelSize !== this.ssaoPass.kernelSize) {
      this.ssaoPass.kernelSize = kernelSize
      // Clear in-place so ssaoMaterial.uniforms['kernel'].value keeps the same array ref.
      this.ssaoPass.kernel.length = 0
      this.ssaoPass._generateSampleKernel(kernelSize)
      this.ssaoPass.ssaoMaterial.defines['KERNEL_SIZE'] = kernelSize
      this.ssaoPass.ssaoMaterial.needsUpdate = true
    }
  }

  setAoColor({ color, strength } = {}) {
    this.aoColorPass.enabled = true
    if (color    !== undefined) this.aoColorPass.uniforms['aoColor'].value.set(color)
    if (strength !== undefined) this.aoColorPass.uniforms['aoStrength'].value = strength
  }

  setEdge({ edgeStrength, edgeScale, edgeColor } = {}) {
    this.edgePass.enabled = true
    const u = this.edgePass.uniforms
    if (edgeStrength !== undefined) u['edgeStrength'].value = edgeStrength
    if (edgeScale    !== undefined) u['edgeScale'].value    = edgeScale
    if (edgeColor    !== undefined) u['edgeColor'].value.set(edgeColor)
    u['resolution'].value.set(this.sizes.width, this.sizes.height)
    u['tDepth'].value     = this.depthTarget.depthTexture
    u['cameraNear'].value = this.camera.instance.near
    u['cameraFar'].value  = this.camera.instance.far
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
   * @param {'bloom'|'dof'|'ssao'|'aoColor'|'edge'|'motionBlur'|'vignette'|'chromaticAberration'|'filmGrain'|'lut'|'all'} name
   */
  disableEffect(name) {
    const map = {
      bloom:               this.bloomPass,
      dof:                 this.bokehPass,
      ssao:                this.ssaoPass,
      aoColor:             this.aoColorPass,
      edge:                this.edgePass,
      motionBlur:          this.afterimagePass,
      vignetteGl:          this.vignettePass,
      chromaticAberration: this.rgbShiftPass,
      filmGrain:           this.filmPass,
      lut:                 this.lutPass,
      colorGrading:        this.colorGradingPass,
      smaa:                this.smaaPass,
    }
    if (name === 'all') {
      Object.values(map).forEach(p => { if (p) p.enabled = false })
      this.renderPass.enabled = true
      this.taaPass.enabled    = false
    } else if (name === 'taa') {
      this.taaPass.enabled    = false
      this.renderPass.enabled = true
    } else if (map[name]) {
      map[name].enabled = false
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Appelé par Experience._resize() */
  resize() {
    const { width, height, pixelRatio } = this.sizes
    const pw = Math.floor(width * pixelRatio)
    const ph = Math.floor(height * pixelRatio)
    this.instance.setSize(width, height)
    this.instance.setPixelRatio(pixelRatio)
    this.composer.setSize(width, height)
    this.outlinePass.resolution.set(width, height)
    this.edgePass.uniforms['resolution'].value.set(width, height)
    this.depthTarget.setSize(pw, ph)
    this.smaaPass.setSize(pw, ph)
  }

  /** Appelé par Experience._update() */
  update() {
    this.renderPass.camera = this.camera.instance
    this.taaPass.camera    = this.camera.instance

    if (this.edgePass.enabled) {
      const u = this.edgePass.uniforms
      u['cameraNear'].value = this.camera.instance.near
      u['cameraFar'].value  = this.camera.instance.far
      this.instance.setRenderTarget(this.depthTarget)
      this.instance.render(this.scene, this.camera.instance)
      this.instance.setRenderTarget(null)
    }

    if (this.filmPass.enabled) {
      this.filmPass.uniforms['time'].value += 0.016
    }
    this.composer.render()
  }

  dispose() {
    this.depthTarget.dispose()
    this.composer.dispose()
    this.instance.dispose()
  }
}
