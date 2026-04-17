/**
 * TrafficNode — a single intersection in the traffic network.
 *
 * Each node stores its 3D position and a list of weighted directed edges
 * to other nodes.  `getNextNode()` picks a destination using weighted
 * random selection, which lets you create main-road / side-road traffic
 * distributions by assigning higher weights to busier connections.
 *
 * Single Responsibility: only concerned with graph topology + selection.
 */
import * as THREE from 'three'

let _nodeIdCounter = 0

export default class TrafficNode {
  /**
   * @param {THREE.Vector3} position — world-space position of this intersection
   */
  constructor(position) {
    /** @type {number} Unique identifier */
    this.id = _nodeIdCounter++

    /** @type {THREE.Vector3} */
    this.position = position.clone()

    /**
     * Directed edges from this node.
     * @type {Array<{ node: TrafficNode, weight: number }>}
     */
    this.edges = []
  }

  /**
   * Add a directed edge to another node.
   * @param {TrafficNode} targetNode
   * @param {number}      weight — higher = more likely to be chosen (default 1)
   */
  addEdge(targetNode, weight = 1) {
    // Prevent duplicate edges to same target
    if (this.edges.some(e => e.node === targetNode)) return
    this.edges.push({ node: targetNode, weight })
  }

  /**
   * Pick next node via weighted random selection.
   * @param {TrafficNode|null} excludeNode — optional node to exclude (e.g. where we came from)
   * @returns {TrafficNode|null}
   */
  getNextNode(excludeNode = null) {
    let candidates = this.edges
    if (excludeNode) {
      candidates = candidates.filter(e => e.node !== excludeNode)
    }
    if (candidates.length === 0) return this.edges.length > 0 ? this.edges[0].node : null

    const totalWeight = candidates.reduce((sum, e) => sum + e.weight, 0)
    let roll = Math.random() * totalWeight

    for (const edge of candidates) {
      roll -= edge.weight
      if (roll <= 0) return edge.node
    }

    // Fallback (shouldn't reach here due to float precision)
    return candidates[candidates.length - 1].node
  }

  /**
   * Distance to another node.
   * @param {TrafficNode} other
   * @returns {number}
   */
  distanceTo(other) {
    return this.position.distanceTo(other.position)
  }
}
