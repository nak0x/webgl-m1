import { Scene } from '../scene/Scene.js';
import { Camera } from '../scene/Camera.js';
import { Material } from '../scene/Material.js';
import { Mesh } from '../scene/Mesh.js';
import { AreaLight, PointLight } from '../scene/Light.js';
import { BoxGeometry } from '../geometry/BoxGeometry.js';
import { SphereGeometry } from '../geometry/SphereGeometry.js';
import { PlaneGeometry } from '../geometry/PlaneGeometry.js';

/**
 * ThreeAdapter: converts a Three.js scene + camera into our Scene format
 * using texture-based scene transfer.
 *
 * Supported Three.js types:
 *   Geometries: BoxGeometry, SphereGeometry, PlaneGeometry
 *   Materials:  MeshStandardMaterial, MeshBasicMaterial, MeshPhongMaterial
 *   Lights:     PointLight, RectAreaLight
 */
export class ThreeAdapter {
    /**
     * Convert a Three.js scene and camera to our Scene.
     * @param {THREE.Scene} threeScene
     * @param {THREE.Camera} threeCamera
     * @returns {Scene}
     */
    convert(threeScene, threeCamera) {
        const scene = new Scene();

        // Convert camera
        if (threeCamera) {
            const pos = threeCamera.position;
            const target = threeCamera.getWorldDirection
                ? pos.clone().add(threeCamera.getWorldDirection(new threeCamera.position.constructor()))
                : [0, 0, 0];

            scene.camera = new Camera({
                position: [pos.x, pos.y, pos.z],
                target: target.toArray ? target.toArray() : [0, 0, 0],
                fov: threeCamera.fov || 45
            });
        }

        // Traverse scene graph
        threeScene.traverse((object) => {
            if (object.isMesh) {
                this._convertMesh(object, scene);
            } else if (object.isLight) {
                this._convertLight(object, scene);
            }
        });

        return scene;
    }

    _convertMesh(threeMesh, scene) {
        const geo = this._convertGeometry(threeMesh.geometry, threeMesh);
        if (!geo) return;

        const mat = this._convertMaterial(threeMesh.material);
        const mesh = new Mesh(geo, mat);

        // Extract world position, rotation, scale
        threeMesh.updateWorldMatrix(true, false);
        const pos = threeMesh.position;
        const rot = threeMesh.rotation;

        mesh.setPosition(pos.x, pos.y, pos.z);
        mesh.setRotation(rot.x, rot.y, rot.z);

        // Use uniform scale (average of xyz)
        const s = threeMesh.scale;
        mesh.setScale((s.x + s.y + s.z) / 3.0);

        scene.add(mesh);
    }

    _convertGeometry(threeGeo, threeMesh) {
        const type = threeGeo.type || threeGeo.constructor?.name || '';

        if (type.includes('Box')) {
            const params = threeGeo.parameters || {};
            const w = params.width || 1;
            const h = params.height || 1;
            const d = params.depth || 1;
            return new BoxGeometry(w, h, d);
        }
        else if (type.includes('Sphere')) {
            const params = threeGeo.parameters || {};
            return new SphereGeometry(params.radius || 0.5);
        }
        else if (type.includes('Plane')) {
            return new PlaneGeometry();
        }

        console.warn(`ThreeAdapter: unsupported geometry type "${type}", treating as box`);
        // Fallback: compute bounding box
        if (threeGeo.boundingBox === null) threeGeo.computeBoundingBox();
        if (threeGeo.boundingBox) {
            const bb = threeGeo.boundingBox;
            const size = bb.max.clone().sub(bb.min);
            return new BoxGeometry(size.x, size.y, size.z);
        }
        return new BoxGeometry(1, 1, 1);
    }

    _convertMaterial(threeMat) {
        if (!threeMat) return Material.lambert([0.8, 0.8, 0.8]);

        const color = threeMat.color
            ? [threeMat.color.r, threeMat.color.g, threeMat.color.b]
            : [0.8, 0.8, 0.8];

        const roughness = threeMat.roughness !== undefined ? threeMat.roughness : 0.5;
        const metalness = threeMat.metalness !== undefined ? threeMat.metalness : 0;

        // Emissive
        if (threeMat.emissive && (threeMat.emissive.r > 0 || threeMat.emissive.g > 0 || threeMat.emissive.b > 0)) {
            const intensity = threeMat.emissiveIntensity || 1;
            return Material.emissive(
                [threeMat.emissive.r, threeMat.emissive.g, threeMat.emissive.b],
                intensity
            );
        }

        // Metal vs Lambert
        if (metalness > 0.5) {
            return Material.metal(color, roughness);
        }

        // Check for transparency (glass-like)
        if (threeMat.transparent && threeMat.opacity < 0.5) {
            return Material.glass(color, roughness);
        }

        return Material.lambert(color, roughness);
    }

    _convertLight(threeLight, scene) {
        const pos = threeLight.position;
        const color = threeLight.color
            ? [threeLight.color.r, threeLight.color.g, threeLight.color.b]
            : [1, 1, 1];
        const intensity = threeLight.intensity || 1;

        if (threeLight.isRectAreaLight) {
            scene.add(new AreaLight({
                position: [pos.x, pos.y, pos.z],
                size: [threeLight.width || 1, threeLight.height || 1],
                color,
                intensity
            }));
        } else if (threeLight.isPointLight) {
            scene.add(new PointLight({
                position: [pos.x, pos.y, pos.z],
                color,
                intensity
            }));
        } else {
            // Default: treat as area light
            scene.add(new AreaLight({
                position: [pos.x, pos.y, pos.z],
                color,
                intensity
            }));
        }
    }
}
