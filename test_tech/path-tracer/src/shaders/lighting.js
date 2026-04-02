export const lightingGLSL = `
// ──── NEE: sample one light from texture ────
vec3 sampleLight(vec3 hitPos, vec3 hitNormal) {
    if (uNumLights < 1) return vec3(0.0);

    // Pick a random light
    int li = int(rand() * float(uNumLights));
    if (li >= uNumLights) li = uNumLights - 1;

    vec4 lPos   = fetchTexel(uLightTex, 0, li, 3.0, float(uNumLights));
    vec4 lColor = fetchTexel(uLightTex, 1, li, 3.0, float(uNumLights));
    vec4 lSize  = fetchTexel(uLightTex, 2, li, 3.0, float(uNumLights));

    int lightType = int(lPos.w + 0.5);
    vec3 lightPos = lPos.xyz;
    vec3 lightCol = lColor.rgb;
    float intensity = lColor.w;
    vec2 areaSize = lSize.xy;

    vec3 lightPoint;
    if (lightType == 0) {
        // Area light
        float u = rand() - 0.5;
        float v = rand() - 0.5;
        lightPoint = lightPos + vec3(u * areaSize.x, 0.0, v * areaSize.y);
    } else {
        // Point light
        lightPoint = lightPos;
    }

    vec3 toLight = lightPoint - hitPos;
    float dist = length(toLight);
    vec3 dir = toLight / dist;

    float NdotL = dot(hitNormal, dir);
    if (NdotL <= 0.0) return vec3(0.0);

    // Shadow ray
    Ray shadowRay;
    shadowRay.origin = hitPos + hitNormal * EPS;
    shadowRay.dir = dir;
    Hit shadowHit = traceScene(shadowRay);
    if (shadowHit.t < dist - EPS) return vec3(0.0);

    if (lightType == 0) {
        vec3 lightNormal = vec3(0.0, -1.0, 0.0);
        float lightCos = dot(lightNormal, -dir);
        if (lightCos <= 0.0) return vec3(0.0);
        float lightArea = areaSize.x * areaSize.y;
        float pdf = (dist * dist) / (lightCos * lightArea);
        return lightCol * intensity * NdotL / pdf * float(uNumLights);
    } else {
        return lightCol * intensity * NdotL / (dist * dist) * float(uNumLights);
    }
}
`;
