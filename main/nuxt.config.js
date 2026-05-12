import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicLib = resolve(__dirname, 'public/lib')

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@pinia/nuxt'],

  css: ['~/assets/css/global.css'],

  imports: {
    dirs: [
      'utils/three/materials',
      'utils/three/textures',
    ],
  },

  vite: {
    resolve: {
      alias: [
        { find: '/lib/three.js', replacement: resolve(publicLib, 'three.js') },
        { find: /^\/lib\/addons\//, replacement: resolve(publicLib, 'addons') + '/' },
      ],
    },
    optimizeDeps: {
      exclude: ['@dimforge/rapier3d-compat'],
    },
  },
})
