export const commonGLSL = `
// ──── Constants ────
const float PI = 3.14159265359;
const float TWO_PI = 6.28318530718;
const float INF = 1e20;
const float EPS = 0.001;

// ──── Structs ────
struct Ray { vec3 origin; vec3 dir; };
struct Hit {
    float t;
    vec3 normal;
    int id;      // object index (-1 = ground, -2 = none)
    int matIdx;  // material index
};

// ──── RNG ────
float _rng_state;

float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float rand() {
    _rng_state = fract(sin(_rng_state * 78.233 + 12.9898) * 43758.5453);
    return _rng_state;
}

void initRng(vec2 fragCoord, float frame) {
    _rng_state = hash(fragCoord + frame * 1.61803398875);
    rand(); rand();
}

// ──── Rotation helpers ────
vec2 rotY(vec2 p, float a) {
    float c = cos(a), s = sin(a);
    return vec2(c * p.x + s * p.y, -s * p.x + c * p.y);
}

vec3 toLocal(vec3 p, vec3 rot) {
    vec2 xz = rotY(p.xz, -rot.y);
    return vec3(xz.x, p.y, xz.y);
}

vec3 toWorld(vec3 p, vec3 rot) {
    vec2 xz = rotY(p.xz, rot.y);
    return vec3(xz.x, p.y, xz.y);
}

// ──── Sampling ────
vec3 cosineHemisphere(vec3 n) {
    float u1 = rand(), u2 = rand();
    float r = sqrt(u1);
    float theta = TWO_PI * u2;
    vec3 w = n;
    vec3 u = normalize(cross(abs(w.x) > 0.1 ? vec3(0,1,0) : vec3(1,0,0), w));
    vec3 v = cross(w, u);
    return normalize(u * r * cos(theta) + v * r * sin(theta) + w * sqrt(1.0 - u1));
}

// ──── Data texture helpers ────
vec4 fetchTexel(sampler2D tex, int col, int row, float texW, float texH) {
    vec2 uv = vec2((float(col) + 0.5) / texW, (float(row) + 0.5) / texH);
    return texture2D(tex, uv);
}
`;
