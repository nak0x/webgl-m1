/**
 * MainWorld — scène principale (page index)
 *
 * Contient : multi-caméras, cube animé sur courbe, tore, sphère plexiglass,
 * modèle GLTF, raycaster, vue embarquée, gestion clavier/souris.
 *
 * callbacks :
 *   onEmbeddedChange(bool) — appelé quand la vue embarquée change d'état
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createPlexiglass } from '../materials/createPlexiglass.js'

export default class MainWorld {
  constructor(experience, callbacks = {}) {
    this.experience = experience
    this.scene      = experience.scene
    this.sizes      = experience.sizes
    this.camera     = experience.camera
    this.renderer   = experience.renderer
    this._callbacks = callbacks

    // Fond
    this.scene.background = new THREE.Color(0x111122)

    // La page gère plusieurs controls → désactiver l'auto-update de Camera
    this.camera.autoUpdate = false
    this.camera.instance.position.set(0, 6, -8)
    this.camera.instance.lookAt(0, 0, 0)
    this.camera.controls.target.set(0, 0, 0)
    this.camera.controls.update()

    this._isEmbedded    = false
    this._activeControls = this.camera.controls

    // Vecteurs réutilisables pour éviter les allocations en boucle
    this._pos    = new THREE.Vector3()
    this._tangent = new THREE.Vector3()
    this._lookAt  = new THREE.Vector3()

    this._setup()

    // La GLTF et l'input dépendent du chargement des resources
    experience.resources.on('ready', () => {
      this._setupGLTF()
      this._setupInput()
    })
  }

  _setup() {
    this._setupCameras()
    this._setupLights()
    this._setupFloor()
    this._setupCube()
    this._setupTorus()
    this._setupSphere()
    this._setupCurve()
  }

  _setupCameras() {
    const { sizes, renderer } = this

    // Caméra secondaire
    this.camera2 = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 0.1, 100)
    this.camera2.position.set(0, 6, 8)

    // Caméra embarquée (parentée au cube dans _setupCube)
    this.cameraOnCube = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.05, 100)
    this.cameraOnCube.position.set(0, 0.8, 0)
    this.cameraOnCube.rotation.y = Math.PI

    // Controls caméra 2
    this.controls2 = new OrbitControls(this.camera2, renderer.instance.domElement)
    this.controls2.target.set(0, 0, 0)
    this.controls2.enabled = false
    this.controls2.update()
  }

  _setupLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4))

    const pointLight = new THREE.PointLight(0xffffff, 25)
    pointLight.position.set(0, 5, 0)
    pointLight.castShadow = true
    pointLight.shadow.mapSize.set(1024, 1024)
    pointLight.shadow.camera.near = 0.5
    pointLight.shadow.camera.far  = 15
    this.scene.add(pointLight)
  }

  _setupFloor() {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.MeshStandardMaterial({ color: 0x334455 }),
    )
    floor.rotation.x    = -Math.PI / 2
    floor.receiveShadow = true
    this.scene.add(floor)
  }

  _setupCube() {
    this.cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x00ff88, roughness: 0.3, metalness: 0.2 }),
    )
    this.cube.position.set(-2, 0.8, 0)
    this.cube.castShadow = true
    this.cube.add(this.cameraOnCube) // caméra embarquée parentée au cube
    this.scene.add(this.cube)
  }

  _setupTorus() {
    this.torus = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.2, 16, 48),
      new THREE.MeshStandardMaterial({ color: 0xff4400, roughness: 0.4, metalness: 0.3 }),
    )
    this.torus.position.set(2, 0.8, 0)
    this.torus.castShadow = true
    this.scene.add(this.torus)
  }

  _setupSphere() {
    const { material: plexiMat, dispose } = createPlexiglass()
    this._disposePlexi = dispose
    this.sphere = new THREE.Mesh(new THREE.SphereGeometry(0.8, 48, 32), plexiMat)
    this.sphere.position.set(0, 0.8, -3)
    this.scene.add(this.sphere)
  }

  _setupCurve() {
    this.curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2, 0.5, -2),
      new THREE.Vector3( 2, 0.5, -2),
      new THREE.Vector3( 2, 0.5,  2),
      new THREE.Vector3(-2, 0.5,  2),
    ], true)

    this.scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(this.curve.getPoints(120)),
      new THREE.LineBasicMaterial({ color: 0xffee00 }),
    ))
  }

  _setupGLTF() {
    const gltf = this.experience.resources.items.roue
    this.scene.add(gltf.scene)
    this._selectables = [this.cube, this.torus, gltf.scene]
  }

  _setupInput() {
    const raycaster = new THREE.Raycaster()
    const mouse     = new THREE.Vector2()
    const focusPos  = new THREE.Vector3()

    const focusObject = (obj) => {
      obj.getWorldPosition(focusPos)
      this._activeControls?.target.copy(focusPos)
      this._activeControls?.update()
    }

    const enterEmbedded = () => {
      this._isEmbedded = true
      this._callbacks.onEmbeddedChange?.(true)
      this.renderer.setActiveCamera(this.cameraOnCube)
      this._activeControls = null
      this.camera.controls.enabled = false
      this.controls2.enabled       = false
    }

    const exitEmbedded = () => {
      this._isEmbedded = false
      this._callbacks.onEmbeddedChange?.(false)
      this.renderer.setActiveCamera(null)
      this._activeControls          = this.camera.controls
      this.camera.controls.enabled  = true
    }

    this._onClick = (e) => {
      if (this._isEmbedded) { exitEmbedded(); return }

      const rect = this.renderer.instance.domElement.getBoundingClientRect()
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1

      const cam = this.camera.controls.enabled ? this.camera.instance : this.camera2
      raycaster.setFromCamera(mouse, cam)
      const hits = raycaster.intersectObjects(this._selectables, true)
      if (!hits.length) return

      let hit = hits[0].object
      while (hit.parent && !this._selectables.includes(hit)) {
        hit = hit.parent
      }
      hit === this.cube ? enterEmbedded() : focusObject(hits[0].object)
    }

    this._onKeyDown = (e) => {
      if (e.key === 'Escape' && this._isEmbedded) { exitEmbedded(); return }
      if (this._isEmbedded) return

      if (e.key === 'a') {
        this.renderer.setActiveCamera(null)
        this._activeControls          = this.camera.controls
        this.camera.controls.enabled  = true
        this.controls2.enabled        = false
      } else if (e.key === 'z') {
        this.renderer.setActiveCamera(this.camera2)
        this._activeControls          = this.controls2
        this.controls2.enabled        = true
        this.camera.controls.enabled  = false
      }
    }

    window.addEventListener('click',   this._onClick)
    window.addEventListener('keydown', this._onKeyDown)
  }

  /** Appelé par Experience._resize() — met à jour les caméras supplémentaires */
  resize() {
    const a = this.sizes.width / this.sizes.height
    this.camera2.aspect = a
    this.camera2.updateProjectionMatrix()
    this.cameraOnCube.aspect = a
    this.cameraOnCube.updateProjectionMatrix()
  }

  /** Appelé par Experience._update() à chaque frame */
  update() {
    const t = (this.experience.time.elapsed / 5000) % 1

    this.curve.getPoint(t, this._pos)
    this.curve.getTangent(t, this._tangent)
    this.cube.position.copy(this._pos)
    this.cube.lookAt(this._lookAt.copy(this._pos).add(this._tangent))

    this.torus.rotation.y  = this.experience.time.elapsed / 2000
    this.sphere.rotation.y = this.experience.time.elapsed / 4000

    this._activeControls?.update()
  }

  dispose() {
    if (this._onClick)   window.removeEventListener('click',   this._onClick)
    if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown)
    this.controls2.dispose()
    this._disposePlexi?.()
  }
}
