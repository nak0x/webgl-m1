// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@pinia/nuxt'],

  app: {
    head: {
      title: 'EcoFleet CRM — Gestion Véhicules Communautaires',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'CRM solarpunk pour la gestion de véhicules communautaires écologiques. Suivi en temps réel, maintenance, stock de pièces.',
        },
        { name: 'theme-color', content: '#52B788' },
      ],
      link: [
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com',
        },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: '',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap',
        },
      ],
    },
  },

  css: ['~/assets/css/main.css'],

  ssr: false,

  vite: {
    optimizeDeps: {
      include: [
        'three',
        'three/examples/jsm/controls/MapControls.js',
      ],
    },
  },
})
