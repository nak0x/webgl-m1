import AtelierWorld   from './atelier/AtelierWorld.js'
import AtelierSources from './atelier/AtelierSources.js'
import HubWorld       from './hub/HubWorld.js'
import HubSources     from './hub/HubSources.js'
import CityWorld      from './city/CityWorld.js'
import CitySources    from './city/CitySources.js'

export const SCENES = {
  'scene_1': { World: AtelierWorld, sources: AtelierSources },
  'scene_2': { World: HubWorld,     sources: HubSources     },
  'scene_3': { World: CityWorld,    sources: CitySources    },
}

export const SCENE_NAMES = Object.keys(SCENES)
