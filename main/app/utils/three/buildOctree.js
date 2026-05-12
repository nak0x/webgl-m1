import { Octree } from '/lib/addons/math/Octree.js'

/**
 * Builds an Octree from a Three.js Object3D (scene, model, group…).
 * fromGraphNode only processes mesh triangles — lights and cameras are ignored.
 * Call this after all geometry has been added to the root.
 */
export function buildOctree(root) {
  const octree = new Octree()
  octree.fromGraphNode(root)
  return octree
}
