import AtelierWorld         from './AtelierWorld.js'
import AtelierSources       from './AtelierSources.js'
import AtelierScene2World   from './AtelierScene2World.js'
import AtelierScene2Sources from './AtelierScene2Sources.js'

export const SCENES = {
  'Atelier (scène 1)': { World: AtelierWorld,       sources: AtelierSources       },
  'Hub   (scène 2)':   { World: AtelierScene2World, sources: AtelierScene2Sources },
}

export const SCENE_NAMES = Object.keys(SCENES)
