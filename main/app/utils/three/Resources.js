import * as THREE from '/lib/three.js'
import { GLTFLoader }  from '/lib/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from '/lib/addons/loaders/DRACOLoader.js'
import EventEmitter from './EventEmitter.js'

export default class Resources extends EventEmitter {
  constructor(sources = []) {
    super()
    this.sources = sources
    this.items   = {}
    this.toLoad  = sources.length
    this.loaded  = 0
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
    this.loaders = { gltf, draco, texture: new THREE.TextureLoader() }
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
          console.error(`[Resources] fetch failed "${data.name}": ${data.message}`)
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
    if (assetType === 'gltf') {
      const basePath = source.path.substring(0, source.path.lastIndexOf('/') + 1)
      this.loaders.gltf.parse(
        buffer,
        basePath,
        (gltf) => this._sourceLoaded(source, gltf),
        (err) => {
          console.error(`[Resources] parse failed "${source.name}"`, err)
          this._sourceLoaded(source, null)
        }
      )
    } else if (assetType === 'texture') {
      const blob = new Blob([buffer])
      const url  = URL.createObjectURL(blob)
      this.loaders.texture.load(
        url,
        (tex) => { URL.revokeObjectURL(url); this._sourceLoaded(source, tex) },
        undefined,
        (err) => {
          URL.revokeObjectURL(url)
          console.error(`[Resources] texture parse failed "${source.name}"`, err)
          this._sourceLoaded(source, null)
        }
      )
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
    if (this.loaded === this.toLoad) this.trigger('ready')
  }

  dispose() {
    this._worker?.terminate()
    this._worker = null
  }
}
