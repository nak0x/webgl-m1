/**
 * ScreenWorld — scène avec un écran 3D HTML interactif (page /screen)
 *
 * Architecture :
 *   WebGLRenderer  → bureau, bezel, lumières, sol
 *   CSS3DRenderer  → HTMLScreen (vrai div HTML dans l'espace 3D)
 *
 * Les deux renderers partagent la même caméra Three.js.
 * Le CSS3DRenderer est un layer fixe par-dessus le canvas WebGL,
 * avec pointer-events:none globalement et pointer-events:auto sur le seul div écran.
 *
 * callbacks (vers Vue) :
 *   onEnterActive()       — écran cliqué, passage en mode actif
 *   onItemClick(label)    — item de la grille cliqué
 *   onBackToIdle()        — retour à l'écran idle
 */
import * as THREE from 'three'
import { CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js'
import HTMLScreen from './HTMLScreen.js'

export default class ScreenWorld {
  constructor(experience, callbacks = {}) {
    this.experience  = experience
    this.scene       = experience.scene
    this.camera      = experience.camera
    this.sizes       = experience.sizes
    this.renderer    = experience.renderer
    this._callbacks  = callbacks

    // Fond de scène
    this.scene.background = new THREE.Color(0x0a0a1a)
    this.scene.fog        = new THREE.FogExp2(0x0a0a1a, 0.055)

    // Caméra — vue légèrement de face sur l'écran
    this.camera.instance.position.set(0, 1.8, 5.5)
    this.camera.controls.target.set(0, 1.6, 0)
    this.camera.setDamping(true, 0.05)
    this.camera.controls.minDistance = 1.5
    this.camera.controls.maxDistance = 12
    this.camera.controls.update()

    this._setup()
  }

  // ════════════════════════════════════════════════════════════
  //  Setup
  // ════════════════════════════════════════════════════════════

  _setup() {
    this._setupCSSRenderer()
    this._setupLights()
    this._setupFloor()
    this._setupDesk()
    this._setupHTMLScreen()
  }

  /**
   * CSS3DRenderer — layer HTML 3D superposé au canvas WebGL.
   *
   * pointer-events:none sur le container → OrbitControls fonctionne partout.
   * Le div de l'écran HTML se ré-active lui-même avec pointer-events:auto.
   */
  _setupCSSRenderer() {
    this._cssRenderer = new CSS3DRenderer()
    this._cssRenderer.setSize(this.sizes.width, this.sizes.height)

    const el = this._cssRenderer.domElement
    el.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    `
    document.body.appendChild(el)
  }

  _setupLights() {
    this.scene.add(new THREE.AmbientLight(0x102030, 2.5))

    // Monitor glow — légère oscillation dans update()
    this._screenGlow = new THREE.PointLight(0x3060ff, 15, 8)
    this._screenGlow.position.set(0, 2.2, 1.5)
    this.scene.add(this._screenGlow)

    const fill = new THREE.DirectionalLight(0x8899aa, 0.8)
    fill.position.set(-5, 8, 3)
    this.scene.add(fill)

    const rim = new THREE.PointLight(0x0044cc, 6, 6)
    rim.position.set(0, 2, -1.5)
    this.scene.add(rim)
  }

  _setupFloor() {
    const geo = new THREE.PlaneGeometry(20, 20)
    const mat = new THREE.MeshStandardMaterial({ color: 0x080818, roughness: 0.9, metalness: 0.1 })
    const floor = new THREE.Mesh(geo, mat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.scene.add(floor)
    this._floorGeo = geo
    this._floorMat = mat
  }

  _setupDesk() {
    this._deskGeos = []
    this._deskMats = []

    // Bureau
    const deskGeo = new THREE.BoxGeometry(5, 0.08, 1.8)
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 0.8, metalness: 0.05 })
    const desk = new THREE.Mesh(deskGeo, deskMat)
    desk.position.set(0, 0.6, 0.9)
    desk.receiveShadow = true
    this.scene.add(desk)
    this._deskGeos.push(deskGeo)
    this._deskMats.push(deskMat)

    // Pied d'écran
    const standGeo = new THREE.CylinderGeometry(0.12, 0.22, 0.6, 12)
    const standMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.6 })
    const stand = new THREE.Mesh(standGeo, standMat)
    stand.position.set(0, 0.94, 0.5)
    stand.castShadow = true
    this.scene.add(stand)
    this._deskGeos.push(standGeo)
    this._deskMats.push(standMat)

    // Bezel (cadre WebGL derrière le HTML)
    const bezelGeo = new THREE.BoxGeometry(3.45, 2.2, 0.07)
    const bezelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.7 })
    const bezel = new THREE.Mesh(bezelGeo, bezelMat)
    bezel.position.set(0, 1.6, -0.04)
    bezel.castShadow = true
    this.scene.add(bezel)
    this._deskGeos.push(bezelGeo)
    this._deskMats.push(bezelMat)
  }

  _setupHTMLScreen() {
    this._htmlScreen = new HTMLScreen(
      this.experience,
      '/screens/test.html',
      {
        onItemClick:  (label) => this._callbacks.onItemClick?.(label),
        onClose:      ()      => this._callbacks.onClose?.(),
        onCardClose:  ()      => this._callbacks.onCardClose?.(),
        onMessage:    (data)  => this._callbacks.onMessage?.(data),
      }
    )
  }

  // ════════════════════════════════════════════════════════════
  //  Boucle
  // ════════════════════════════════════════════════════════════

  update() {
    const t = this.experience.time.elapsed / 1000

    // Légère oscillation du glow écran
    this._screenGlow.intensity = 14 + Math.sin(t * 1.3) * 1.5

    // Rendu CSS3D (same camera, same scene)
    this._cssRenderer.render(this.scene, this.camera.instance)
  }

  resize() {
    const { width, height } = this.sizes
    this._cssRenderer.setSize(width, height)
  }

  // ════════════════════════════════════════════════════════════
  //  Dispose
  // ════════════════════════════════════════════════════════════

  dispose() {
    this._htmlScreen.dispose()

    this._cssRenderer.domElement.remove()

    this._floorGeo.dispose()
    this._floorMat.dispose()
    this._deskGeos.forEach(g => g.dispose())
    this._deskMats.forEach(m => m.dispose())
  }
}
