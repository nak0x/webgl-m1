import * as THREE from 'three';

// Shared GLSL noise functions
const NOISE_GLSL = /* glsl */ `
  float hash(float n) { return fract(sin(n) * 43758.5453123); }

  float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n = i.x + i.y * 157.0 + i.z * 113.0;
    return mix(
      mix(mix(hash(n), hash(n+1.0), f.x),
          mix(hash(n+157.0), hash(n+158.0), f.x), f.y),
      mix(mix(hash(n+113.0), hash(n+114.0), f.x),
          mix(hash(n+270.0), hash(n+271.0), f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise3D(p);
      p *= 2.1; a *= 0.48;
    }
    return v;
  }

  float fbm3(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * noise3D(p);
      p *= 2.1; a *= 0.48;
    }
    return v;
  }

  float mossDensityRaw(vec3 wPos) {
    float n1 = fbm(wPos * 0.45);
    float n2 = fbm3(wPos * 1.2 + vec3(97.0, 43.0, 71.0));
    float raw = n1 * 0.6 + n2 * 0.4;
    return raw > 0.46 ? pow((raw - 0.46) / 0.54, 0.9) : 0.0;
  }

  float computeDensity(vec3 wPos, vec3 wNorm) {
    float d = mossDensityRaw(wPos);
    float upBias = max(dot(wNorm, vec3(0.0, 1.0, 0.0)), 0.0);
    d *= 0.2 + upBias * 0.8;
    float groundBoost = 1.0 - smoothstep(0.0, 0.6, wPos.y);
    d = min(1.0, d + groundBoost * 0.08);
    return d;
  }
`;

// ── Unified Mossy Cell-Shade Material ──────────────────────────────
export function createMossyCellShadeMaterial(lightDirection) {
  return new THREE.ShaderMaterial({
    uniforms: {
      lightDirection: { value: lightDirection },
      time: { value: 0 },
      mossHeight: { value: 0.08 },
    },
    vertexShader: /* glsl */ `
      uniform float time;
      uniform float mossHeight;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec2 vUv;

      ${NOISE_GLSL}

      void main() {
        vUv = uv;
        vec4 wPos = modelMatrix * vec4(position, 1.0);
        vec3 wNorm = normalize(mat3(modelMatrix) * normal);

        float density = computeDensity(wPos.xyz, wNorm);

        // Vertex displacement for mossy mounds
        if (density > 0.05) {
          float dn = noise3D(wPos.xyz * 6.0);
          float disp = density * density * mossHeight * (0.3 + dn * 0.7);
          wPos.xyz += wNorm * disp;
        }

        vWorldPos = wPos.xyz;
        vWorldNormal = wNorm;
        gl_Position = projectionMatrix * viewMatrix * wPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 lightDirection;
      uniform float time;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec2 vUv;

      ${NOISE_GLSL}

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 L = normalize(lightDirection);
        float NdotL = dot(N, L);

        // ── Per-fragment moss density (crisp organic edges) ──
        float density = computeDensity(vWorldPos, N);
        float edgeNoise = fbm3(vWorldPos * 10.0) * 0.18;
        float mossEdge = smoothstep(0.15, 0.35, density + edgeNoise);

        // ── Cell shading (white areas) ──
        float shade = floor(NdotL * 4.0 + 0.5) / 4.0;
        shade = clamp(shade, 0.2, 1.0);
        vec3 cellColor = vec3(mix(0.92, 1.0, shade));

        // Rim
        vec3 V = normalize(cameraPosition - vWorldPos);
        float rim = smoothstep(0.55, 1.0, 1.0 - max(dot(N, V), 0.0)) * 0.05;
        cellColor += rim;

        // Grid lines on white surfaces
        float gs = 2.5;
        float gx = abs(fract(vWorldPos.x / gs + 0.5) - 0.5);
        float gy = abs(fract(vWorldPos.y / gs + 0.5) - 0.5);
        float gz = abs(fract(vWorldPos.z / gs + 0.5) - 0.5);
        float gridVal = min(min(gx, gz), gy);
        float gridLine = smoothstep(0.0, 0.012, gridVal);
        cellColor *= mix(0.84, 1.0, gridLine);

        // Fade grid where moss is
        cellColor = mix(cellColor, vec3(mix(0.92, 1.0, shade)), mossEdge);

        // ── Moss carpet texture ──
        float mf1 = fbm(vWorldPos * 18.0);
        float mf2 = fbm3(vWorldPos * 42.0 + vec3(100.0));
        float mossTex = mf1 * 0.55 + mf2 * 0.45;

        vec3 darkMoss   = vec3(0.04, 0.13, 0.02);
        vec3 midMoss    = vec3(0.13, 0.34, 0.06);
        vec3 brightMoss = vec3(0.28, 0.54, 0.13);
        vec3 lightMoss  = vec3(0.38, 0.62, 0.19);

        vec3 mossColor;
        if (mossTex < 0.3) mossColor = mix(darkMoss, midMoss, mossTex / 0.3);
        else if (mossTex < 0.65) mossColor = mix(midMoss, brightMoss, (mossTex - 0.3) / 0.35);
        else mossColor = mix(brightMoss, lightMoss, (mossTex - 0.65) / 0.35);

        // Smooth natural lighting
        float mossDiff = max(NdotL, 0.0) * 0.45 + 0.55;
        float sss = max(dot(-N, L), 0.0) * 0.08;
        float skyAO = N.y * 0.5 + 0.5;
        mossColor *= (mossDiff + sss) * (0.75 + skyAO * 0.25);
        mossColor *= 0.6 + density * 0.4;

        // ── Blend ──
        vec3 finalColor = mix(cellColor, mossColor, mossEdge);
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
    side: THREE.FrontSide,
    depthWrite: true,
    depthTest: true,
  });
}

// ── Outline Material (thin, refined) ───────────────────────────────
export function createOutlineMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      outlineWidth: { value: 0.012 },
    },
    vertexShader: /* glsl */ `
      uniform float outlineWidth;
      void main() {
        vec3 pos = position + normal * outlineWidth;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      void main() {
        gl_FragColor = vec4(vec3(0.08), 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: true,
    depthTest: true,
  });
}
