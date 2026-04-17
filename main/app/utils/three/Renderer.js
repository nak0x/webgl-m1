/**
 * Renderer — WebGLRenderer + EffectComposer (ACES + sRGB)
 *
 * Pipeline : RenderPass → OutlinePass → ACESFilmicToneMappingShader → OutputPass
 * OutlinePass.visibleEdgeColor = blanc (#ffffff) — AdditiveBlending empêche le noir.
 * Exposé via this.outlinePass pour que CrosshairTarget puisse écrire selectedObjects.
 */
import * as THREE             from 'three'
import { RoomEnvironment }    from 'three/addons/environments/RoomEnvironment.js'
import { EffectComposer }     from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass }         from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass }         from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass }         from 'three/addons/postprocessing/OutputPass.js'
import { OutlinePass }        from 'three/addons/postprocessing/OutlinePass.js'
import { ACESFilmicToneMappingShader } from 'three/addons/shaders/ACESFilmicToneMappingShader.js'

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

    // Tone mapping géré par le ShaderPass ACES dans le composer
    this.instance.toneMapping = THREE.NoToneMapping

    // Environment Neutral
    const pmrem = new THREE.PMREMGenerator(this.instance)
    pmrem.compileEquirectangularShader()
    this.scene.environment = pmrem.fromScene(new RoomEnvironment()).texture
    pmrem.dispose()
  }

  _setComposer() {
    const { sizes, scene, camera } = this

    this.composer = new EffectComposer(this.instance)

    // 1. Rendu de la scène (linéaire, sans tone mapping)
    this.renderPass = new RenderPass(scene, camera.instance)
    this.composer.addPass(this.renderPass)

    // 2. Outline (blanc — AdditiveBlending empêche le noir pur)
    this.outlinePass = new OutlinePass(
      new THREE.Vector2(sizes.width, sizes.height),
      scene,
      camera.instance,
    )
    this.outlinePass.edgeStrength    = 4
    this.outlinePass.edgeThickness   = 1
    this.outlinePass.edgeGlow        = 0
    this.outlinePass.visibleEdgeColor.set('#ffffff')
    this.outlinePass.hiddenEdgeColor.set('#ffffff')
    this.composer.addPass(this.outlinePass)

    // 3. ACES Filmic + exposure EV -1.64
    this._acesPass = new ShaderPass(ACESFilmicToneMappingShader)
    this._acesPass.uniforms.exposure.value = Math.pow(2, -1.64)
    this.composer.addPass(this._acesPass)

    // 4. Conversion linéaire → sRGB
    this.composer.addPass(new OutputPass())
  }

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
    this.composer.render()
  }

  dispose() {
    this.composer.dispose()
    this.instance.dispose()
  }
}
