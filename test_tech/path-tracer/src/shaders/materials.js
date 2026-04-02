export const materialsGLSL = `
// ──── Material evaluation ────
// Reads material from texture, evaluates BRDF, returns bounce direction

struct MatData {
    vec3 albedo;
    float roughness;
    vec3 emission;
    float type; // 0=lambert, 1=metal, 2=glass, 3=emissive
};

MatData getMaterial(int matIdx) {
    MatData m;
    if (matIdx < 0) {
        // Ground: checkerboard
        m.albedo = uGroundColor;
        m.roughness = 0.8;
        m.emission = vec3(0.0);
        m.type = 0.0;
        return m;
    }
    vec4 t0 = fetchTexel(uMaterialTex, 0, matIdx, 2.0, float(uNumMaterials));
    vec4 t1 = fetchTexel(uMaterialTex, 1, matIdx, 2.0, float(uNumMaterials));
    m.albedo = t0.rgb;
    m.roughness = t0.a;
    m.emission = t1.rgb;
    m.type = t1.a;
    return m;
}

// Evaluate ground checkerboard pattern
vec3 groundAlbedo(vec3 hitPos) {
    float check = mod(floor(hitPos.x * 2.0) + floor(hitPos.z * 2.0), 2.0);
    return uGroundColor * (0.5 + 0.5 * check);
}

// Returns bounce direction and updates throughput
vec3 evaluateBRDF(MatData mat, vec3 inDir, vec3 normal, inout vec3 throughput) {
    int mtype = int(mat.type + 0.5);

    if (mtype == 0) {
        // Lambertian diffuse
        throughput *= mat.albedo;
        return cosineHemisphere(normal);
    }
    else if (mtype == 1) {
        // Metal
        vec3 reflected = reflect(inDir, normal);
        vec3 perturb = cosineHemisphere(normal);
        vec3 dir = normalize(mix(reflected, perturb, mat.roughness * mat.roughness));
        if (dot(dir, normal) < 0.0) dir = perturb;
        throughput *= mat.albedo;
        return dir;
    }
    else if (mtype == 2) {
        // Dielectric (glass)
        float ior = 1.5;
        vec3 outNormal = normal;
        float eta = 1.0 / ior;
        float cosi = dot(-inDir, normal);
        if (cosi < 0.0) {
            outNormal = -normal;
            eta = ior;
            cosi = -cosi;
        }
        float sint2 = eta * eta * (1.0 - cosi * cosi);
        // Schlick's approximation
        float r0 = ((1.0 - ior) / (1.0 + ior));
        r0 = r0 * r0;
        float fresnel = r0 + (1.0 - r0) * pow(1.0 - cosi, 5.0);

        if (sint2 > 1.0 || rand() < fresnel) {
            // Reflect
            throughput *= mat.albedo;
            return reflect(inDir, outNormal);
        } else {
            // Refract
            throughput *= mat.albedo;
            return refract(inDir, outNormal, eta);
        }
    }
    else {
        // Emissive — no bounce
        return vec3(0.0);
    }
}
`;
