import AtelierWorld           from './atelier/AtelierWorld.js'
import AtelierSources         from './atelier/AtelierSources.js'
import HubWorld               from './hub/HubWorld.js'
import HubSources             from './hub/HubSources.js'
import CityWorld              from './city/CityWorld.js'
import CitySources            from './city/CitySources.js'
import AtelierEndSceneWorld   from './atelier_end/AtelierEndSceneWorld.js'
import AtelierEndSceneSources from './atelier_end/AtelierEndSceneSources.js'
import CarRepairWorld         from './car_repair/CarRepairWorld.js'
import CarRepairSources       from './car_repair/CarRepairSources.js'
import { assetPath }          from '../../assetPath.js'

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
      { type: 'video', src: assetPath('/videos/intro_atelier.mp4') },
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

  'scene_4': {
    World:   AtelierEndSceneWorld,
    sources: AtelierEndSceneSources,
    flow: [],
  },

  'car_repair': {
    World:   CarRepairWorld,
    sources: CarRepairSources,
    flow: [
      {
        type: 'text',
        cards: [
          { title: 'DIAGNOSTIC',          duration: 2500 },
          { text: 'Analyse du véhicule…', duration: 2000 },
        ],
      },
    ],
  },
}

export const SCENE_NAMES = Object.keys(SCENES)
