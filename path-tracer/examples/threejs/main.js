import * as THREE from 'three';
import { PathTracer } from '../../src/core/PathTracer.js';
import { ThreeAdapter } from '../../src/three/ThreeAdapter.js';

// ── Build a Three.js scene (standard Three.js code) ──
const threeScene = new THREE.Scene();

// Green box
const boxGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
const boxMat = new THREE.MeshStandardMaterial({ color: 0xfecc66, roughness: 0.01, metalness: 1.0 });
const box = new THREE.Mesh(boxGeo, boxMat);
threeScene.add(box);

// Green box
const boxGeo2 = new THREE.BoxGeometry(0.8, 0.8, 0.8);
const boxMat2 = new THREE.MeshStandardMaterial({ color: 0x1acc66, roughness: 0.01, metalness: 1.0 });
const box2 = new THREE.Mesh(boxGeo2, boxMat2);
box2.position.set(-1.2, 0.4, 0.5);
threeScene.add(box2);

// Chrome sphere
const sphereGeo = new THREE.SphereGeometry(0.4, 32, 32);
const sphereMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.05, metalness: 1.0 });
const sphere = new THREE.Mesh(sphereGeo, sphereMat);
sphere.position.set(1.2, -0.4, 0.5);
threeScene.add(sphere);

// Area light
const light = new THREE.RectAreaLight(0xffffff, 64, 1.5, 1.5);
light.position.set(2, 3.5, 1);
threeScene.add(light);

// Three.js camera
const threeCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
threeCamera.position.set(3, 2.5, 4);
threeCamera.lookAt(0, 0, 0);

// ── Convert to path tracer scene ──
const adapter = new ThreeAdapter();
const ptScene = adapter.convert(threeScene, threeCamera);
ptScene.ground = { y: -0.8, color: [0.1, 0.1, 0.1], enabled: true };
ptScene.sky = { color: [0.4, 0.4, 0.6] };

// ── Path trace ──
const canvas = document.getElementById('canvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const pt = new PathTracer(canvas, {
    maxBounces: 8,
    temporal: true,
    denoise: true,
    exposure: 0.7,
    gamma: 2.2,
    minSamplesPerFrame: 512,
    renderScale: 0.2,
    filterMode: 'trilinear',
});

const sppEl = document.getElementById('spp');
let rotation = 0;

// --- Live Camera Controls ---
let isLiveCamera = false;
const keys = { w: false, a: false, s: false, d: false, ' ': false, shift: false };
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
euler.setFromQuaternion(threeCamera.quaternion);

document.addEventListener('click', () => {
    if (!isLiveCamera) {
        document.body.requestPointerLock();
    }
});

document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = true;
});

document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = false;
});

document.addEventListener('pointerlockchange', () => {
    isLiveCamera = (document.pointerLockElement === document.body);
});

document.addEventListener('mousemove', (e) => {
    if (!isLiveCamera) return;
    euler.y -= e.movementX * 0.002;
    euler.x -= e.movementY * 0.002;
    euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, euler.x));
    threeCamera.quaternion.setFromEuler(euler);
});

window.addEventListener('resize', () => {
    threeCamera.aspect = window.innerWidth / window.innerHeight;
    threeCamera.updateProjectionMatrix();
    pt.resize(window.innerWidth, window.innerHeight);
});

function animate() {
    // Rotate the box in the path tracer scene
    rotation += 0.1;
    ptScene.meshes[0].setRotation(0, rotation, 0);
    ptScene.meshes[1].setRotation(0, -rotation / 3, 0);

    let cameraMoved = false;

    if (isLiveCamera) {
        const speed = 0.05;
        const forward = new THREE.Vector3();
        threeCamera.getWorldDirection(forward);
        
        const right = new THREE.Vector3().crossVectors(forward, threeCamera.up).normalize();

        const moveForward = forward.clone();
        moveForward.y = 0;
        moveForward.normalize();

        const oldPos = threeCamera.position.clone();

        if (keys.w) threeCamera.position.addScaledVector(moveForward, speed);
        if (keys.s) threeCamera.position.addScaledVector(moveForward, -speed);
        if (keys.a) threeCamera.position.addScaledVector(right, -speed);
        if (keys.d) threeCamera.position.addScaledVector(right, speed);
        if (keys[' ']) threeCamera.position.y += speed;
        if (keys.shift) threeCamera.position.y -= speed;

        threeCamera.updateMatrixWorld();
        
        if (!oldPos.equals(threeCamera.position) || euler.x !== threeCamera.rotation.x || euler.y !== threeCamera.rotation.y) {
            cameraMoved = true;
        }

        const target = new THREE.Vector3();
        threeCamera.getWorldDirection(target);
        target.add(threeCamera.position);

        ptScene.camera.position = [threeCamera.position.x, threeCamera.position.y, threeCamera.position.z];
        ptScene.camera.target = [target.x, target.y, target.z];
    } else {
        const oldPos = ptScene.camera.position.slice();
        
        // Use static camera parameters
        ptScene.camera.position = [3, 2.5, 4];
        ptScene.camera.target = [0, 0, 0];

        // Reset accumulation if we just snapped back to static
        if (oldPos[0] !== 3 || oldPos[1] !== 2.5 || oldPos[2] !== 4) {
            pt.resetAccumulation();
        }
    }

    if (cameraMoved) {

        pt.resetAccumulation();
    }

    const frame = pt.render(ptScene);
    sppEl.textContent = frame;
    requestAnimationFrame(animate);
}

animate();
