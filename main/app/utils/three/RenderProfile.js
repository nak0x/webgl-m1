import * as THREE from '/lib/three.js'

/**
 * RenderProfile — profil de rendu unifié partagé entre toutes les scènes.
 *
 * Fournit :
 *   - `material` : MeshPhongMaterial blanc partagé (style SUPERHOT)
 *   - `apply(scene)` : remplace les materials de tous les meshes visibles
 *   - `restore(scene)` : restaure les materials originaux
 *   - Chargement automatique depuis `/settings/rendering.json`
 *   - `registerAtmosphere({ key, file, getSettings, applySettings, setupDebug })`
 *     pour qu'un World branche son ciel/lumières sur l'export unifié
 *   - Post-effects actifs par défaut : SMAA, Bloom, Color Grading, SSAO
 *   - Dossier lil-gui "Rendering" accessible si debug.active
 *
 * Accessible via `experience.renderProfile` depuis n'importe quel World.
 */
export default class RenderProfile {
  constructor(experience) {
    this.experience = experience

    this.material = new THREE.MeshPhongMaterial({
      color:     0xffffff,
      shininess: 12,
      specular:  new THREE.Color(0x1a1a1a),
      side:      THREE.DoubleSide,
    })

    this._atmosphere     = null   // { key, file, getSettings, applySettings }
    this._atmosphereGui  = null   // lil-gui folder owned by the active atmosphere

    this._initEffects()
    this._loadSettings()

    if (experience.debug.active) this._setupDebug()
  }

  /**
   * Traverse la scène et remplace tous les materials de mesh visibles
   * par le material blanc partagé. Stocke l'original sur child._profileMat.
   * Idempotent : n'applique pas deux fois sur le même mesh.
   */
  apply(scene) {
    scene.traverse(child => {
      if (!child.isMesh || child._profileMat !== undefined) return
      const mat = Array.isArray(child.material) ? child.material[0] : child.material
      if (mat && mat.visible === false) return  // skip invisible collision meshes
      child._profileMat = child.material
      child.material    = this.material
    })
  }

  /**
   * Restaure les materials originaux sur les meshes précédemment modifiés
   * par apply(). Appeler dans World.dispose() si le World a appliqué le profil.
   */
  restore(scene) {
    scene.traverse(child => {
      if (!child.isMesh || child._profileMat === undefined) return
      child.material = child._profileMat
      delete child._profileMat
    })
  }

  // ── Atmosphere registration (per-scene) ───────────────────────────────────

  /**
   * Branche le ciel/fog/lumières d'un World sur l'export unifié.
   *
   * @param {Object}   opts
   * @param {string}   opts.key            — identifiant scène (ex: 'city')
   * @param {string}   opts.file           — nom du fichier dans /settings/
   * @param {Function} opts.getSettings    — () => Object  pour l'export
   * @param {Function} opts.applySettings  — (Object) => void  pour l'import
   * @param {Function} [opts.setupDebug]   — (folder, gui) => void  pour brancher les contrôleurs lil-gui
   *                                          (le folder "Atmosphere" est créé et nettoyé par RenderProfile)
   */
  registerAtmosphere({ key, file, getSettings, applySettings, setupDebug }) {
    this.unregisterAtmosphere()
    this._atmosphere = { key, file, getSettings, applySettings }

    if (this.experience.debug.active && setupDebug) {
      this._atmosphereGui = this.experience.debug.gui.addFolder('Atmosphere')
      this._atmosphereGui.close()
      setupDebug(this._atmosphereGui, this.experience.debug.gui)
    }

    this._loadAtmosphereSettings()
  }

  unregisterAtmosphere() {
    this._atmosphere = null
    this._atmosphereGui?.destroy()
    this._atmosphereGui = null
  }

  async _loadAtmosphereSettings() {
    if (!this._atmosphere) return
    const target = this._atmosphere
    try {
      const res = await fetch('/settings/' + target.file)
      if (!res.ok) return
      const json = await res.json()
      // Scene may have changed between fetch start and resolution.
      if (this._atmosphere === target) target.applySettings(json)
    } catch {
      // file absent or malformed — defaults remain
    }
  }

  // ── Settings persistence ──────────────────────────────────────────────────

  async _loadSettings() {
    try {
      const res = await fetch('/settings/rendering.json')
      if (!res.ok) return
      this._applySettings(await res.json())
    } catch {
      // file absent or malformed — defaults remain
    }
  }

  _applySettings(s) {
    const { renderer } = this.experience

    if (s.aa) {
      renderer.setSMAA({ enabled: s.aa.mode === 'SMAA' })
      renderer.setTaa({ enabled: s.aa.mode === 'TAA', sampleLevel: s.aa.taaSamples, accumulate: s.aa.taaAccumulate })
    }
    if (s.bloom) {
      renderer.setBloom({ strength: s.bloom.strength, radius: s.bloom.radius, threshold: s.bloom.threshold })
      renderer.bloomPass.enabled = s.bloom.enabled
    }
    if (s.colorGrading) {
      renderer.setColorGrading({
        brightness: s.colorGrading.brightness, contrast:    s.colorGrading.contrast,
        saturation: s.colorGrading.saturation, temperature: s.colorGrading.temperature,
        gamma:      s.colorGrading.gamma,      gain:        s.colorGrading.gain,
      })
      renderer.colorGradingPass.enabled = s.colorGrading.enabled
    }
    if (s.ssao) {
      renderer.setSsao({
        radius: s.ssao.radius, minDistance: s.ssao.minDist, maxDistance: s.ssao.maxDist,
        kernelSize: s.ssao.kernelSize,
      })
      renderer.ssaoPass.enabled = s.ssao.enabled
      if (s.ssao.aoStrength !== undefined) {
        renderer.aoColorPass.uniforms['aoStrength'].value = s.ssao.aoStrength
        renderer.aoColorPass.enabled = s.ssao.aoStrength > 0
      }
      if (s.ssao.aoColor) renderer.aoColorPass.uniforms['aoColor'].value.set(s.ssao.aoColor)
    }
    if (s.edge) {
      renderer.setEdge({ edgeStrength: s.edge.strength, edgeScale: s.edge.scale, edgeColor: s.edge.color })
      renderer.edgePass.enabled = s.edge.enabled
    }
    if (s.material) {
      if (s.material.color)                  this.material.color.set(s.material.color)
      if (s.material.shininess !== undefined) this.material.shininess = s.material.shininess
      if (s.material.specular)               this.material.specular.set(s.material.specular)
    }
    if (s.exposureEv !== undefined) {
      renderer.acesPass.uniforms['exposure'].value = Math.pow(2, s.exposureEv)
    }
  }

  // ── Effets par défaut ─────────────────────────────────────────────────────

  _initEffects() {
    const { renderer } = this.experience
    renderer.setSMAA({ enabled: true })
    renderer.setBloom({ strength: 0.25, radius: 0.5, threshold: 0.88 })
    renderer.setColorGrading({ contrast: 0.08, saturation: 0.82, gamma: 1.05, gain: 1.0 })
    renderer.setSsao({ radius: 0.25, minDistance: 0.001, maxDistance: 0.04, kernelSize: 64 })
  }

  // ── Debug GUI ─────────────────────────────────────────────────────────────

  _setupDebug() {
    const { debug, renderer } = this.experience
    const root = debug.gui.addFolder('Rendering')

    // ── Antialiasing ──────────────────────────────────────────────────────
    const aaF     = root.addFolder('Antialiasing')
    const aaState = { mode: 'SMAA' }
    aaF.add(aaState, 'mode', ['None', 'SMAA', 'TAA']).name('mode').onChange(v => {
      renderer.setSMAA({ enabled: v === 'SMAA' })
      renderer.setTaa({  enabled: v === 'TAA'  })
    })
    aaF.add(renderer.taaPass, 'sampleLevel', 0, 5, 1).name('TAA samples')
    aaF.add(renderer.taaPass, 'accumulate').name('TAA accumulate')

    // ── Bloom ─────────────────────────────────────────────────────────────
    const bloomF = root.addFolder('Bloom')
    bloomF.add(renderer.bloomPass, 'enabled')
    bloomF.add(renderer.bloomPass, 'strength',  0, 3,   0.01)
    bloomF.add(renderer.bloomPass, 'radius',    0, 1,   0.01)
    bloomF.add(renderer.bloomPass, 'threshold', 0, 1,   0.01)

    // ── Color Grading ─────────────────────────────────────────────────────
    const cgU = renderer.colorGradingPass.uniforms
    const cgF = root.addFolder('Color Grading')
    cgF.add(renderer.colorGradingPass, 'enabled')
    cgF.add(cgU.brightness,  'value', -1,   1,   0.01).name('brightness')
    cgF.add(cgU.contrast,    'value', -1,   1,   0.01).name('contrast')
    cgF.add(cgU.saturation,  'value',  0,   2,   0.01).name('saturation')
    cgF.add(cgU.temperature, 'value', -1,   1,   0.01).name('temperature')
    cgF.add(cgU.gamma,       'value',  0.1, 3,   0.01).name('gamma')
    cgF.add(cgU.gain,        'value',  0,   2,   0.01).name('gain')

    // ── SSAO ──────────────────────────────────────────────────────────────
    const ssaoF        = root.addFolder('SSAO')
    const aoColorProxy = { color: '#' + renderer.aoColorPass.uniforms['aoColor'].value.getHexString() }
    const qualityProxy = { samples: renderer.ssaoPass.kernelSize }

    ssaoF.add(renderer.ssaoPass, 'enabled')
    ssaoF.add(qualityProxy, 'samples', [16, 32, 64, 128]).name('quality (samples)').onChange(v => {
      renderer.setSsao({ kernelSize: v })
    })
    ssaoF.add(renderer.ssaoPass, 'kernelRadius', 0.01,   2,    0.01  ).name('radius')
    ssaoF.add(renderer.ssaoPass, 'minDistance',  0.0001, 0.05, 0.0001).name('min dist')
    ssaoF.add(renderer.ssaoPass, 'maxDistance',  0.005,  0.5,  0.001 ).name('max dist')
    ssaoF.add(renderer.aoColorPass.uniforms['aoStrength'], 'value', 0, 1, 0.01).name('tint strength').onChange(v => {
      renderer.aoColorPass.enabled = v > 0
    })
    ssaoF.addColor(aoColorProxy, 'color').name('tint color').onChange(v => {
      renderer.aoColorPass.uniforms['aoColor'].value.set(v)
    })

    // debug output — lets you isolate the raw AO mask for easier tuning
    const outputProxy = { view: 'Default' }
    const outputMap   = { Default: 0, 'SSAO only': 1, 'Blur only': 2, Depth: 3, Normals: 4 }
    ssaoF.add(outputProxy, 'view', Object.keys(outputMap)).name('debug view').onChange(v => {
      renderer.ssaoPass.output = outputMap[v]
    })

    // ── Edge detection ────────────────────────────────────────────────────
    const edgeU          = renderer.edgePass.uniforms
    const edgeF          = root.addFolder('Edge')
    const edgeColorProxy = { color: '#' + edgeU.edgeColor.value.getHexString() }
    edgeF.add(renderer.edgePass, 'enabled')
    edgeF.add(edgeU.edgeStrength, 'value', 0,   3, 0.01).name('strength')
    edgeF.add(edgeU.edgeScale,    'value', 0.5, 6, 0.1 ).name('scale')
    edgeF.addColor(edgeColorProxy, 'color').name('color').onChange(v => edgeU.edgeColor.value.set(v))

    // ── White material ────────────────────────────────────────────────────
    const matF      = root.addFolder('Material')
    const matProxy  = { color: '#' + this.material.color.getHexString() }
    const specProxy = { color: '#' + this.material.specular.getHexString() }
    matF.addColor(matProxy,  'color').name('base color').onChange(v => this.material.color.set(v))
    matF.addColor(specProxy, 'color').name('specular').onChange(v => this.material.specular.set(v))
    matF.add(this.material, 'shininess', 0, 100, 1)

    // ── Exposure (ACES) ───────────────────────────────────────────────────
    const expProxy = { ev: Math.log2(renderer.acesPass.uniforms['exposure'].value) }
    root.add(expProxy, 'ev', -4, 4, 0.05).name('exposure EV').onChange(v => {
      renderer.acesPass.uniforms['exposure'].value = Math.pow(2, v)
    })

    // ── Export ────────────────────────────────────────────────────────────
    // Saves rendering.json + atmosphere file (if a world has registered one) in one click.
    root.add({ export: () => this._exportSettings() }, 'export').name('Export settings ↓')

    this._debugFolder = root
  }

  _exportSettings() {
    const { renderer } = this.experience
    const cgU = renderer.colorGradingPass.uniforms
    const eu  = renderer.edgePass.uniforms
    const s   = {
      aa: {
        mode:          renderer.smaaPass.enabled ? 'SMAA' : (renderer.taaPass.enabled ? 'TAA' : 'None'),
        taaSamples:    renderer.taaPass.sampleLevel,
        taaAccumulate: renderer.taaPass.accumulate,
      },
      bloom: {
        enabled:   renderer.bloomPass.enabled,
        strength:  renderer.bloomPass.strength,
        radius:    renderer.bloomPass.radius,
        threshold: renderer.bloomPass.threshold,
      },
      colorGrading: {
        enabled:     renderer.colorGradingPass.enabled,
        brightness:  cgU.brightness.value,
        contrast:    cgU.contrast.value,
        saturation:  cgU.saturation.value,
        temperature: cgU.temperature.value,
        gamma:       cgU.gamma.value,
        gain:        cgU.gain.value,
      },
      ssao: {
        enabled:    renderer.ssaoPass.enabled,
        kernelSize: renderer.ssaoPass.kernelSize,
        radius:     renderer.ssaoPass.kernelRadius,
        minDist:    renderer.ssaoPass.minDistance,
        maxDist:    renderer.ssaoPass.maxDistance,
        aoStrength: renderer.aoColorPass.uniforms['aoStrength'].value,
        aoColor:    '#' + renderer.aoColorPass.uniforms['aoColor'].value.getHexString(),
      },
      edge: {
        enabled:  renderer.edgePass.enabled,
        strength: eu.edgeStrength.value,
        scale:    eu.edgeScale.value,
        color:    '#' + eu.edgeColor.value.getHexString(),
      },
      material: {
        color:     '#' + this.material.color.getHexString(),
        shininess: this.material.shininess,
        specular:  '#' + this.material.specular.getHexString(),
      },
      exposureEv: Math.log2(renderer.acesPass.uniforms['exposure'].value),
    }
    this._download(JSON.stringify(s, null, 2), 'rendering.json')

    if (this._atmosphere) {
      this._download(
        JSON.stringify(this._atmosphere.getSettings(), null, 2),
        this._atmosphere.file,
      )
    }
  }

  _download(text, filename) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const a   = Object.assign(document.createElement('a'), { href: url, download: filename })
    a.click()
    URL.revokeObjectURL(url)
  }

  dispose() {
    this.material.dispose()
    this.unregisterAtmosphere()
    this._debugFolder?.destroy()
  }
}
