/**
 * TrafficNetwork — directed graph of TrafficNodes.
 *
 * Two factory methods build the vehicle and pedestrian networks from a
 * city-grid configuration.  Vehicle lanes run down the center of roads
 * in opposite directions; pedestrian paths run along building edges.
 *
 * Single Responsibility: graph construction + querying.
 * Open/Closed: new network types can be added via new static factories
 * without modifying existing code.
 */
import * as THREE from 'three'
import TrafficNode from './TrafficNode.js'

export default class TrafficNetwork {
  /**
   * @param {'vehicle'|'pedestrian'} type
   */
  constructor(type) {
    /** @type {string} */
    this.type = type

    /** @type {TrafficNode[]} */
    this.nodes = []
  }

  /**
   * Add a node to the network.
   * @param {TrafficNode} node
   */
  addNode(node) {
    this.nodes.push(node)
  }

  /**
   * Get a random node from the network.
   * @returns {TrafficNode}
   */
  getRandomNode() {
    return this.nodes[Math.floor(Math.random() * this.nodes.length)]
  }

  /* ══════════════════════════════════════════════════════════
   *  VEHICLE NETWORK FACTORY
   *  Creates two parallel lanes (opposite directions) along
   *  every road in the grid.
   * ══════════════════════════════════════════════════════════ */

  /**
   * @param {object} cfg
   * @param {number} cfg.gridSize      — total world size (e.g. 100)
   * @param {number} cfg.blockSize     — distance between road centers (e.g. 12)
   * @param {number} cfg.laneOffset    — half-distance between opposite lanes (e.g. 1.5)
   * @param {number} cfg.mainRoadEvery — every N-th road is a "main road" with higher weight
   * @param {number} cfg.mainWeight    — weight for main-road edges
   * @param {number} cfg.sideWeight    — weight for side-road edges
   * @returns {TrafficNetwork}
   */
  static createVehicleGrid(cfg) {
    const {
      gridSize      = 100,
      blockSize     = 12,
      laneOffset    = 1.5,
      mainRoadEvery = 3,
      mainWeight    = 5,
      sideWeight    = 1,
    } = cfg

    const net  = new TrafficNetwork('vehicle')
    const half = gridSize / 2

    // Road positions (center-lines)
    const roads = []
    for (let v = -half; v <= half; v += blockSize) {
      roads.push(v)
    }

    // Build intersection nodes for each lane
    // nodeMap[laneKey] = TrafficNode
    // laneKey = `${x},${z},${dir}` where dir = 0|1
    const nodeMap = new Map()

    const key = (x, z, dir) => `${x.toFixed(1)},${z.toFixed(1)},${dir}`

    // Create nodes at every intersection for both lanes of every road
    for (const rx of roads) {
      for (const rz of roads) {
        // Horizontal road through (rx, rz): lanes at z ± laneOffset
        // Lane 0 → moving in +X, at z - laneOffset
        // Lane 1 → moving in -X, at z + laneOffset
        const hKey0 = key(rx, rz - laneOffset, 0)
        const hKey1 = key(rx, rz + laneOffset, 1)
        if (!nodeMap.has(hKey0)) {
          const n = new TrafficNode(new THREE.Vector3(rx, 0.05, rz - laneOffset))
          nodeMap.set(hKey0, n)
          net.addNode(n)
        }
        if (!nodeMap.has(hKey1)) {
          const n = new TrafficNode(new THREE.Vector3(rx, 0.05, rz + laneOffset))
          nodeMap.set(hKey1, n)
          net.addNode(n)
        }

        // Vertical road through (rx, rz): lanes at x ± laneOffset
        // Lane 0 → moving in +Z, at x + laneOffset
        // Lane 1 → moving in -Z, at x - laneOffset
        const vKey0 = key(rx + laneOffset, rz, 2)
        const vKey1 = key(rx - laneOffset, rz, 3)
        if (!nodeMap.has(vKey0)) {
          const n = new TrafficNode(new THREE.Vector3(rx + laneOffset, 0.05, rz))
          nodeMap.set(vKey0, n)
          net.addNode(n)
        }
        if (!nodeMap.has(vKey1)) {
          const n = new TrafficNode(new THREE.Vector3(rx - laneOffset, 0.05, rz))
          nodeMap.set(vKey1, n)
          net.addNode(n)
        }
      }
    }

    // Connect nodes along their road direction + allow turns at intersections
    for (let i = 0; i < roads.length; i++) {
      const isMainI = (i % mainRoadEvery) === 0

      for (let j = 0; j < roads.length; j++) {
        const rx = roads[i]
        const rz = roads[j]
        const isMainJ = (j % mainRoadEvery) === 0

        // Next intersection along horizontal road (lane 0 → +X)
        if (i + 1 < roads.length) {
          const nxRoad = roads[i + 1]
          const from = nodeMap.get(key(rx, rz - laneOffset, 0))
          const to   = nodeMap.get(key(nxRoad, rz - laneOffset, 0))
          if (from && to) from.addEdge(to, isMainJ ? mainWeight : sideWeight)
        }

        // Horizontal road lane 1 → -X
        if (i - 1 >= 0) {
          const pxRoad = roads[i - 1]
          const from = nodeMap.get(key(rx, rz + laneOffset, 1))
          const to   = nodeMap.get(key(pxRoad, rz + laneOffset, 1))
          if (from && to) from.addEdge(to, isMainJ ? mainWeight : sideWeight)
        }

        // Vertical road lane 0 → +Z
        if (j + 1 < roads.length) {
          const nzRoad = roads[j + 1]
          const from = nodeMap.get(key(rx + laneOffset, rz, 2))
          const to   = nodeMap.get(key(rx + laneOffset, nzRoad, 2))
          if (from && to) from.addEdge(to, isMainI ? mainWeight : sideWeight)
        }

        // Vertical road lane 1 → -Z
        if (j - 1 >= 0) {
          const pzRoad = roads[j - 1]
          const from = nodeMap.get(key(rx - laneOffset, rz, 3))
          const to   = nodeMap.get(key(rx - laneOffset, pzRoad, 3))
          if (from && to) from.addEdge(to, isMainI ? mainWeight : sideWeight)
        }

        // ── Turn connections at intersections ──
        // Allow turning from horizontal lane → vertical lanes and vice versa
        const h0 = nodeMap.get(key(rx, rz - laneOffset, 0))
        const h1 = nodeMap.get(key(rx, rz + laneOffset, 1))
        const v0 = nodeMap.get(key(rx + laneOffset, rz, 2))
        const v1 = nodeMap.get(key(rx - laneOffset, rz, 3))

        const turnWeight = sideWeight * 0.5 // Turns are less likely than going straight

        // h0 (+X) can turn onto v0 (+Z) or v1 (-Z)
        if (h0 && v0) h0.addEdge(v0, turnWeight)
        if (h0 && v1) h0.addEdge(v1, turnWeight)

        // h1 (-X) can turn onto v0 (+Z) or v1 (-Z)
        if (h1 && v0) h1.addEdge(v0, turnWeight)
        if (h1 && v1) h1.addEdge(v1, turnWeight)

        // v0 (+Z) can turn onto h0 (+X) or h1 (-X)
        if (v0 && h0) v0.addEdge(h0, turnWeight)
        if (v0 && h1) v0.addEdge(h1, turnWeight)

        // v1 (-Z) can turn onto h0 (+X) or h1 (-X)
        if (v1 && h0) v1.addEdge(h0, turnWeight)
        if (v1 && h1) v1.addEdge(h1, turnWeight)
      }
    }

    return net
  }

  /* ══════════════════════════════════════════════════════════
   *  PEDESTRIAN NETWORK FACTORY
   *  Creates sidewalk paths along building edges, on both
   *  sides of every road.
   * ══════════════════════════════════════════════════════════ */

  /**
   * @param {object} cfg
   * @param {number} cfg.gridSize
   * @param {number} cfg.blockSize
   * @param {number} cfg.sidewalkOffset — distance from road center to sidewalk (e.g. 4)
   * @returns {TrafficNetwork}
   */
  static createPedestrianGrid(cfg) {
    const {
      gridSize       = 100,
      blockSize      = 12,
      sidewalkOffset = 4,
    } = cfg

    const net  = new TrafficNetwork('pedestrian')
    const half = gridSize / 2

    const roads = []
    for (let v = -half; v <= half; v += blockSize) {
      roads.push(v)
    }

    const nodeMap = new Map()
    const key = (x, z, side) => `${x.toFixed(1)},${z.toFixed(1)},${side}`

    // Create nodes at intersection of sidewalks
    for (const rx of roads) {
      for (const rz of roads) {
        // 4 sidewalk corners around each intersection
        const offsets = [
          { dx: -sidewalkOffset, dz: -sidewalkOffset, side: 0 },
          { dx:  sidewalkOffset, dz: -sidewalkOffset, side: 1 },
          { dx:  sidewalkOffset, dz:  sidewalkOffset, side: 2 },
          { dx: -sidewalkOffset, dz:  sidewalkOffset, side: 3 },
        ]
        for (const { dx, dz, side } of offsets) {
          const k = key(rx + dx, rz + dz, side)
          if (!nodeMap.has(k)) {
            const n = new TrafficNode(new THREE.Vector3(rx + dx, 0.05, rz + dz))
            nodeMap.set(k, n)
            net.addNode(n)
          }
        }
      }
    }

    // Connect sidewalk nodes
    // Along each block edge (between adjacent intersections) and around corners
    for (let i = 0; i < roads.length; i++) {
      for (let j = 0; j < roads.length; j++) {
        const rx = roads[i]
        const rz = roads[j]

        const tl = nodeMap.get(key(rx - sidewalkOffset, rz - sidewalkOffset, 0))
        const tr = nodeMap.get(key(rx + sidewalkOffset, rz - sidewalkOffset, 1))
        const br = nodeMap.get(key(rx + sidewalkOffset, rz + sidewalkOffset, 2))
        const bl = nodeMap.get(key(rx - sidewalkOffset, rz + sidewalkOffset, 3))

        // Connect corners around this intersection (bidirectional)
        if (tl && tr) { tl.addEdge(tr, 1); tr.addEdge(tl, 1) }
        if (tr && br) { tr.addEdge(br, 1); br.addEdge(tr, 1) }
        if (br && bl) { br.addEdge(bl, 1); bl.addEdge(br, 1) }
        if (bl && tl) { bl.addEdge(tl, 1); tl.addEdge(bl, 1) }

        // Connect to adjacent intersection's sidewalk nodes
        // Right neighbor
        if (i + 1 < roads.length) {
          const nRx = roads[i + 1]
          const nTl = nodeMap.get(key(nRx - sidewalkOffset, rz - sidewalkOffset, 0))
          const nBl = nodeMap.get(key(nRx - sidewalkOffset, rz + sidewalkOffset, 3))
          if (tr && nTl) { tr.addEdge(nTl, 1); nTl.addEdge(tr, 1) }
          if (br && nBl) { br.addEdge(nBl, 1); nBl.addEdge(br, 1) }
        }

        // Bottom neighbor
        if (j + 1 < roads.length) {
          const nRz = roads[j + 1]
          const nTl = nodeMap.get(key(rx - sidewalkOffset, nRz - sidewalkOffset, 0))
          const nTr = nodeMap.get(key(rx + sidewalkOffset, nRz - sidewalkOffset, 1))
          if (bl && nTl) { bl.addEdge(nTl, 1); nTl.addEdge(bl, 1) }
          if (br && nTr) { br.addEdge(nTr, 1); nTr.addEdge(br, 1) }
        }
      }
    }

    return net
  }

  /* ══════════════════════════════════════════════════════════
   *  DEBUG VISUALIZATION
   * ══════════════════════════════════════════════════════════ */

  /**
   * Create a THREE.Group with debug lines for all edges.
   * @param {number} color — hex color
   * @returns {THREE.Group}
   */
  createDebugVisualization(color = 0xffff00) {
    const group = new THREE.Group()
    group.name = `debug_network_${this.type}`

    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.3 })

    for (const node of this.nodes) {
      for (const edge of node.edges) {
        const geometry = new THREE.BufferGeometry().setFromPoints([
          node.position,
          edge.node.position,
        ])
        group.add(new THREE.Line(geometry, material))
      }
    }

    return group
  }
}
