const BASE = import.meta.env.VITE_ASSETS_BASE_URL ?? 'https://minio.mycloud-anthony.ovh/assets'

export function assetPath(path) {
  return BASE + path
}
