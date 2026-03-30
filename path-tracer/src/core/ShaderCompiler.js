import { commonGLSL, intersectionGLSL, cameraGLSL, materialsGLSL, lightingGLSL,
         pathtraceFragGLSL, temporalFragGLSL, denoiseFragGLSL, displayFragGLSL,
         quadVertGLSL } from '../shaders/index.js';

const MODULES = {
    common: commonGLSL,
    intersection: intersectionGLSL,
    camera: cameraGLSL,
    materials: materialsGLSL,
    lighting: lightingGLSL
};

/**
 * ShaderCompiler: resolves #include directives and compiles WebGL programs.
 */
export class ShaderCompiler {
    constructor(gl) {
        this.gl = gl;
    }

    /** Resolve // #include "name" directives. */
    resolveIncludes(source) {
        return source.replace(
            /\/\/ #include "(\w+)"/g,
            (_, name) => MODULES[name] || `// ERROR: unknown module "${name}"`
        );
    }

    /** Compile a single shader. */
    compile(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const typeStr = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
            console.error(`${typeStr} shader error:`, gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    /** Create a linked program. */
    createProgram(vertSrc, fragSrc) {
        const gl = this.gl;
        const vs = this.compile(gl.VERTEX_SHADER, vertSrc);
        const fs = this.compile(gl.FRAGMENT_SHADER, this.resolveIncludes(fragSrc));
        if (!vs || !fs) return null;

        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Link error:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }
        return program;
    }

    /** Get uniform locations as an object. */
    getLocations(program, names) {
        const gl = this.gl;
        const locs = {};
        for (const n of names) locs[n] = gl.getUniformLocation(program, n);
        return locs;
    }

    /** Get the vertex shader source. */
    get quadVert() { return quadVertGLSL; }
    get pathtraceFrag() { return pathtraceFragGLSL; }
    get temporalFrag() { return temporalFragGLSL; }
    get denoiseFrag() { return denoiseFragGLSL; }
    get displayFrag() { return displayFragGLSL; }
}
