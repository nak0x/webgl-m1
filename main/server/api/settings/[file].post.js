import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, normalize } from 'node:path'

const SETTINGS_DIR = resolve(process.cwd(), 'public/settings')

export default defineEventHandler(async (event) => {
  if (!import.meta.dev) throw createError({ statusCode: 403, statusMessage: 'dev only' })

  const file = getRouterParam(event, 'file')
  if (!/^[a-z0-9_]+\.json$/i.test(file)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid filename' })
  }

  const target = normalize(resolve(SETTINGS_DIR, file))
  if (!target.startsWith(SETTINGS_DIR)) {
    throw createError({ statusCode: 400, statusMessage: 'path traversal' })
  }

  const body = await readBody(event)
  await mkdir(SETTINGS_DIR, { recursive: true })
  await writeFile(target, JSON.stringify(body, null, 2), 'utf8')
  return { ok: true, file }
})
