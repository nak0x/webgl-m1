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
          { title: 'Vous avez déjà vécu cette journée ?', duration: 3000 },
        ],
        options: { theme: 'voiture', position: 'left' },
      },
      { type: 'video', src: assetPath('/videos/intro_atelier.mp4') },
      {
        type: 'text',
        cards: [
          { title: 'Le lendemain', duration: 3000 },
        ],
        options: { theme: 'ville', position: 'center' },
      },
    ],
  },

  'scene_2': {
    World:   HubWorld,
    sources: HubSources,
    flow: [
      { type: 'video', src: assetPath('/videos/transition_s1_s2.mp4') },
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
