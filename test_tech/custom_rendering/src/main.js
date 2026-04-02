import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createMossyCellShadeMaterial, createOutlineMaterial } from './materials.js';
import { createEnvironment } from './environment.js';

// ── Renderer ───────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.setClearColor(0xFAF0E6);
document.body.appendChild(renderer.domElement);

// ── Scene ──────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xFAF0E6);

// ── Camera ─────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(10, 7, 10);
camera.lookAt(0, 0, 0);

// ── Controls ───────────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 1, 0);
controls.minDistance = 3;
controls.maxDistance = 50;
controls.maxPolarAngle = Math.PI * 0.48;
controls.mouseButtons = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.PAN,
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Shift') controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
});
document.addEventListener('keyup', (e) => {
  if (e.key === 'Shift') controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
});

// ── Shared light ───────────────────────────────────────────────────
const lightDirection = new THREE.Vector3(1, 1.5, 0.8).normalize();

// ── Materials ──────────────────────────────────────────────────────
const mossyMat = createMossyCellShadeMaterial(lightDirection);
const outlineMat = createOutlineMaterial();

// ── Environment ────────────────────────────────────────────────────
const { meshes, outlines } = createEnvironment(mossyMat, outlineMat);
meshes.forEach((m) => scene.add(m));
outlines.forEach((o) => scene.add(o));

console.log(`[Scene] ${meshes.length} meshes with unified mossy cell-shade material`);

// ── Resize ─────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Fade hint
setTimeout(() => {
  const h = document.getElementById('controls-hint');
  if (h) h.classList.add('fade');
}, 5000);

// ── Animate ────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  mossyMat.uniforms.time.value = clock.getElapsedTime();
  renderer.render(scene, camera);
}

animate();
