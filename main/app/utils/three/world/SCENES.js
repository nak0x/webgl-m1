import AtelierWorld           from './atelier/AtelierWorld.js'
import AtelierSources         from './atelier/AtelierSources.js'
import HubWorld               from './hub/HubWorld.js'
import HubSources             from './hub/HubSources.js'
import CityWorld              from './city/CityWorld.js'
import CitySources            from './city/CitySources.js'
import AtelierEndSceneWorld   from './atelier_end/AtelierEndSceneWorld.js'
import AtelierEndSceneSources from './atelier_end/AtelierEndSceneSources.js'

export const SCENES = {
  'scene_1': {
    World:   AtelierWorld,
    sources: AtelierSources,
    flow: [
      {
        type: 'text',
        cards: [
          { text: 'En 2050, après l\'effondrement de l\'ère des Villes-Marques, Altera s\'est reconstruite sur les ruines du capitalisme pour devenir un écosystème de "Communs" géré par et pour ses citoyens.', duration: 5000 },
          { text: 'Au sein de l\'Atelier de la Maintenance, les artisans veillent sur la flotte de véhicules partagés, répondant aux alertes pour garantir une mobilité fluide et solidaire basée sur l\'urgence sociale.', duration: 5000 },
          { text: 'Vous avez déjà vécu cette journée ?', duration: 3000 },
        ],
      },
      { type: 'video', src: '/videos/intro_atelier.mp4' },
    ],
  },

  'scene_2': {
    World:   HubWorld,
    sources: HubSources,
    flow: [
      { type: 'video', src: '/videos/transition_s1_s2.mp4' },
    ],
  },
  'scene_3': { World: CityWorld, sources: CitySources, flow: [] },

  'scene_4': {
    World:   AtelierEndSceneWorld,
    sources: AtelierEndSceneSources,
    flow: [],
  },
}

export const SCENE_NAMES = Object.keys(SCENES)
