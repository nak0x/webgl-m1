import { ref, reactive, computed } from 'vue'
import { zipSync } from 'fflate'
import ChunkerWorker from '../workers/chunker.worker.js?worker'

export function useChunker() {
  const isRunning    = ref(false)
  const chunks       = ref([])   // { chunkId, lod, buffer: ArrayBuffer, filename, triCount }
  const error        = ref(null)
  const manifest     = ref(null)
  const totalChunks  = ref(0)
  const collisionData = ref(null)  // { chunks: Map<chunkId,{bin}>, meta } — for viewport preview

  const districtMap  = reactive(new Map())
  const lodCounts    = reactive({ 0: 0, 1: 0, 2: 0 })

  const districtProgress = computed(() =>
    [...districtMap.entries()].map(([i, d]) => ({
      name: `District ${i + 1}`,
      stage: d.stage,
      pct: d.pct
    }))
  )

  const lodProgress = computed(() => [0, 1, 2].map(lod => ({
    lod,
    done: lodCounts[lod],
    total: totalChunks.value
  })))

  let worker = null

  // State accumulated across messages before zipping
  let _manifestObj      = null
  let _collisionChunks  = null  // Map<chunkId, { bin: ArrayBuffer, bmp: ArrayBuffer }>
  let _collisionMeta    = null
  let _collisionEnabled = false

  function _maybeZip() {
    if (!_manifestObj) return
    // _collisionMeta arrives with 'collision_done' (after all 'collision_chunk_done' messages)
    if (_collisionEnabled && !_collisionMeta) return

    const mf = { ..._manifestObj }
    if (_collisionEnabled && _collisionMeta && _collisionChunks) {
      mf.collisionMap = {
        resolution: _collisionMeta.resolution,
        minY:       _collisionMeta.minY,
        maxY:       _collisionMeta.maxY,
        sliceCount: _collisionMeta.sliceCount,
      }
      mf.chunks = mf.chunks.map(chunk => {
        if (_collisionChunks.has(chunk.id)) {
          return { ...chunk, collision: { bin: `collision_${chunk.col}_${chunk.row}.bin` } }
        }
        return chunk
      })
    }

    manifest.value    = mf
    totalChunks.value = mf.chunks.length
    isRunning.value   = false
    worker            = null

    _downloadZip(mf, _collisionChunks)
  }

  function start(files, config, offsets = []) {
    cancel()
    chunks.value       = []
    error.value        = null
    manifest.value     = null
    totalChunks.value  = 0
    collisionData.value = null
    isRunning.value    = true
    districtMap.clear()
    lodCounts[0] = lodCounts[1] = lodCounts[2] = 0
    _manifestObj      = null
    _collisionChunks  = null
    _collisionMeta    = null
    _collisionEnabled = config.collisionMap?.enabled ?? false

    worker = new ChunkerWorker()

    worker.onmessage = ({ data: msg }) => {
      if (msg.type === 'progress') {
        if (msg.district !== undefined) {
          districtMap.set(msg.district, { stage: msg.stage, pct: msg.pct })
        }
      } else if (msg.type === 'chunk_done') {
        const [col, row] = msg.chunkId.split('_').map(Number)
        chunks.value = [...chunks.value, {
          chunkId:      msg.chunkId,
          lod:          msg.lod,
          gltf:         msg.gltf,
          gltfFilename: `chunk_${col}_${row}_lod${msg.lod}.gltf`,
          triCount:     msg.triCount,
        }]
        lodCounts[msg.lod]++
      } else if (msg.type === 'done') {
        _manifestObj = msg.manifest
        _maybeZip()
      } else if (msg.type === 'collision_chunk_done') {
        if (!_collisionChunks) _collisionChunks = new Map()
        _collisionChunks.set(msg.chunkId, { bin: msg.bin, bmp: msg.bmp })
      } else if (msg.type === 'collision_done') {
        _collisionMeta = msg.meta
        collisionData.value = { chunks: _collisionChunks, meta: msg.meta }
        _maybeZip()
      } else if (msg.type === 'error') {
        error.value     = msg.message
        isRunning.value = false
        worker          = null
      }
    }

    worker.onerror = (e) => {
      error.value     = e.message ?? 'Worker error'
      isRunning.value = false
      worker          = null
    }

    Promise.all(files.map(f => f.arrayBuffer())).then(buffers => {
      if (!worker) return
      worker.postMessage(
        {
          type:         'start',
          districts:    buffers,
          offsets:      offsets.map(o => ({ x: o?.x ?? 0, z: o?.z ?? 0, angle: o?.angle ?? 0 })),
          chunkSize:    config.chunkSize,
          lodRatios:    [...(config.lodRatios   ?? [1.0, 0.25, 0.06])],
          lodErrors:    [...(config.lodErrors   ?? [0, 0.01, 0.05])],
          previewOnly:  config.previewOnly ?? false,
          collisionMap: { ...(config.collisionMap ?? { enabled: false }) },
        },
        buffers
      )
    }).catch(err => {
      error.value     = err.message
      isRunning.value = false
      worker          = null
    })
  }

  function cancel() {
    if (worker) {
      worker.terminate()
      worker = null
    }
    chunks.value        = []
    isRunning.value     = false
    _manifestObj        = null
    _collisionChunks    = null
    _collisionMeta      = null
    _collisionEnabled   = false
  }

  function _downloadZip(mf, collisionChunks) {
    const entries = {}
    for (const chunk of chunks.value) {
      entries[chunk.gltfFilename] = new TextEncoder().encode(chunk.gltf)
    }
    entries['manifest.json'] = new TextEncoder().encode(JSON.stringify(mf, null, 2))

    if (collisionChunks) {
      for (const [chunkId, { bin, bmp }] of collisionChunks) {
        const [col, row] = chunkId.split('_').map(Number)
        entries[`collision_${col}_${row}.bin`]       = new Uint8Array(bin)
        entries[`collision_${col}_${row}_debug.bmp`] = new Uint8Array(bmp)
      }
    }

    const zipped = zipSync(entries)
    const blob   = new Blob([zipped], { type: 'application/zip' })
    const url    = URL.createObjectURL(blob)
    const a      = document.createElement('a')
    a.href     = url
    a.download = 'chunks.zip'
    a.click()
    URL.revokeObjectURL(url)
    chunks.value = []
  }

  return { isRunning, chunks, error, manifest, collisionData, districtProgress, lodProgress, start, cancel }
}
