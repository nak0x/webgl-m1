import AtelierWorld   from './atelier/AtelierWorld.js'
import AtelierSources from './atelier/AtelierSources.js'
import HubWorld       from './hub/HubWorld.js'
import HubSources     from './hub/HubSources.js'
import CityWorld      from './city/CityWorld.js'
import CitySources    from './city/CitySources.js'

export const SCENES = {
  'scene_1': {
    World:   AtelierWorld,
    sources: AtelierSources,
    flow: [
      {
        type: 'text',
        cards: [
          { title: 'NEXORA CORP.',                                           duration: 3500 },
          { text: 'Secteur industriel, zone 7-B.\n2031.',                   duration: 3000 },
          { text: 'La maintenance automatisée est en panne depuis 48h.\nTous les techniciens sont mobilisés ailleurs.', duration: 4500 },
          { title: 'MISSION', subtitle: 'Remise en service de l\'atelier',  duration: 3500 },
        ],
      },
      // Décommenter quand la vidéo Blender est prête :
      { type: 'video', src: '/videos/intro_atelier.mp4' },
    ],
  },

  'scene_2': {
    World:   HubWorld,
    sources: HubSources,
    flow: [
      {
        type: 'text',
        cards: [
          { text: 'Atelier remis en service.\nRapport transmis au hub central.',  duration: 3500 },
          { title: 'HUB CENTRAL', subtitle: 'Secteur de coordination — niveau 0', duration: 3500 },
        ],
      },
      // Décommenter quand la vidéo Blender est prête :
      // { type: 'video', src: '/videos/transition_atelier_hub.mp4' },
    ],
  },
  'scene_3': { World: CityWorld, sources: CitySources, flow: [] },
}

export const SCENE_NAMES = Object.keys(SCENES)
