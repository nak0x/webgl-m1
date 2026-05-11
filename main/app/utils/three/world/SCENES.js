import AtelierWorld         from './AtelierWorld.js'
import AtelierSources       from './AtelierSources.js'
import AtelierScene2World   from './AtelierScene2World.js'
import AtelierScene2Sources from './AtelierScene2Sources.js'
import AtelierScene3World   from './AtelierScene3World.js'
import AtelierScene3Sources from './AtelierScene3Sources.js'

export const SCENES = {
  'scene_1': { World: AtelierWorld,       sources: AtelierSources       },
  'scene_2':   { World: AtelierScene2World, sources: AtelierScene2Sources },
  'scene_3':           { World: AtelierScene3World, sources: AtelierScene3Sources },
}

export const SCENE_NAMES = Object.keys(SCENES)
