/**
 * Experience — classe principale de l'expérience Three.js
 *
 * Orchestre : Sizes, Time, Resources, Camera, Renderer.
 * Coordonne le resize et l'update dans le bon ordre.
 * Chaque page crée une instance dans onMounted et la détruit dans onUnmounted.
 *
 * Usage :
 *   const exp = new Experience(canvasElement, sources)
 *   const world = new MyWorld(exp)
 *   exp.setWorld(world)
 *   // ...
 *   exp.dispose()
 */
import * as THREE from 'three'
import Sizes     from './Sizes.js'
import Time      from './Time.js'
import Resources from './Resources.js'
import Camera    from './Camera.js'
import Renderer  from './Renderer.js'

export default class Experience {
  constructor(canvas, sources = []) {
    this.canvas = canvas
    this.scene  = new THREE.Scene()

    // Utils
    this.sizes     = new Sizes()
    this.time      = new Time()
    this.resources = new Resources(sources)

    // Three.js
    this.camera   = new Camera(this)
    this.renderer = new Renderer(this)

    // Boucle & resize propagés par Experience
    this.time.on('tick',    () => this._update())
    this.sizes.on('resize', () => this._resize())
  }

  /** Attache le World à l'experience. */
  setWorld(world) {
    this.world = world
  }

  _update() {
    this.camera.update()       // controls.update() si autoUpdate
    this.world?.update()       // logique 3D spécifique à la scène
    this.renderer.update()     // rendu final
  }

  _resize() {
    this.camera.resize()       // aspect ratio
    this.renderer.resize()     // dimensions renderer
    this.world?.resize?.()     // caméras supplémentaires
  }

  dispose() {
    this.time.dispose()        // stop RAF en premier
    this.sizes.dispose()       // remove resize listener
    this.camera.dispose()      // dispose OrbitControls
    this.renderer.dispose()    // dispose WebGLRenderer
    this.world?.dispose?.()    // dispose ressources du world
  }
}
