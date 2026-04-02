import * as THREE from 'three';

/**
 * Create environment: subdivided ground + cube piles.
 * Subdivisions allow vertex displacement for mossy mounds.
 */
export function createEnvironment(mossyMaterial, outlineMaterial) {
  const meshes = [];
  const outlines = [];

  // ── Ground (subdivided for displacement) ─────────────────────────
  const groundGeo = new THREE.PlaneGeometry(30, 30, 80, 80);
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, mossyMaterial);
  ground.renderOrder = 0;
  meshes.push(ground);

  const groundOut = new THREE.Mesh(groundGeo, outlineMaterial);
  groundOut.renderOrder = 0;
  outlines.push(groundOut);

  // ── Cube piles (subdivided for displacement) ─────────────────────
  const pileCount = 10 + Math.floor(Math.random() * 5);

  for (let p = 0; p < pileCount; p++) {
    const px = (Math.random() - 0.5) * 20;
    const pz = (Math.random() - 0.5) * 20;
    const cubesInPile = 1 + Math.floor(Math.random() * 4);
    let currentY = 0;

    for (let c = 0; c < cubesInPile; c++) {
      const w = 0.5 + Math.random() * 1.6;
      const h = 0.3 + Math.random() * 1.0;
      const d = 0.5 + Math.random() * 1.6;

      // Subdivide proportional to size for displacement resolution
      const sx = Math.max(4, Math.ceil(w * 5));
      const sy = Math.max(4, Math.ceil(h * 5));
      const sz = Math.max(4, Math.ceil(d * 5));
      const geo = new THREE.BoxGeometry(w, h, d, sx, sy, sz);

      const cube = new THREE.Mesh(geo, mossyMaterial);
      cube.position.set(
        px + (Math.random() - 0.5) * 0.3,
        currentY + h / 2,
        pz + (Math.random() - 0.5) * 0.3,
      );
      cube.rotation.y = Math.random() * Math.PI * 0.3;
      cube.renderOrder = 0;
      cube.updateMatrixWorld(true);
      meshes.push(cube);

      const outline = new THREE.Mesh(geo, outlineMaterial);
      outline.position.copy(cube.position);
      outline.rotation.copy(cube.rotation);
      outline.renderOrder = 0;
      outlines.push(outline);

      currentY += h * (0.85 + Math.random() * 0.15);
    }
  }

  return { meshes, outlines };
}
