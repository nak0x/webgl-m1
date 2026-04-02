export const cameraGLSL = `
Ray getCameraRay(vec2 uv) {
    vec2 jitter = (vec2(rand(), rand()) - 0.5) / uResolution;
    uv += jitter;
    vec3 forward = normalize(uCamTarget - uCamPos);
    vec3 right = normalize(cross(forward, uCamUp));
    vec3 up = cross(right, forward);
    float aspect = uResolution.x / uResolution.y;
    float fovScale = tan(uFov * PI / 360.0);
    vec2 screen = (uv * 2.0 - 1.0) * vec2(aspect, 1.0) * fovScale;
    Ray ray;
    ray.origin = uCamPos;
    ray.dir = normalize(forward + screen.x * right + screen.y * up);
    return ray;
}

vec3 getCameraRayDir(vec2 uv) {
    vec3 forward = normalize(uCamTarget - uCamPos);
    vec3 right = normalize(cross(forward, uCamUp));
    vec3 up = cross(right, forward);
    float aspect = uResolution.x / uResolution.y;
    float fovScale = tan(uFov * PI / 360.0);
    vec2 screen = (uv * 2.0 - 1.0) * vec2(aspect, 1.0) * fovScale;
    return normalize(forward + screen.x * right + screen.y * up);
}

vec2 projectToScreen(vec3 worldPos) {
    vec3 forward = normalize(uCamTarget - uCamPos);
    vec3 right = normalize(cross(forward, uCamUp));
    vec3 up = cross(right, forward);
    vec3 toPoint = worldPos - uCamPos;
    float z = dot(toPoint, forward);
    if (z <= 0.0) return vec2(-1.0);
    float x = dot(toPoint, right);
    float y = dot(toPoint, up);
    float aspect = uResolution.x / uResolution.y;
    float fovScale = tan(uFov * PI / 360.0);
    vec2 ndc = vec2(x / (z * fovScale * aspect), y / (z * fovScale));
    return ndc * 0.5 + 0.5;
}
`;
