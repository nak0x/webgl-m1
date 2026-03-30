/**
 * Material types for path tracing.
 *
 * Types:
 *  0 = Lambertian (diffuse)
 *  1 = Metal (reflective with roughness)
 *  2 = Dielectric (glass, refraction + reflection)
 *  3 = Emissive (light source)
 */
export class Material {
    constructor({ albedo = [0.8, 0.8, 0.8], roughness = 0.5, emission = [0, 0, 0], type = 0 } = {}) {
        this.albedo = [...albedo];
        this.roughness = roughness;
        this.emission = [...emission];
        this.type = type; // 0=lambert, 1=metal, 2=glass, 3=emissive
    }

    // ── Factory methods ──

    static lambert(albedo, roughness = 0.8) {
        return new Material({ albedo, roughness, type: 0 });
    }

    static metal(albedo, roughness = 0.1) {
        return new Material({ albedo, roughness, type: 1 });
    }

    static glass(albedo = [1, 1, 1], roughness = 0.0) {
        return new Material({ albedo, roughness, type: 2 });
    }

    static emissive(color, intensity = 1.0) {
        return new Material({
            albedo: [0, 0, 0],
            emission: [color[0] * intensity, color[1] * intensity, color[2] * intensity],
            type: 3
        });
    }
}
