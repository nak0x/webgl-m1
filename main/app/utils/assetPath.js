const BASE = import.meta.env.VITE_ASSETS_BASE_URL ?? 'https://s3-vmgddq43sii69fcmt69l5639.gobelinsannecy.fr/project-adhoc/'

export function assetPath(path) {
  return BASE + path
}
