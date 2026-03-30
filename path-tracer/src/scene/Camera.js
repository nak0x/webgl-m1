/**
 * Camera with position, target, and field of view.
 */
export class Camera {
    constructor({ position = [3, 2.5, 4], target = [0, 0, 0], up = [0, 1, 0], fov = 45 } = {}) {
        this.position = [...position];
        this.target = [...target];
        this.up = [...up];
        this.fov = fov;
    }
}
