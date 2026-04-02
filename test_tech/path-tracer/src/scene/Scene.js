/**
 * Scene graph container. Holds meshes, lights, camera, and ground plane config.
 */
export class Scene {
    constructor() {
        this.meshes = [];
        this.lights = [];
        this.camera = null;
        this.ground = { y: -0.8, color: [0.4, 0.4, 0.4], enabled: true };
        this.sky = { color: [0.02, 0.02, 0.04] };
    }

    add(object) {
        if (object._type === 'mesh') {
            this.meshes.push(object);
        } else if (object._type === 'light') {
            this.lights.push(object);
        }
        return this;
    }

    remove(object) {
        if (object._type === 'mesh') {
            const idx = this.meshes.indexOf(object);
            if (idx !== -1) this.meshes.splice(idx, 1);
        } else if (object._type === 'light') {
            const idx = this.lights.indexOf(object);
            if (idx !== -1) this.lights.splice(idx, 1);
        }
        return this;
    }

    get objectCount() {
        return this.meshes.length + (this.ground.enabled ? 1 : 0);
    }
}
