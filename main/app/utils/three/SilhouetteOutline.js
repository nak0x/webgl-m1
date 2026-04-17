/**
 * SilhouetteOutline — contour noir via extrusion par les normales (view-space).
 *
 * Technique utilisée par drei/@react-three/fiber, Unity, Unreal :
 * Chaque vertex est poussé vers l'extérieur selon sa normale en view-space.
 * Avec THREE.BackSide, les faces arrière dépassent du mesh → silhouette nette.
 *
 * Avantages vs scale uniforme :
 *  - Fonctionne sur les objets concaves (pas de remplissage des creux)
 *  - Épaisseur constante quelle que soit la forme du mesh
 *  - Épaisseur en view-space = résultat cohérent quel que soit la distance
 */
import * as THREE from 'three'

const VERT = /* glsl */`
  uniform float uThickness;

  void main() {
    // Extrude en view-space le long des normales
    vec4 viewPos    = modelViewMatrix * vec4(position, 1.0);
    vec3 viewNormal = normalize(normalMatrix * normal);
    viewPos.xyz    += viewNormal * uThickness;
    gl_Position     = projectionMatrix * viewPos;
  }
`

const FRAG = /* glsl */`
  uniform vec3 uColor;

  void main() {
    gl_FragColor = vec4(uColor, 1.0);
  }
`

export default class SilhouetteOutline {
  constructor({ thickness = 0.012, color = 0x000000 } = {}) {
    this._entries  = []
    this._material = new THREE.ShaderMaterial({
      uniforms: {
        uThickness: { value: thickness },
        uColor:     { value: new THREE.Color(color) },
      },
      vertexShader:   VERT,
      fragmentShader: FRAG,
      side:           THREE.BackSide,
    })
  }

  setTarget(object) {
    this._clear()
    if (!object) return

    object.traverse(child => {
      // Ignore les non-meshes, les outline meshes existants, et les meshes sans normales
      if (!child.isMesh)                             return
      if (child.userData.__isOutline)                return
      if (!child.geometry.attributes.normal)         return

      const outline = new THREE.Mesh(child.geometry, this._material)
      outline.userData.__isOutline = true
      outline.renderOrder = -1   // dessiné juste avant le mesh d'origine
      child.add(outline)
      this._entries.push({ mesh: outline, parent: child })
    })
  }

  clear() {
    this._clear()
  }

  _clear() {
    for (const { mesh, parent } of this._entries) {
      parent.remove(mesh)
    }
    this._entries = []
  }

  dispose() {
    this._clear()
    this._material.dispose()
  }
}
