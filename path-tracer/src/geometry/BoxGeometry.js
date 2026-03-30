/** Box geometry (AABB). */
export class BoxGeometry {
    constructor(sizeX = 1, sizeY, sizeZ) {
        this.type = 1; // 1 = box
        this.size = [sizeX, sizeY ?? sizeX, sizeZ ?? sizeX];
    }
}
