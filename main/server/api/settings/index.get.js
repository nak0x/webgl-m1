import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

export default defineEventHandler(async () => {
  const dir = resolve(process.cwd(), 'public/settings')
  const files = await readdir(dir)
  return files.filter(f => f.endsWith('.json'))
})
