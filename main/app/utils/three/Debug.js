import GUI   from 'lil-gui'
import Stats from 'stats.js'

export default class Debug {
  constructor() {
    this.active = window.location.hash === '#debug'

    if (this.active) {
      this.gui = new GUI({ width: 320 })

      this.stats = new Stats()
      this.stats.showPanel(0)
      document.body.appendChild(this.stats.dom)

      this._setupRenderInfoPanel()
    }
  }

  _setupRenderInfoPanel() {
    const panel = document.createElement('div')
    panel.id = 'debug-render-info'
    Object.assign(panel.style, {
      position:      'fixed',
      top:           '0',
      left:          '80px',
      padding:       '6px 10px',
      font:          '11px/1.5 monospace',
      color:         '#0ff',
      background:    'rgba(0,0,0,0.7)',
      pointerEvents: 'none',
      whiteSpace:    'pre',
      zIndex:        '10000',
      borderLeft:    '2px solid #0ff',
    })
    panel.textContent = 'render info...'
    document.body.appendChild(panel)
    this.renderInfoPanel = panel
  }

  // Called from Experience after Renderer + Camera are ready.
  setupRendererDebug(renderer, camera) {
    if (!this.active) return
    this._renderer        = renderer
    this._camera          = camera
    this._savedPassStates = null
    this._passControllers = []

    const folder = this.gui.addFolder('Renderer')
    folder.open()

    // Master bypass — disables all effect passes, keeps RenderPass + OutputPass.
    const bypassState = { bypass: false }
    folder.add(bypassState, 'bypass').name('Bypass post-process').onChange(on => {
      if (on) {
        this._savedPassStates = this._snapshotPasses(renderer)
        this._setAllEffectPasses(renderer, false)
      } else if (this._savedPassStates) {
        this._restorePasses(renderer, this._savedPassStates)
        this._savedPassStates = null
      }
      this._passControllers.forEach(c => c.updateDisplay())
    })

    // Per-pass toggles — useful to isolate which pass causes a visual artefact.
    const passFolder = folder.addFolder('Passes (toggle to isolate artefacts)')
    passFolder.close()

    const PASSES = [
      ['renderPass',       'RenderPass (base)'],
      ['taaPass',          'TAA'],
      ['ssaoPass',         'SSAO'],
      ['aoColorPass',      'AO Color'],
      ['edgePass',         'Edge Detection'],
      ['bokehPass',        'DOF (Bokeh)'],
      ['outlinePass',      'Outline'],
      ['bloomPass',        'Bloom'],
      ['afterimagePass',   'Motion Blur'],
      ['acesPass',         'ACES Tone Map'],
      ['lutPass',          'LUT'],
      ['colorGradingPass', 'Color Grading'],
      ['smaaPass',         'SMAA'],
      ['vignettePass',     'Vignette'],
      ['rgbShiftPass',     'RGB Shift'],
      ['filmPass',         'Film Grain'],
    ]

    PASSES.forEach(([key, name]) => {
      const pass = renderer[key]
      if (!pass) return
      const ctrl = passFolder.add(pass, 'enabled').name(name)
      this._passControllers.push(ctrl)
    })
  }

  // ── Pass state helpers ────────────────────────────────────────────────────

  _snapshotPasses(renderer) {
    const keys = [
      'renderPass','taaPass','ssaoPass','aoColorPass','edgePass','bokehPass',
      'outlinePass','bloomPass','afterimagePass','acesPass','lutPass',
      'colorGradingPass','smaaPass','vignettePass','rgbShiftPass','filmPass',
    ]
    const snap = {}
    keys.forEach(k => { if (renderer[k]) snap[k] = renderer[k].enabled })
    return snap
  }

  _setAllEffectPasses(renderer, enabled) {
    const effects = [
      'taaPass','ssaoPass','aoColorPass','edgePass','bokehPass','outlinePass',
      'bloomPass','afterimagePass','acesPass','lutPass','colorGradingPass',
      'smaaPass','vignettePass','rgbShiftPass','filmPass',
    ]
    effects.forEach(k => { if (renderer[k]) renderer[k].enabled = enabled })
    // RenderPass must stay on when bypassing effects.
    if (!enabled) renderer.renderPass.enabled = true
  }

  _restorePasses(renderer, snap) {
    Object.entries(snap).forEach(([k, v]) => { if (renderer[k]) renderer[k].enabled = v })
  }

  // ── Per-frame info panel ──────────────────────────────────────────────────

  updateRenderInfo(renderer) {
    if (!this.renderInfoPanel || !renderer) return
    const { render, memory, programs } = renderer.info

    // Active effect passes
    let passLine = 'none'
    if (this._renderer) {
      const r = this._renderer
      const checks = [
        [r.taaPass,          'TAA'],
        [r.ssaoPass,         'SSAO'],
        [r.aoColorPass,      'AOColor'],
        [r.edgePass,         'Edge'],
        [r.bokehPass,        'DOF'],
        [r.outlinePass,      'Outline'],
        [r.bloomPass,        'Bloom'],
        [r.afterimagePass,   'MotionBlur'],
        [r.acesPass,         'ACES'],
        [r.lutPass,          'LUT'],
        [r.colorGradingPass, 'ColorGrading'],
        [r.smaaPass,         'SMAA'],
        [r.vignettePass,     'Vignette'],
        [r.rgbShiftPass,     'RGBShift'],
        [r.filmPass,         'Film'],
      ]
      const active = checks.filter(([p]) => p?.enabled).map(([, n]) => n)
      passLine = active.length ? active.join(' | ') : 'none'
    }

    // Camera stats
    let camLine = ''
    if (this._camera?.instance) {
      const cam = this._camera.instance
      const p   = cam.position
      camLine =
        `cam pos : ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}\n` +
        `cam fov : ${cam.fov}   near: ${cam.near}   far: ${cam.far}\n`
    }

    // Renderer dimensions + pixel ratio
    let sizeLine = ''
    if (this._renderer) {
      const s  = this._renderer.sizes
      const pr = this._renderer.instance.getPixelRatio()
      sizeLine = `res     : ${s.width}x${s.height}  dpr: ${pr}\n`
    }

    // JS heap (Chrome only)
    let memLine = ''
    if (typeof performance !== 'undefined' && performance.memory) {
      const m = performance.memory
      memLine = `heap    : ${(m.usedJSHeapSize / 1e6).toFixed(1)} / ${(m.jsHeapSizeLimit / 1e6).toFixed(0)} MB\n`
    }

    // Warnings for obvious issues
    const warn = []
    if (render.calls > 150)   warn.push(`[!] draw calls high: ${render.calls}`)
    if (memory.textures > 60) warn.push(`[!] textures high: ${memory.textures}`)
    if (programs && programs.length > 40) warn.push(`[!] shader programs high: ${programs.length}`)

    this.renderInfoPanel.textContent =
      `draw    : ${render.calls} calls  ${render.triangles.toLocaleString()} tris\n` +
      `geo/tex : ${memory.geometries} geo  ${memory.textures} tex  ${programs ? programs.length : 0} prog\n` +
      `frame   : ${render.frame}\n` +
      sizeLine +
      memLine +
      camLine +
      `passes  : ${passLine}` +
      (warn.length ? '\n' + warn.join('\n') : '')

    // Tint warnings red
    this.renderInfoPanel.style.color = warn.length ? '#f66' : '#0ff'
    this.renderInfoPanel.style.borderLeftColor = warn.length ? '#f66' : '#0ff'
  }

  dispose() {
    this.gui?.destroy()
    if (this.stats) {
      document.body.removeChild(this.stats.dom)
    }
    if (this.renderInfoPanel) {
      document.body.removeChild(this.renderInfoPanel)
      this.renderInfoPanel = null
    }
  }
}
