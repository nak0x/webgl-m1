import { ShaderCompiler } from './ShaderCompiler.js';
import { TexturePacker } from '../scene/TexturePacker.js';

/**
 * PathTracer: the main rendering engine.
 * Manages the 4-pass pipeline: pathtrace → temporal → denoise → display.
 */
export class PathTracer {
    constructor(canvas, options = {}) {
        this.canvas = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;
        // Prefer WebGL2 (supports NPOT mipmaps), fall back to WebGL1
        this.gl = this.canvas.getContext('webgl2')
              || this.canvas.getContext('webgl')
              || this.canvas.getContext('experimental-webgl');
        this.isWebGL2 = this.gl instanceof WebGL2RenderingContext;

        if (!this.gl) throw new Error('WebGL not supported');

        this.options = {
            maxBounces: 3,
            russianRouletteStart: 2,
            russianRouletteProbability: 0.2,
            temporal: true,
            temporalBlendFactor: 0.1,
            denoise: true,
            denoiseColorSigma: 0.15,
            denoiseDepthSigma: 0.5,
            exposure: 1.5,
            gamma: 2.2,
            minSamplesPerFrame: 1,
            renderScale: 1.0,
            filterMode: 'bilinear', // 'bilinear' or 'trilinear'
            ...options
        };

        this.frameCount = 0;
        this._dirty = true;

        this._initExtensions();
        this._initQuad();
        this._compileShaders();
        this._initFramebuffers();

        this.packer = new TexturePacker(this.gl);
    }

    // ── Extensions ──

    _initExtensions() {
        const gl = this.gl;
        if (this.isWebGL2) {
            // WebGL2: float textures are native, need extension for render targets
            this.floatExt = true;
            gl.getExtension('EXT_color_buffer_float');
            gl.getExtension('OES_texture_float_linear');
        } else {
            this.floatExt = gl.getExtension('OES_texture_float');
            gl.getExtension('OES_texture_float_linear');
        }
    }

    // ── Quad ──

    _initQuad() {
        const gl = this.gl;
        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1
        ]), gl.STATIC_DRAW);
    }

    // ── Shaders ──

    _compileShaders() {
        const gl = this.gl;
        const sc = new ShaderCompiler(gl);

        // Path trace
        this.ptProgram = sc.createProgram(sc.quadVert, sc.pathtraceFrag);
        this.ptLoc = sc.getLocations(this.ptProgram, [
            'uFrame', 'uResolution', 'uMaxBounces', 'uRRStart', 'uRRProb',
            'uCamPos', 'uCamTarget', 'uCamUp', 'uFov',
            'uObjectTex', 'uMaterialTex', 'uLightTex',
            'uNumObjects', 'uNumMaterials', 'uNumLights',
            'uGroundEnabled', 'uGroundY', 'uGroundColor', 'uSkyColor'
        ]);
        this.ptAttr = gl.getAttribLocation(this.ptProgram, 'aPosition');

        // Temporal
        this.tempProgram = sc.createProgram(sc.quadVert, sc.temporalFrag);
        this.tempLoc = sc.getLocations(this.tempProgram, [
            'uNewSample', 'uPrevAccum', 'uResolution', 'uBlendFactor'
        ]);
        this.tempAttr = gl.getAttribLocation(this.tempProgram, 'aPosition');

        // Denoise
        this.dnProgram = sc.createProgram(sc.quadVert, sc.denoiseFrag);
        this.dnLoc = sc.getLocations(this.dnProgram, [
            'uInput', 'uResolution', 'uColorSigma', 'uDepthSigma'
        ]);
        this.dnAttr = gl.getAttribLocation(this.dnProgram, 'aPosition');

        // Display
        this.dispProgram = sc.createProgram(sc.quadVert, sc.displayFrag);
        this.dispLoc = sc.getLocations(this.dispProgram, [
            'uTexture', 'uExposure', 'uGamma'
        ]);
        this.dispAttr = gl.getAttribLocation(this.dispProgram, 'aPosition');
    }

    // ── FBOs ──

    _createFBO(w, h, filter = this.gl.NEAREST, useMipmaps = false) {
        const gl = this.gl;
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        if (this.isWebGL2 && this.floatExt) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
        } else {
            const type = this.floatExt ? gl.FLOAT : gl.UNSIGNED_BYTE;
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, type, null);
        }
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER,
            filter === gl.NEAREST ? gl.NEAREST : gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return { fbo, tex, useMipmaps };
    }

    _initFramebuffers() {
        const gl = this.gl;
        const s = this.options.renderScale;
        const iw = Math.round(this.canvas.width * s);
        const ih = Math.round(this.canvas.height * s);
        this._internalW = iw;
        this._internalH = ih;
        this.rawFBO = this._createFBO(iw, ih);
        this.accumFBO = [this._createFBO(iw, ih), this._createFBO(iw, ih)];

        // Trilinear needs mipmaps — WebGL1 requires power-of-two textures
        let trilinear = this.options.filterMode === 'trilinear';
        const isPOT = (iw & (iw - 1)) === 0 && (ih & (ih - 1)) === 0;
        if (trilinear && !this.isWebGL2 && !isPOT) {
            console.warn('PathTracer: trilinear requires POT textures on WebGL1, falling back to bilinear');
            trilinear = false;
        }
        const minFilter = trilinear ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR;
        this.denoisedFBO = this._createFBO(iw, ih, minFilter, trilinear);
        this.accumIdx = 0;
    }

    _destroyFBOs() {
        const gl = this.gl;
        for (const { fbo, tex } of [this.rawFBO, this.accumFBO[0], this.accumFBO[1], this.denoisedFBO]) {
            gl.deleteTexture(tex);
            gl.deleteFramebuffer(fbo);
        }
    }

    // ── Drawing ──

    _drawQuad(attrLoc) {
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.enableVertexAttribArray(attrLoc);
        gl.vertexAttribPointer(attrLoc, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.disableVertexAttribArray(attrLoc);
    }

    // ── Public API ──

    resize(w, h) {
        this.canvas.width = w;
        this.canvas.height = h;
        this._destroyFBOs();
        this._initFramebuffers();
        this.frameCount = 0;
    }

    resetAccumulation() {
        this.frameCount = 0;
    }

    /**
     * Render one frame of the given scene.
     * When minSamplesPerFrame > 1, accumulates that many trace+temporal
     * passes before denoising and displaying (non-realtime mode).
     * @param {Scene} scene
     * @returns {number} total accumulated samples
     */
    render(scene) {
        const gl = this.gl;
        const o = this.options;
        const cw = this.canvas.width, ch = this.canvas.height;
        const w = this._internalW, h = this._internalH;
        const spp = Math.max(1, o.minSamplesPerFrame);

        // Pack scene data into textures
        const packed = this.packer.pack(scene);
        const cam = scene.camera;

        // ── Accumulate N samples ──
        for (let s = 0; s < spp; s++) {
            // Pass 1: Path trace (1 SPP)
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.rawFBO.fbo);
            gl.viewport(0, 0, w, h);
            gl.useProgram(this.ptProgram);

            gl.uniform1f(this.ptLoc.uFrame, this.frameCount);
            gl.uniform2f(this.ptLoc.uResolution, w, h);
            gl.uniform1i(this.ptLoc.uMaxBounces, o.maxBounces);
            gl.uniform1i(this.ptLoc.uRRStart, o.russianRouletteStart);
            gl.uniform1f(this.ptLoc.uRRProb, o.russianRouletteProbability);
            gl.uniform3fv(this.ptLoc.uCamPos, cam.position);
            gl.uniform3fv(this.ptLoc.uCamTarget, cam.target);
            gl.uniform3fv(this.ptLoc.uCamUp, cam.up);
            gl.uniform1f(this.ptLoc.uFov, cam.fov);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, packed.objectTex);
            gl.uniform1i(this.ptLoc.uObjectTex, 0);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, packed.materialTex);
            gl.uniform1i(this.ptLoc.uMaterialTex, 1);
            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, packed.lightTex);
            gl.uniform1i(this.ptLoc.uLightTex, 2);

            gl.uniform1i(this.ptLoc.uNumObjects, packed.numObjects);
            gl.uniform1i(this.ptLoc.uNumMaterials, packed.numMaterials);
            gl.uniform1i(this.ptLoc.uNumLights, packed.numLights);
            gl.uniform1f(this.ptLoc.uGroundEnabled, scene.ground.enabled ? 1.0 : 0.0);
            gl.uniform1f(this.ptLoc.uGroundY, scene.ground.y);
            gl.uniform3fv(this.ptLoc.uGroundColor, scene.ground.color);
            gl.uniform3fv(this.ptLoc.uSkyColor, scene.sky.color);

            this._drawQuad(this.ptAttr);

            // Pass 2: Temporal blend
            if (o.temporal) {
                const read = this.accumIdx;
                const write = 1 - this.accumIdx;
                gl.bindFramebuffer(gl.FRAMEBUFFER, this.accumFBO[write].fbo);
                gl.viewport(0, 0, w, h);
                gl.useProgram(this.tempProgram);

                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, this.rawFBO.tex);
                gl.uniform1i(this.tempLoc.uNewSample, 0);
                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_2D, this.accumFBO[read].tex);
                gl.uniform1i(this.tempLoc.uPrevAccum, 1);
                gl.uniform2f(this.tempLoc.uResolution, w, h);
                gl.uniform1f(this.tempLoc.uBlendFactor, o.temporalBlendFactor);

                this._drawQuad(this.tempAttr);
                this.accumIdx = write;
            }

            this.frameCount++;
        }

        // ── Pass 3: Denoise (once after all samples) ──
        let sourceForDenoise = o.temporal ? this.accumFBO[this.accumIdx] : this.rawFBO;
        let sourceForDisplay = sourceForDenoise;
        if (o.denoise) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.denoisedFBO.fbo);
            gl.viewport(0, 0, w, h);
            gl.useProgram(this.dnProgram);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, sourceForDenoise.tex);
            gl.uniform1i(this.dnLoc.uInput, 0);
            gl.uniform2f(this.dnLoc.uResolution, w, h);
            gl.uniform1f(this.dnLoc.uColorSigma, o.denoiseColorSigma);
            gl.uniform1f(this.dnLoc.uDepthSigma, o.denoiseDepthSigma);

            this._drawQuad(this.dnAttr);
            sourceForDisplay = this.denoisedFBO;

            // Generate mipmaps for trilinear downscaling
            if (this.denoisedFBO.useMipmaps) {
                gl.bindTexture(gl.TEXTURE_2D, this.denoisedFBO.tex);
                gl.generateMipmap(gl.TEXTURE_2D);
            }
        }

        // ── Pass 4: Display (downsamples to canvas size) ──
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, cw, ch);
        gl.useProgram(this.dispProgram);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sourceForDisplay.tex);
        gl.uniform1i(this.dispLoc.uTexture, 0);
        gl.uniform1f(this.dispLoc.uExposure, o.exposure);
        gl.uniform1f(this.dispLoc.uGamma, o.gamma);

        this._drawQuad(this.dispAttr);

        return this.frameCount;
    }

    destroy() {
        this._destroyFBOs();
        this.packer.destroy();
    }
}
