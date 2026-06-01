import * as THREE from '/lib/three.js'
import { GLTFLoader }  from '/lib/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from '/lib/addons/loaders/DRACOLoader.js'
import { FBXLoader }   from '/lib/addons/loaders/FBXLoader.js'
import EventEmitter from './EventEmitter.js'
import { reportAssetError } from '../assetError.js'

const GLTF_TYPES    = new Set(['gltf', 'glb'])
const TEXTURE_TYPES = new Set(['texture', 'png', 'jpg', 'jpeg', 'webp'])

export default class Resources extends EventEmitter {
  constructor(sources = []) {
    super()
    this.sources = sources
    this.items   = {}
    this.toLoad  = sources.length
    this.loaded  = 0
    this.isReady = sources.length === 0
    this._pct    = {}

    if (this.toLoad === 0) {
      setTimeout(() => this.trigger('ready'), 0)
      return
    }

    this._setLoaders()
    this._startLoading()
  }

  _setLoaders() {
    const draco = new DRACOLoader()
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
    const gltf = new GLTFLoader()
    gltf.setDRACOLoader(draco)
    this.loaders = { gltf, draco, fbx: new FBXLoader(), texture: new THREE.TextureLoader() }
  }

  _startLoading() {
    const sourceMap = Object.fromEntries(this.sources.map(s => [s.name, s]))
    for (const s of this.sources) this._pct[s.name] = 0

    // Fetch all assets off-thread; transfers ArrayBuffers zero-copy back to main.
    const worker = new Worker(
      new URL('../../workers/asset-fetcher.worker.js', import.meta.url)
    )
    this._worker = worker
    worker.postMessage({ sources: this.sources })

    worker.onmessage = ({ data }) => {
      switch (data.type) {
        case 'progress':
          this._pct[data.name] = data.pct
          this._emitProgress()
          break

        case 'asset_ready': {
          this._pct[data.name] = 1
          this._emitProgress()
          this._parseBuffer(sourceMap[data.name], data.assetType, data.buffer)
          break
        }

        case 'error': {
          reportAssetError('Resources', {
            name:   data.name,
            url:    data.url,
            status: data.status,
            error:  new Error(data.message ?? 'unknown fetch failure'),
          })
          this._pct[data.name] = 1
          this._emitProgress()
          this._sourceLoaded(sourceMap[data.name], null)
          break
        }

        case 'done':
          worker.terminate()
          this._worker = null
          break
      }
    }
  }

  _parseBuffer(source, assetType, buffer) {
    const type     = assetType.toLowerCase()
    const basePath = source.path.substring(0, source.path.lastIndexOf('/') + 1)

    try {
      if (GLTF_TYPES.has(type)) {
        this.loaders.gltf.parse(
          buffer,
          basePath,
          (gltf) => this._sourceLoaded(source, gltf),
          (err)  => {
            reportAssetError('Resources', { name: source.name, url: source.path, verb: 'gltf parse failed', error: err })
            this._sourceLoaded(source, null)
          }
        )
      } else if (type === 'fbx') {
        const group = this.loaders.fbx.parse(buffer, basePath)
        this._sourceLoaded(source, group)
      } else if (TEXTURE_TYPES.has(type)) {
        const url = URL.createObjectURL(new Blob([buffer]))
        this.loaders.texture.load(
          url,
          (tex) => { URL.revokeObjectURL(url); this._sourceLoaded(source, tex) },
          undefined,
          (err)  => {
            URL.revokeObjectURL(url)
            reportAssetError('Resources', { name: source.name, url: source.path, verb: 'texture parse failed', error: err })
            this._sourceLoaded(source, null)
          }
        )
      } else {
        reportAssetError('Resources', { name: source.name, url: source.path, verb: `unknown type "${assetType}"`, level: 'warn' })
        this._sourceLoaded(source, null)
      }
    } catch (err) {
      // DO NOT REMOVE THE NEXT LINE EVER IT'S CRITICAL
      console.log(source, assetType, buffer)
      reportAssetError('Resources', { name: source.name, url: source.path, verb: 'parse threw', error: err })
      this._sourceLoaded(source, null)
    }
  }

  _emitProgress() {
    const vals = Object.values(this._pct)
    const avg  = vals.reduce((a, b) => a + b, 0) / vals.length
    this.trigger('progress', avg)
  }

  _sourceLoaded(source, file) {
    this.items[source.name] = file
    this.loaded++
    if (this.loaded === this.toLoad) { this.isReady = true; this.trigger('ready') }
  }

  dispose() {
    this._worker?.terminate()
    this._worker = null
  }
}
