import { ref, reactive, computed } from 'vue'
import { zipSync } from 'fflate'
import ChunkerWorker from '../workers/chunker.worker.js?worker'

export function useChunker() {
  const isRunning    = ref(false)
  const chunks       = ref([])   // { chunkId, lod, gltf, gltfFilename, triCount }
  const collisions   = ref([])   // { chunkId, bin, bmp }
  const error        = ref(null)
  const manifest     = ref(null)
  const totalChunks  = ref(0)

  // Keyed by district index; updated on each progress message with district field
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

  function start(files, config, offsets = []) {
    cancel()
    chunks.value      = []
    collisions.value  = []
    error.value       = null
    manifest.value    = null
    totalChunks.value = 0
    isRunning.value   = true
    districtMap.clear()
    lodCounts[0] = lodCounts[1] = lodCounts[2] = 0

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
      } else if (msg.type === 'collision_chunk_done') {
        collisions.value = [...collisions.value, {
          chunkId: msg.chunkId,
          bin:     msg.bin,
          bmp:     msg.bmp,
          binFile: msg.binFile,
          bmpFile: msg.bmpFile,
        }]
      } else if (msg.type === 'done') {
        manifest.value    = msg.manifest
        totalChunks.value = msg.manifest.chunks.length
        isRunning.value   = false
        worker            = null
        _downloadZip(msg.manifest)
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
          type:        'start',
          districts:   buffers,
          offsets:     offsets.map(o => ({ x: o?.x ?? 0, z: o?.z ?? 0 })),
          chunkSize:   config.chunkSize,
          lodRatios:   [...(config.lodRatios   ?? [1.0, 0.25, 0.06])],
          lodErrors:   [...(config.lodErrors   ?? [0, 0.01, 0.05])],
          previewOnly: config.previewOnly ?? false,
          collisionMap: { ...(config.collisionMap ?? { enabled: false }) },
        },
        buffers  // only ArrayBuffers are transferred; offsets are plain objects (structured clone)
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
    chunks.value    = []
    isRunning.value = false
  }

  function _downloadZip(mf) {
    // Each .gltf is self-contained (binary embedded as base64 data URI) — one file per chunk
    const entries = {}
    for (const chunk of chunks.value) {
      entries[chunk.gltfFilename] = new TextEncoder().encode(chunk.gltf)
    }
    for (const col of collisions.value) {
      entries[col.binFile] = new Uint8Array(col.bin)
      if (col.bmp && col.bmpFile) entries[col.bmpFile] = new Uint8Array(col.bmp)
    }
    entries['manifest.json'] = new TextEncoder().encode(JSON.stringify(mf, null, 2))

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

  return { isRunning, chunks, collisions, error, manifest, districtProgress, lodProgress, start, cancel }
}
