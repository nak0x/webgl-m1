/**
 * createEau
 *
 * Matériau eau avec ShaderMaterial custom.
 *
 * Effets :
 *   — Déplacement de vertex multi-fréquences (vagues animées)
 *   — Effet Fresnel Schlick (translucidité selon l'angle de vue)
 *   — Spéculaire Blinn-Phong (reflet directionnel)
 *
 * Les uniforms `uTime` et `uCameraPos` doivent être mis à jour
 * à chaque frame dans la boucle d'animation :
 *
 *   const { material, uniforms } = createEau()
 *   three.onLoop((time) => {
 *     uniforms.uTime.value = time * 0.001
 *     uniforms.uCameraPos.value.copy(three.camera.position)
 *   })
 */

import * as THREE from 'three'

export function createEau() {
  const uniforms = {
    uTime:      { value: 0 },
    uCameraPos: { value: new THREE.Vector3() },
    uDeepColor: { value: new THREE.Color(0x01172e) },
    uSurfColor: { value: new THREE.Color(0x2fa8c8) },
    uSpecColor: { value: new THREE.Color(0xe8f8ff) },
    uLightDir:  { value: new THREE.Vector3(0.45, 0.78, 0.44).normalize() },
  }

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    side:        THREE.DoubleSide,

    vertexShader: /* glsl */`
      uniform float uTime;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      void main() {
        vec3 pos = position;

        // Vagues multi-fréquences sur la surface
        float d =
            sin(pos.x * 9.0  + uTime * 3.2) * 0.038
          + sin(pos.y * 7.5  + uTime * 2.7) * 0.035
          + cos(pos.z * 11.0 + uTime * 2.1) * 0.028
          + sin((pos.x + pos.z) * 6.0 + uTime * 1.8) * 0.020;
        pos += normal * d;

        vec4 worldPos    = modelMatrix * vec4(pos, 1.0);
        vWorldPos        = worldPos.xyz;
        vWorldNormal     = normalize(mat3(modelMatrix) * normal);

        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,

    fragmentShader: /* glsl */`
      uniform vec3  uCameraPos;
      uniform vec3  uDeepColor;
      uniform vec3  uSurfColor;
      uniform vec3  uSpecColor;
      uniform vec3  uLightDir;
      varying vec3  vWorldNormal;
      varying vec3  vWorldPos;

      void main() {
        vec3  n  = normalize(vWorldNormal);
        vec3  v  = normalize(uCameraPos - vWorldPos);
        float nv = max(dot(n, v), 0.0);

        // Fresnel Schlick (f0 = 0.02 pour l'eau)
        float fresnel = 0.02 + 0.98 * pow(1.0 - nv, 5.0);

        // Couleur eau : mélange profond ↔ surface
        vec3 color = mix(uDeepColor, uSurfColor, fresnel);

        // Spéculaire Blinn-Phong
        vec3  h   = normalize(uLightDir + v);
        float sp  = pow(max(dot(n, h), 0.0), 320.0);
        color    += uSpecColor * sp * 1.8;

        // Alpha : plus opaque en surface (Fresnel élevé)
        float alpha = mix(0.60, 0.92, fresnel);

        gl_FragColor = vec4(color, alpha);
      }
    `,
  })

  return {
    material,
    uniforms,
    dispose() { material.dispose() },
  }
}
