async function fetchWithProgress(path, onProgress) {
  let response
  try {
    response = await fetch(path)
  } catch (err) {
    const e = new Error(`network error — ${err.message ?? err}`)
    e.url = path
    throw e
  }
  if (!response.ok) {
    const e = new Error(`HTTP ${response.status} ${response.statusText || ''}`.trim())
    e.url    = path
    e.status = response.status
    throw e
  }

  const contentLength = Number(response.headers.get('content-length')) || 0
  const reader = response.body.getReader()
  const chunks = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
    if (contentLength > 0) onProgress(received / contentLength)
  }

  const merged = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return merged.buffer
}

self.onmessage = async ({ data: { sources } }) => {
  await Promise.all(
    sources.map(async (source) => {
      try {
        const buffer = await fetchWithProgress(source.path, (pct) => {
          self.postMessage({ type: 'progress', name: source.name, pct })
        })
        self.postMessage(
          { type: 'asset_ready', name: source.name, assetType: source.type, buffer },
          [buffer]
        )
      } catch (err) {
        self.postMessage({
          type:    'error',
          name:    source.name,
          message: err.message,
          url:     err.url    ?? source.path,
          status:  err.status ?? null,
        })
      }
    })
  )
  self.postMessage({ type: 'done' })
}
