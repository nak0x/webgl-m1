/**
 * AtelierConfig — noms d'objets et constantes de la scène Atelier.
 *
 * Centralise tous les noms de meshes GLTF et les rayons de proximité.
 * Mettre à jour ici après chaque ré-export Blender.
 */

export const ACT_LABEL = 'Acte 1 - L\'atelier'

/** Noms exacts des meshes dans le fichier GLB */
export const OBJECTS = {
  NPC:         'coffee_machine',
  PC:          'computer',
  TOOL:        'glasses',
  DOOR:        'door_in',
  DOOR_BUREAU: 'door_bureau',
  SCENE_MESH:  'fixed_scene',
  SCREEN:      'dalle_css3d',
}

/** Rayons de détection de proximité (unités Three.js) */
export const PROXIMITY = {
  NPC:         2.0,
  PC:          1.5,
  TOOL:        1.5,
  DOOR:        2.0,
  CHARACTER_1: 2.0,
  CHARACTER_2: 2.0,
}

export const CHARACTER_1 = {
  position: { x: 0.980, y: 0.000, z: -1.000 },
  rotation: { y: 1.998 },
  scale:    0.860,
}

export const CHARACTER_2 = { position: { x: 0.980, y: 0.000, z: -1.880 }, rotation: { y: 1.188 }, scale: 0.860 }

/**
 * USE_BUILTIN_FLOOR : true  → _setupFloor() crée un plan procédural
 *                    false → le GLTF contient déjà un sol (évite le z-fighting)
 */
export const SCENE = {
  USE_BUILTIN_FLOOR: false,
}
