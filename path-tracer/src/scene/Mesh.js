/**
 * Mesh: geometry + material + transform.
 */
export class Mesh {
    constructor(geometry, material) {
        this._type = 'mesh';
        this.geometry = geometry;
        this.material = material;
        this.position = [0, 0, 0];
        this.rotation = [0, 0, 0]; // Euler angles in radians
        this.scale = 1.0;
    }

    setPosition(x, y, z) {
        this.position = [x, y, z];
        return this;
    }

    setRotation(x, y, z) {
        this.rotation = [x, y, z];
        return this;
    }

    setScale(s) {
        this.scale = s;
        return this;
    }
}
