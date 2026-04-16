/**
 * createXray — X-ray uniforme : fill plat + arêtes nettes
 *
 * Pas de Fresnel → pas de "reflet" ni de gradient centre/bords.
 * Le corps est une couleur uniforme translucide.
 * Les arêtes ressortent via dérivées screen-space (discontinuités de normale).
 *
 * Uniforms :
 *   uColor        — couleur de la pièce (état de casse)
 *   uBodyOpacity  — [0–0.5]  opacité uniforme du fill
 *   uEdgeOpacity  — [0–1]    opacité des arêtes détectées
 *   uEdgeBoost    — [1–20]   sensibilité de la détection d'arête
 *   uFresnel      — [0–1]    dose de Fresnel résiduel (0 = aucun reflet)
 */
import * as THREE from 'three'

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal  = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3  uColor;
  uniform float uBodyOpacity;
  uniform float uEdgeOpacity;
  uniform float uEdgeBoost;
  uniform float uFresnel;

  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(vViewDir)));

    // Arêtes screen-space : trait là où la normale change vite
    float ddx  = dFdx(facing);
    float ddy  = dFdy(facing);
    float edge = clamp(length(vec2(ddx, ddy)) * uEdgeBoost, 0.0, 1.0);

    // Optionnel : très légère contribution Fresnel pour différencier les angles
    float rim = pow(1.0 - facing, 4.0) * uFresnel;

    // Alpha : fill uniforme + arête nette + rim optionnel
    float alpha = uBodyOpacity + edge * uEdgeOpacity + rim * 0.2;
    alpha = clamp(alpha, 0.0, 0.88);

    // Couleur : uniforme sur le corps, plus saturée sur les arêtes
    float brightness = mix(0.6, 1.0, clamp(edge * uEdgeOpacity + rim, 0.0, 1.0));
    vec3  color      = uColor * brightness;

    gl_FragColor = vec4(color, alpha);
  }
`

export const XRAY_DEFAULTS = {
  bodyOpacity: 0.12,
  edgeOpacity: 0.85,
  edgeBoost:   8.0,
  fresnel:     0.0,
}

export function createXray(options = {}) {
  const { color = new THREE.Color(0x00ff88) } = options

  const uniforms = {
    uColor:       { value: color.clone() },
    uBodyOpacity: { value: XRAY_DEFAULTS.bodyOpacity },
    uEdgeOpacity: { value: XRAY_DEFAULTS.edgeOpacity },
    uEdgeBoost:   { value: XRAY_DEFAULTS.edgeBoost },
    uFresnel:     { value: XRAY_DEFAULTS.fresnel },
  }

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    side:        THREE.DoubleSide,
    depthWrite:  false,
    depthTest:   false,
    blending:    THREE.NormalBlending,
  })

  material.renderOrder = 1

  return {
    material,
    uniforms,
    setColor(c) { uniforms.uColor.value.copy(c) },
    setParams(p) {
      if (p.bodyOpacity !== undefined) uniforms.uBodyOpacity.value = p.bodyOpacity
      if (p.edgeOpacity !== undefined) uniforms.uEdgeOpacity.value = p.edgeOpacity
      if (p.edgeBoost   !== undefined) uniforms.uEdgeBoost.value   = p.edgeBoost
      if (p.fresnel     !== undefined) uniforms.uFresnel.value     = p.fresnel
    },
    dispose() { material.dispose() },
  }
}
