// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // Styles globaux
  css: ['~/assets/css/global.css'],

  // Auto-import des sous-dossiers utils/three/
  imports: {
    dirs: [
      'utils/three/materials',
      'utils/three/textures',
    ],
  },
})
