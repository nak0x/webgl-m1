import { PathTracer, Scene, Camera, Mesh, Material,
         BoxGeometry, SphereGeometry, AreaLight } from '../../src/index.js';

// ── Setup canvas ──
const canvas = document.getElementById('canvas');
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

window.addEventListener('resize', () => {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    pt.resize(canvas.width, canvas.height);
});

// ── Build scene ──
const scene = new Scene();

// Green box
const box = new Mesh(new BoxGeometry(0.8), Material.lambert([0.1, 0.8, 0.4], 0.9));
scene.add(box);

// Chrome sphere
const sphere = new Mesh(new SphereGeometry(0.4), Material.metal([0.95, 0.95, 0.95], 0.05));
sphere.setPosition(1.2, -0.4, 0.5);
scene.add(sphere);

// Glass sphere
const glass = new Mesh(new SphereGeometry(0.3), Material.glass([1, 1, 1], 0.0));
glass.setPosition(-1.0, -0.5, 0.3);
scene.add(glass);

// Area light
scene.add(new AreaLight({
    position: [2.0, 3.5, 1.0],
    size: [1.5, 1.5],
    color: [1.0, 0.32, 0.05],
    intensity: 12.0
}));

// Camera
scene.camera = new Camera({
    position: [3.0, 2.5, 4.0],
    target: [0.0, 0.0, 0.0],
    fov: 45.0
});

scene.ground = { y: -0.8, color: [0.4, 0.4, 0.4], enabled: true };
scene.sky = { color: [0.04, 0.04, 0.06] };

// ── Create renderer ──
const pt = new PathTracer(canvas, {
    maxBounces: 8,
    temporal: true,
    denoise: true,
    exposure: 1.1,
    gamma: 2.2,
    minSamplesPerFrame: 16,
});

// ── Animation ──
let rotation = 0;
const sppLabel = document.getElementById('spp-count');
const shapeLabel = document.getElementById('shape-count');
if (shapeLabel) shapeLabel.textContent = scene.meshes.length;

function animate() {
    rotation += 0.01;
    box.setRotation(0, rotation, 0);

    const frame = pt.render(scene);
    if (sppLabel) sppLabel.textContent = frame;

    requestAnimationFrame(animate);
}

animate();