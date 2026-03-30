import * as THREE from 'three'
import { createNoise2D } from 'simplex-noise'

// ── Color Palette (Solarpunk) ──────────────────────────────
const COLORS = {
  white: 0xf5f2ed,
  warmGrey: 0xd4cfc7,
  warmGreyDark: 0xb8b3aa,
  green: 0x88b87a,
  greenDark: 0x5a8a4c,
  greenLight: 0xa8d89a,
  road: 0xccc8be,
  roadLine: 0xe2ded6,
  ground: 0xddd8ce,
}

// ── Chunk Config ──────────────────────────────────────────
const BLOCK_SIZE = 5 // size of one city block in world units
const ROAD_WIDTH = 3 // road width between blocks (wider for walkability)
const CELL_SIZE = BLOCK_SIZE + ROAD_WIDTH // total cell pitch

export interface CityChunk {
  group: THREE.Group
  chunkX: number
  chunkZ: number
}

export interface CityGeneratorResult {
  chunks: CityChunk[]
  groundMesh: THREE.Mesh
  dispose: () => void
}

export function useCityGenerator(scene: THREE.Scene): CityGeneratorResult {
  const noise2D = createNoise2D()
  const chunks: CityChunk[] = []
  const disposables: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []

  const GRID_SIZE = 20 // 20x20 blocks
  const HALF_GRID = GRID_SIZE / 2

  // ── Shared Materials ──────────────────────────────────
  const buildingMatWhite = new THREE.MeshStandardMaterial({
    color: COLORS.white,
    roughness: 0.7,
    metalness: 0.05,
  })
  const buildingMatGrey = new THREE.MeshStandardMaterial({
    color: COLORS.warmGrey,
    roughness: 0.75,
    metalness: 0.05,
  })
  const greenMat = new THREE.MeshStandardMaterial({
    color: COLORS.green,
    roughness: 0.8,
    metalness: 0.0,
  })
  const greenDarkMat = new THREE.MeshStandardMaterial({
    color: COLORS.greenDark,
    roughness: 0.85,
    metalness: 0.0,
  })
  const greenLightMat = new THREE.MeshStandardMaterial({
    color: COLORS.greenLight,
    roughness: 0.8,
    metalness: 0.0,
  })
  const roadMat = new THREE.MeshStandardMaterial({
    color: COLORS.road,
    roughness: 0.9,
    metalness: 0.0,
  })

  materials.push(buildingMatWhite, buildingMatGrey, greenMat, greenDarkMat, greenLightMat, roadMat)

  // ── Shared Geometries ──────────────────────────────────
  // Reuse a single box geometry and scale via the matrix for instancing
  const unitBox = new THREE.BoxGeometry(1, 1, 1)
  const unitCylinder = new THREE.CylinderGeometry(0.3, 0.4, 1.5, 6)
  const unitCone = new THREE.ConeGeometry(0.7, 1.5, 6)
  const unitSphere = new THREE.SphereGeometry(0.8, 6, 5)
  disposables.push(unitBox, unitCylinder, unitCone, unitSphere)

  // ── Ground Plane ──────────────────────────────────────
  const worldSize = GRID_SIZE * CELL_SIZE + ROAD_WIDTH
  const groundGeo = new THREE.PlaneGeometry(worldSize * 1.5, worldSize * 1.5)
  const groundMat = new THREE.MeshStandardMaterial({
    color: COLORS.ground,
    roughness: 0.95,
    metalness: 0.0,
  })
  const groundMesh = new THREE.Mesh(groundGeo, groundMat)
  groundMesh.rotation.x = -Math.PI / 2
  groundMesh.position.y = -0.01
  groundMesh.receiveShadow = true
  scene.add(groundMesh)
  disposables.push(groundGeo)
  materials.push(groundMat)

  // ── Instanced collections ──────────────────────────────
  // We collect all transforms, then create instanced meshes at the end
  const buildingTransforms: { matrix: THREE.Matrix4; colorIndex: number }[] = []
  const roofGardenTransforms: THREE.Matrix4[] = []
  const treeTransforms: { trunkMatrix: THREE.Matrix4; canopyMatrix: THREE.Matrix4; canopyType: number }[] = []
  const planterTransforms: THREE.Matrix4[] = []
  const roadTransforms: THREE.Matrix4[] = []

  // ── Helper: noise-based building height ────────────────
  const getBuildingHeight = (wx: number, wz: number): number => {
    const n1 = noise2D(wx * 0.03, wz * 0.03) // large-scale variation
    const n2 = noise2D(wx * 0.1, wz * 0.1) * 0.3 // smaller detail
    const base = (n1 + n2 + 1) / 2 // 0..1
    return 1.5 + base * 8 // 1.5 to 9.5
  }

  // ── Helper: is this cell a park? ───────────────────────
  const isPark = (gx: number, gz: number): boolean => {
    // Force center area to be open park/plaza for player spawn
    const cx = gx - HALF_GRID
    const cz = gz - HALF_GRID
    if (Math.abs(cx) <= 1 && Math.abs(cz) <= 1) return true
    const n = noise2D(gx * 0.25 + 100, gz * 0.25 + 100)
    return n > 0.45 // ~25% chance
  }

  // ── Generate Grid ─────────────────────────────────────
  const tempMat = new THREE.Matrix4()
  const tempPos = new THREE.Vector3()
  const tempQuat = new THREE.Quaternion()
  const tempScale = new THREE.Vector3()

  for (let gx = 0; gx < GRID_SIZE; gx++) {
    for (let gz = 0; gz < GRID_SIZE; gz++) {
      const wx = (gx - HALF_GRID) * CELL_SIZE
      const wz = (gz - HALF_GRID) * CELL_SIZE

      // ── Roads (horizontal + vertical strips around each block)
      // Horizontal road below the block
      tempMat.compose(
        tempPos.set(wx, 0.001, wz + BLOCK_SIZE / 2 + ROAD_WIDTH / 2),
        tempQuat.identity(),
        tempScale.set(CELL_SIZE, 0.02, ROAD_WIDTH)
      )
      roadTransforms.push(tempMat.clone())

      // Vertical road to the right of the block
      tempMat.compose(
        tempPos.set(wx + BLOCK_SIZE / 2 + ROAD_WIDTH / 2, 0.001, wz),
        tempQuat.identity(),
        tempScale.set(ROAD_WIDTH, 0.02, CELL_SIZE)
      )
      roadTransforms.push(tempMat.clone())

      if (isPark(gx, gz)) {
        // ── PARK ──────────────────────────────────────
        // Green ground patch
        tempMat.compose(
          tempPos.set(wx, 0.01, wz),
          tempQuat.identity(),
          tempScale.set(BLOCK_SIZE, 0.02, BLOCK_SIZE)
        )
        roofGardenTransforms.push(tempMat.clone())

        // Trees in the park (3-5 scattered)
        const treeCount = 3 + Math.floor(Math.abs(noise2D(gx * 7, gz * 7)) * 3)
        for (let t = 0; t < treeCount; t++) {
          const tx = wx + (noise2D(gx * 13 + t, gz * 17) * 0.4) * BLOCK_SIZE
          const tz = wz + (noise2D(gx * 19 + t, gz * 23) * 0.4) * BLOCK_SIZE
          const treeHeight = 1.5 + Math.abs(noise2D(tx, tz)) * 2

          // Trunk
          const trunkMat = new THREE.Matrix4().compose(
            new THREE.Vector3(tx, treeHeight * 0.4, tz),
            new THREE.Quaternion(),
            new THREE.Vector3(0.5, treeHeight * 0.5, 0.5)
          )

          // Canopy — either cone or sphere
          const canopyType = noise2D(tx * 3, tz * 3) > 0 ? 0 : 1 // 0=cone, 1=sphere
          const canopyY = treeHeight * 0.7
          const canopyMat = new THREE.Matrix4().compose(
            new THREE.Vector3(tx, canopyY, tz),
            new THREE.Quaternion(),
            new THREE.Vector3(1, 1, 1)
          )

          treeTransforms.push({ trunkMatrix: trunkMat, canopyMatrix: canopyMat, canopyType })
        }

        // Planters around the park edge
        for (let e = 0; e < 4; e++) {
          const angle = (e / 4) * Math.PI * 2
          const px = wx + Math.cos(angle) * (BLOCK_SIZE * 0.45)
          const pz = wz + Math.sin(angle) * (BLOCK_SIZE * 0.45)
          tempMat.compose(
            tempPos.set(px, 0.2, pz),
            tempQuat.identity(),
            tempScale.set(0.6, 0.4, 0.6)
          )
          planterTransforms.push(tempMat.clone())
        }

      } else {
        // ── BUILDING ──────────────────────────────────
        const height = getBuildingHeight(wx, wz)

        // Determine number of tiers (taller buildings get terraced setbacks)
        const tiers = height > 6 ? 3 : height > 3.5 ? 2 : 1
        const colorIndex = noise2D(gx * 5, gz * 5) > 0 ? 0 : 1 // 0=white, 1=grey

        // Base footprint
        let currentWidth = BLOCK_SIZE * 0.85
        let currentY = 0

        for (let tier = 0; tier < tiers; tier++) {
          const tierHeight = height / tiers
          const tierWidth = currentWidth * (1 - tier * 0.15)

          tempMat.compose(
            tempPos.set(wx, currentY + tierHeight / 2, wz),
            tempQuat.identity(),
            tempScale.set(tierWidth, tierHeight, tierWidth)
          )
          buildingTransforms.push({ matrix: tempMat.clone(), colorIndex })

          currentY += tierHeight
          currentWidth = tierWidth
        }

        // Rooftop garden (50% of buildings)
        if (noise2D(gx * 11, gz * 11) > 0) {
          const roofWidth = currentWidth * 0.7
          tempMat.compose(
            tempPos.set(wx, currentY + 0.05, wz),
            tempQuat.identity(),
            tempScale.set(roofWidth, 0.1, roofWidth)
          )
          roofGardenTransforms.push(tempMat.clone())

          // Sometimes add a small tree on the roof
          if (noise2D(gx * 31, gz * 31) > 0.3) {
            const trunkMat = new THREE.Matrix4().compose(
              new THREE.Vector3(wx, currentY + 0.5, wz),
              new THREE.Quaternion(),
              new THREE.Vector3(0.3, 0.7, 0.3)
            )
            const canopyMat = new THREE.Matrix4().compose(
              new THREE.Vector3(wx, currentY + 1.1, wz),
              new THREE.Quaternion(),
              new THREE.Vector3(0.6, 0.6, 0.6)
            )
            treeTransforms.push({ trunkMatrix: trunkMat, canopyMatrix: canopyMat, canopyType: 1 })
          }
        }

        // Street-level planters (along building edges)
        const planterChance = noise2D(gx * 17, gz * 17)
        if (planterChance > 0) {
          const side = planterChance > 0.5 ? 1 : -1
          tempMat.compose(
            tempPos.set(wx + side * (BLOCK_SIZE * 0.5), 0.15, wz),
            tempQuat.identity(),
            tempScale.set(0.5, 0.3, 1.2)
          )
          planterTransforms.push(tempMat.clone())
        }
      }
    }
  }

  // ── Create Instanced Meshes ────────────────────────────
  const cityGroup = new THREE.Group()

  // Buildings (two instanced meshes: white and grey)
  const whiteBldgs = buildingTransforms.filter(b => b.colorIndex === 0)
  const greyBldgs = buildingTransforms.filter(b => b.colorIndex === 1)

  if (whiteBldgs.length > 0) {
    const mesh = new THREE.InstancedMesh(unitBox, buildingMatWhite, whiteBldgs.length)
    whiteBldgs.forEach((b, i) => mesh.setMatrixAt(i, b.matrix))
    mesh.instanceMatrix.needsUpdate = true
    mesh.castShadow = true
    mesh.receiveShadow = true
    cityGroup.add(mesh)
  }

  if (greyBldgs.length > 0) {
    const mesh = new THREE.InstancedMesh(unitBox, buildingMatGrey, greyBldgs.length)
    greyBldgs.forEach((b, i) => mesh.setMatrixAt(i, b.matrix))
    mesh.instanceMatrix.needsUpdate = true
    mesh.castShadow = true
    mesh.receiveShadow = true
    cityGroup.add(mesh)
  }

  // Roof gardens / park grounds
  if (roofGardenTransforms.length > 0) {
    const mesh = new THREE.InstancedMesh(unitBox, greenMat, roofGardenTransforms.length)
    roofGardenTransforms.forEach((m, i) => mesh.setMatrixAt(i, m))
    mesh.instanceMatrix.needsUpdate = true
    mesh.receiveShadow = true
    cityGroup.add(mesh)
  }

  // Trees: trunks
  const trunkGeo = unitCylinder
  if (treeTransforms.length > 0) {
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, greenDarkMat, treeTransforms.length)
    treeTransforms.forEach((t, i) => trunkMesh.setMatrixAt(i, t.trunkMatrix))
    trunkMesh.instanceMatrix.needsUpdate = true
    trunkMesh.castShadow = true
    cityGroup.add(trunkMesh)

    // Canopy: cones
    const coneCanopies = treeTransforms.filter(t => t.canopyType === 0)
    if (coneCanopies.length > 0) {
      const mesh = new THREE.InstancedMesh(unitCone, greenLightMat, coneCanopies.length)
      coneCanopies.forEach((t, i) => mesh.setMatrixAt(i, t.canopyMatrix))
      mesh.instanceMatrix.needsUpdate = true
      mesh.castShadow = true
      cityGroup.add(mesh)
    }

    // Canopy: spheres
    const sphereCanopies = treeTransforms.filter(t => t.canopyType === 1)
    if (sphereCanopies.length > 0) {
      const mesh = new THREE.InstancedMesh(unitSphere, greenMat, sphereCanopies.length)
      sphereCanopies.forEach((t, i) => mesh.setMatrixAt(i, t.canopyMatrix))
      mesh.instanceMatrix.needsUpdate = true
      mesh.castShadow = true
      cityGroup.add(mesh)
    }
  }

  // Planters
  if (planterTransforms.length > 0) {
    const mesh = new THREE.InstancedMesh(unitBox, greenMat, planterTransforms.length)
    planterTransforms.forEach((m, i) => mesh.setMatrixAt(i, m))
    mesh.instanceMatrix.needsUpdate = true
    cityGroup.add(mesh)
  }

  // Roads
  if (roadTransforms.length > 0) {
    const mesh = new THREE.InstancedMesh(unitBox, roadMat, roadTransforms.length)
    roadTransforms.forEach((m, i) => mesh.setMatrixAt(i, m))
    mesh.instanceMatrix.needsUpdate = true
    mesh.receiveShadow = true
    cityGroup.add(mesh)
  }

  scene.add(cityGroup)

  // ── Dispose ───────────────────────────────────────────
  const dispose = () => {
    disposables.forEach(g => g.dispose())
    materials.forEach(m => m.dispose())
    scene.remove(cityGroup)
    scene.remove(groundMesh)
  }

  return { chunks: [], groundMesh, dispose }
}
