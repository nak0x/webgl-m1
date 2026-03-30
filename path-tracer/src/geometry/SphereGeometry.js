/** Sphere geometry. */
export class SphereGeometry {
    constructor(radius = 0.5) {
        this.type = 0; // 0 = sphere
        this.size = [radius, radius, radius];
    }
}
