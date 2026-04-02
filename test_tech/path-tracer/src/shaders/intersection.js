export const intersectionGLSL = `
// ──── Ray-Sphere intersection ────
bool intersectSphere(Ray ray, vec3 center, float radius, out float t, out vec3 normal) {
    vec3 oc = ray.origin - center;
    float b = dot(oc, ray.dir);
    float c = dot(oc, oc) - radius * radius;
    float disc = b * b - c;
    if (disc < 0.0) return false;
    float sq = sqrt(disc);
    t = -b - sq;
    if (t < EPS) { t = -b + sq; if (t < EPS) return false; }
    normal = normalize((ray.origin + ray.dir * t) - center);
    return true;
}

// ──── Ray-AABB intersection ────
bool intersectAABB(Ray ray, vec3 bmin, vec3 bmax, vec3 rot,
                   out float tNear, out vec3 normal) {
    vec3 ro = toLocal(ray.origin, rot);
    vec3 rd = toLocal(ray.dir, rot);
    vec3 invDir = 1.0 / rd;
    vec3 t0 = (bmin - ro) * invDir;
    vec3 t1 = (bmax - ro) * invDir;
    vec3 tmin = min(t0, t1);
    vec3 tmax = max(t0, t1);
    float tN = max(max(tmin.x, tmin.y), tmin.z);
    float tF = min(min(tmax.x, tmax.y), tmax.z);
    if (tN > tF || tF < 0.0) return false;
    tNear = tN > 0.0 ? tN : tF;
    vec3 hitLocal = ro + rd * tNear;
    vec3 center = (bmin + bmax) * 0.5;
    vec3 d = (hitLocal - center) / ((bmax - bmin) * 0.5);
    vec3 absD = abs(d);
    if (absD.x > absD.y && absD.x > absD.z)      normal = vec3(sign(d.x), 0.0, 0.0);
    else if (absD.y > absD.z)                      normal = vec3(0.0, sign(d.y), 0.0);
    else                                           normal = vec3(0.0, 0.0, sign(d.z));
    normal = toWorld(normal, rot);
    return true;
}

// ──── Ray-Ground intersection ────
bool intersectGround(Ray ray, float y, out float t) {
    if (abs(ray.dir.y) < EPS) return false;
    t = (y - ray.origin.y) / ray.dir.y;
    return t > EPS;
}

// ──── Trace all scene objects from data textures ────
Hit traceScene(Ray ray) {
    Hit hit;
    hit.t = INF;
    hit.id = -2;
    hit.matIdx = 0;

    for (int i = 0; i < 64; i++) {
        if (i >= uNumObjects) break;

        vec4 info = fetchTexel(uObjectTex, 0, i, 4.0, float(uNumObjects));
        vec4 pos  = fetchTexel(uObjectTex, 1, i, 4.0, float(uNumObjects));
        vec4 rot  = fetchTexel(uObjectTex, 2, i, 4.0, float(uNumObjects));
        vec4 size = fetchTexel(uObjectTex, 3, i, 4.0, float(uNumObjects));

        int objType = int(info.x + 0.5);
        int matIdx  = int(info.y + 0.5);
        vec3 objPos = pos.xyz;
        float scale = pos.w;
        vec3 objRot = rot.xyz;

        float tHit;
        vec3 nHit;
        bool didHit = false;

        if (objType == 0) {
            // Sphere
            didHit = intersectSphere(ray, objPos, size.x * scale, tHit, nHit);
        } else if (objType == 1) {
            // Box — offset ray to object local origin
            vec3 hs = size.xyz * 0.5 * scale;
            Ray lr;
            lr.origin = ray.origin - objPos;
            lr.dir = ray.dir;
            didHit = intersectAABB(lr, -hs, hs, objRot, tHit, nHit);
        }

        if (didHit && tHit > EPS && tHit < hit.t) {
            hit.t = tHit;
            hit.normal = nHit;
            hit.id = i;
            hit.matIdx = matIdx;
        }
    }

    // Ground plane
    if (uGroundEnabled > 0.5) {
        float tGround;
        if (intersectGround(ray, uGroundY, tGround) && tGround > EPS && tGround < hit.t) {
            hit.t = tGround;
            hit.normal = vec3(0.0, 1.0, 0.0);
            hit.id = -1;
            hit.matIdx = -1;
        }
    }

    return hit;
}
`;
