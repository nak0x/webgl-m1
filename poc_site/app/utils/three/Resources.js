/**
 * Resources — chargement centralisé des assets
 * Accepte un tableau de sources { name, type, path }.
 * Émet 'ready' quand tous les assets sont chargés.
 *
 * Types supportés : 'gltf', 'texture'
 *
 * Usage :
 *   const resources = new Resources([
 *     { name: 'roue', type: 'gltf', path: '/models/roue_test.gltf' },
 *   ])
 *   resources.on('ready', () => {
 *     const gltf = resources.items.roue
 *   })
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import EventEmitter from './EventEmitter.js'

export default class Resources extends EventEmitter {
  constructor(sources = []) {
    super()
    this.sources = sources
    this.items   = {}
    this.toLoad  = sources.length
    this.loaded  = 0

    if (this.toLoad === 0) {
      // Différé pour laisser le temps aux listeners de s'attacher
      setTimeout(() => this.trigger('ready'), 0)
      return
    }

    this._setLoaders()
    this._startLoading()
  }

  _setLoaders() {
    this.loaders = {
      gltf:    new GLTFLoader(),
      texture: new THREE.TextureLoader(),
    }
  }

  _startLoading() {
    for (const source of this.sources) {
      if (source.type === 'gltf') {
        this.loaders.gltf.load(source.path, file => this._sourceLoaded(source, file))
      } else if (source.type === 'texture') {
        this.loaders.texture.load(source.path, file => this._sourceLoaded(source, file))
      }
    }
  }

  _sourceLoaded(source, file) {
    this.items[source.name] = file
    this.loaded++
    if (this.loaded === this.toLoad) this.trigger('ready')
  }
}
