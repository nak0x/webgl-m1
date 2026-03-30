/**
 * Light sources for path tracing.
 */
export class AreaLight {
    constructor({ position = [0, 3, 0], size = [1, 1], color = [1, 1, 1], intensity = 10 } = {}) {
        this._type = 'light';
        this.lightType = 0; // 0 = area
        this.position = [...position];
        this.size = [...size];
        this.color = [...color];
        this.intensity = intensity;
    }
}

export class PointLight {
    constructor({ position = [0, 3, 0], color = [1, 1, 1], intensity = 10 } = {}) {
        this._type = 'light';
        this.lightType = 1; // 1 = point
        this.position = [...position];
        this.size = [0, 0];
        this.color = [...color];
        this.intensity = intensity;
    }
}
