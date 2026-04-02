export const pathtraceFragGLSL = `
precision highp float;
varying vec2 vUv;

// Frame
uniform float uFrame;
uniform vec2 uResolution;

// Config
uniform int uMaxBounces;
uniform int uRRStart;
uniform float uRRProb;

// Camera
uniform vec3 uCamPos;
uniform vec3 uCamTarget;
uniform vec3 uCamUp;
uniform float uFov;

// Scene data textures
uniform sampler2D uObjectTex;
uniform sampler2D uMaterialTex;
uniform sampler2D uLightTex;
uniform int uNumObjects;
uniform int uNumMaterials;
uniform int uNumLights;

// Ground
uniform float uGroundEnabled;
uniform float uGroundY;
uniform vec3 uGroundColor;

// Sky
uniform vec3 uSkyColor;

// #include "common"
// #include "intersection"
// #include "camera"
// #include "materials"
// #include "lighting"

float g_hitDepth;

vec3 pathTrace(Ray ray) {
    vec3 radiance = vec3(0.0);
    vec3 throughput = vec3(1.0);
    g_hitDepth = 0.0;

    for (int i = 0; i < 8; i++) {
        if (i >= uMaxBounces) break;

        Hit hit = traceScene(ray);
        if (hit.id == -2) {
            radiance += throughput * uSkyColor;
            break;
        }

        vec3 hitPos = ray.origin + ray.dir * hit.t;

        // Primary hit depth (sign encodes type)
        if (i == 0) {
            g_hitDepth = hit.id >= 0 ? hit.t : -hit.t;
        }

        // Get material
        MatData mat;
        if (hit.id == -1) {
            // Ground
            mat.albedo = groundAlbedo(hitPos);
            mat.roughness = 0.8;
            mat.emission = vec3(0.0);
            mat.type = 0.0;
        } else {
            mat = getMaterial(hit.matIdx);
        }

        // Emissive hit
        if (int(mat.type + 0.5) == 3) {
            radiance += throughput * mat.emission;
            break;
        }

        // NEE
        vec3 directLight = sampleLight(hitPos, hit.normal);
        radiance += throughput * mat.albedo * directLight / PI;

        // Russian Roulette
        if (i >= uRRStart) {
            float survival = max(max(throughput.x, throughput.y), throughput.z);
            survival = clamp(survival, uRRProb, 1.0);
            if (rand() > survival) break;
            throughput /= survival;
        }

        // BRDF bounce
        vec3 newDir = evaluateBRDF(mat, ray.dir, hit.normal, throughput);
        if (length(newDir) < 0.001) break; // emissive absorbed

        ray.origin = hitPos + hit.normal * EPS;
        ray.dir = newDir;
    }

    return radiance;
}

void main() {
    initRng(gl_FragCoord.xy, uFrame);
    Ray ray = getCameraRay(vUv);
    vec3 color = pathTrace(ray);
    gl_FragColor = vec4(color, g_hitDepth);
}
`;
