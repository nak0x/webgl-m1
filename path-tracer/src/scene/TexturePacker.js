/**
 * TexturePacker: packs Scene data into WebGL float textures
 * for consumption by the path trace shader.
 *
 * Object texture  (width=4, height=N)  — geometry + transform + material ref
 * Material texture (width=2, height=N) — albedo, roughness, emission, type
 * Light texture   (width=3, height=N)  — position, color, size
 */
export class TexturePacker {
    constructor(gl) {
        this.gl = gl;
        this.objectTex = null;
        this.materialTex = null;
        this.lightTex = null;
        this._texDims = { objW: 0, objH: 0, matW: 0, matH: 0, lightW: 0, lightH: 0 };
    }

    /**
     * Pack an entire Scene into GPU textures.
     * @param {Scene} scene
     * @returns {{ objectTex, materialTex, lightTex, numObjects, numMaterials, numLights }}
     */
    pack(scene) {
        const materials = this._collectMaterials(scene);
        this._packObjects(scene, materials);
        this._packMaterials(materials);
        this._packLights(scene);

        return {
            objectTex: this.objectTex,
            materialTex: this.materialTex,
            lightTex: this.lightTex,
            numObjects: scene.meshes.length,
            numMaterials: materials.length,
            numLights: scene.lights.length
        };
    }

    /** Build a deduplicated material list and return index map. */
    _collectMaterials(scene) {
        const seen = new Map();
        const list = [];
        for (const mesh of scene.meshes) {
            if (!seen.has(mesh.material)) {
                seen.set(mesh.material, list.length);
                list.push(mesh.material);
            }
        }
        this._matIndexMap = seen;
        return list;
    }

    /**
     * Object texture layout per object (4 texels):
     *  [0]: type, materialIdx, 0, 0
     *  [1]: posX, posY, posZ, scale
     *  [2]: rotX, rotY, rotZ, 0
     *  [3]: sizeX, sizeY, sizeZ, 0
     */
    _packObjects(scene, materials) {
        const gl = this.gl;
        const n = Math.max(scene.meshes.length, 1);
        const w = 4, h = n;
        const data = new Float32Array(w * h * 4);

        for (let i = 0; i < scene.meshes.length; i++) {
            const mesh = scene.meshes[i];
            const matIdx = this._matIndexMap.get(mesh.material);
            const row = i * w * 4;

            // Texel 0: type, materialIdx
            data[row + 0] = mesh.geometry.type;
            data[row + 1] = matIdx;
            data[row + 2] = 0;
            data[row + 3] = 0;

            // Texel 1: position, scale
            data[row + 4] = mesh.position[0];
            data[row + 5] = mesh.position[1];
            data[row + 6] = mesh.position[2];
            data[row + 7] = mesh.scale;

            // Texel 2: rotation
            data[row + 8]  = mesh.rotation[0];
            data[row + 9]  = mesh.rotation[1];
            data[row + 10] = mesh.rotation[2];
            data[row + 11] = 0;

            // Texel 3: geometry size
            data[row + 12] = mesh.geometry.size[0];
            data[row + 13] = mesh.geometry.size[1];
            data[row + 14] = mesh.geometry.size[2];
            data[row + 15] = 0;
        }

        if (!this.objectTex || this._texDims.objW !== w || this._texDims.objH !== h) {
            if (this.objectTex) this.gl.deleteTexture(this.objectTex);
            this.objectTex = this._createDataTexture(w, h, data);
            this._texDims.objW = w;
            this._texDims.objH = h;
        } else {
            this.updateTexture(this.objectTex, w, h, data);
        }
    }

    /**
     * Material texture layout per material (2 texels):
     *  [0]: albedoR, albedoG, albedoB, roughness
     *  [1]: emitR, emitG, emitB, type
     */
    _packMaterials(materials) {
        const n = Math.max(materials.length, 1);
        const w = 2, h = n;
        const data = new Float32Array(w * h * 4);

        for (let i = 0; i < materials.length; i++) {
            const mat = materials[i];
            const row = i * w * 4;

            data[row + 0] = mat.albedo[0];
            data[row + 1] = mat.albedo[1];
            data[row + 2] = mat.albedo[2];
            data[row + 3] = mat.roughness;

            data[row + 4] = mat.emission[0];
            data[row + 5] = mat.emission[1];
            data[row + 6] = mat.emission[2];
            data[row + 7] = mat.type;
        }

        if (!this.materialTex || this._texDims.matW !== w || this._texDims.matH !== h) {
            if (this.materialTex) this.gl.deleteTexture(this.materialTex);
            this.materialTex = this._createDataTexture(w, h, data);
            this._texDims.matW = w;
            this._texDims.matH = h;
        } else {
            this.updateTexture(this.materialTex, w, h, data);
        }
    }

    /**
     * Light texture layout per light (3 texels):
     *  [0]: posX, posY, posZ, type
     *  [1]: colorR, colorG, colorB, intensity
     *  [2]: sizeX, sizeY, 0, 0
     */
    _packLights(scene) {
        const n = Math.max(scene.lights.length, 1);
        const w = 3, h = n;
        const data = new Float32Array(w * h * 4);

        for (let i = 0; i < scene.lights.length; i++) {
            const light = scene.lights[i];
            const row = i * w * 4;

            data[row + 0] = light.position[0];
            data[row + 1] = light.position[1];
            data[row + 2] = light.position[2];
            data[row + 3] = light.lightType;

            data[row + 4] = light.color[0];
            data[row + 5] = light.color[1];
            data[row + 6] = light.color[2];
            data[row + 7] = light.intensity;

            data[row + 8]  = light.size[0];
            data[row + 9]  = light.size[1];
            data[row + 10] = 0;
            data[row + 11] = 0;
        }

        if (!this.lightTex || this._texDims.lightW !== w || this._texDims.lightH !== h) {
            if (this.lightTex) this.gl.deleteTexture(this.lightTex);
            this.lightTex = this._createDataTexture(w, h, data);
            this._texDims.lightW = w;
            this._texDims.lightH = h;
        } else {
            this.updateTexture(this.lightTex, w, h, data);
        }
    }

    /** Create a RGBA float data texture. */
    _createDataTexture(width, height, data) {
        const gl = this.gl;
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        // WebGL2 requires explicit RGBA32F internal format for float textures
        if (gl instanceof WebGL2RenderingContext) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
        } else {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, data);
        }
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return tex;
    }

    /** Update an existing data texture in place. */
    updateTexture(tex, width, height, data) {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.FLOAT, data);
    }

    destroy() {
        const gl = this.gl;
        if (this.objectTex) gl.deleteTexture(this.objectTex);
        if (this.materialTex) gl.deleteTexture(this.materialTex);
        if (this.lightTex) gl.deleteTexture(this.lightTex);
    }
}
