/**
 * reportAssetError — pretty, debuggable console log for any failed asset fetch / parse.
 *
 * Standard shape:
 *   [context] <verb> "<name>" → <message>
 *       url: <absolute URL>
 *       status: <HTTP status or "n/a">
 *       error: <Error stack or raw>
 *
 * Use everywhere a fetch can silently fail (collision .bin, settings json, chunks).
 */

const ROW   = 'color:#888;font-weight:normal'
const TITLE = 'color:#f66;font-weight:bold'
const SUB   = 'color:#fa3'

export function reportAssetError(context, info) {
  const {
    name      = '(unnamed)',
    url       = null,
    status    = null,
    verb      = 'fetch failed',
    error     = null,
    level     = 'error',
  } = info ?? {}

  const head = `%c[${context}]%c ${verb} "${name}"`
  const lines = []
  if (url    !== null) lines.push(`  url    : ${url}`)
  if (status !== null) lines.push(`  status : ${status}`)
  if (error)           lines.push(`  reason : ${error.message ?? String(error)}`)

  const body = lines.join('\n')
  const fn   = level === 'warn' ? console.warn : console.error
  if (body) fn(head + '\n' + body, TITLE, ROW)
  else      fn(head, TITLE, ROW)

  if (error?.stack && level !== 'warn') {
    console.groupCollapsed(`%c  stack`, SUB)
    console.log(error.stack)
    console.groupEnd()
  }
}

/**
 * safeFetch — fetch + standardized error reporting. Returns the Response on success,
 * or null if the fetch failed (already logged). The caller decides what to do.
 */
export async function safeFetch(url, { context, name, verb = 'fetch failed', init, level } = {}) {
  let res
  try {
    res = await fetch(url, init)
  } catch (error) {
    reportAssetError(context ?? 'fetch', { name: name ?? url, url, verb, error, level })
    return null
  }
  if (!res.ok) {
    reportAssetError(context ?? 'fetch', {
      name:   name ?? url,
      url,
      status: res.status,
      verb,
      level,
    })
    return null
  }
  return res
}
