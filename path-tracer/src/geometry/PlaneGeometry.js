/** Infinite ground plane geometry. */
export class PlaneGeometry {
    constructor() {
        this.type = 2; // 2 = plane
        this.size = [100, 0, 100]; // effectively infinite
    }
}
