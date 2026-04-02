import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

/**
 * Barrel Distortion / Wide-Angle Lens Shader
 * Subtle fisheye effect that curves edges for a stylized immersive look,
 * similar to wide-angle third-person game cameras.
 */
const BarrelDistortionShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uStrength: { value: 0.35 },    // Distortion strength (0 = none, ~0.3-0.5 = subtle, 1.0 = heavy)
    uAspect: { value: 1.0 },
    uCurvature: { value: 0.6 },    // How rounded the barrel effect is
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    uniform float uAspect;
    uniform float uCurvature;
    varying vec2 vUv;

    vec2 barrelDistort(vec2 uv, float k) {
      // Center UV at origin
      vec2 centered = uv - 0.5;
      centered.x *= uAspect;
      
      float r2 = dot(centered, centered);
      float r4 = r2 * r2;
      
      // Brown-Conrady barrel distortion model
      float distortion = 1.0 + k * r2 + k * uCurvature * r4;
      
      centered *= distortion;
      centered.x /= uAspect;
      
      return centered + 0.5;
    }

    void main() {
      // When strength is 0, pass through
      if (uStrength < 0.001) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }

      vec2 distortedUV = barrelDistort(vUv, uStrength);
      
      // Subtle vignette darkening at edges (common in wide-angle lenses)
      vec2 vigUV = vUv - 0.5;
      float vignette = 1.0 - dot(vigUV, vigUV) * 0.6;
      vignette = smoothstep(0.2, 1.0, vignette);
      
      // Check bounds — if UV goes out of range, show black edge
      if (distortedUV.x < 0.0 || distortedUV.x > 1.0 || distortedUV.y < 0.0 || distortedUV.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }

      vec4 color = texture2D(tDiffuse, distortedUV);
      color.rgb *= vignette;
      gl_FragColor = color;
    }
  `,
}

export interface LensEffect {
  composer: EffectComposer
  shaderPass: ShaderPass
  enabled: boolean
  toggle: () => void
  setStrength: (s: number) => void
  resize: (w: number, h: number) => void
  render: () => void
}

export function useLensEffect(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera
): LensEffect {
  const composer = new EffectComposer(renderer)

  const renderPass = new RenderPass(scene, camera)
  composer.addPass(renderPass)

  const shaderPass = new ShaderPass(BarrelDistortionShader)
  shaderPass.enabled = false
  composer.addPass(shaderPass)

  let enabled = false

  const toggle = () => {
    enabled = !enabled
    shaderPass.enabled = enabled
    if (enabled) {
      (shaderPass.uniforms as any).uStrength.value = 0.35
    }
  }

  const setStrength = (s: number) => {
    (shaderPass.uniforms as any).uStrength.value = s
  }

  const resize = (w: number, h: number) => {
    composer.setSize(w, h)
    ;(shaderPass.uniforms as any).uAspect.value = w / h
  }

  const render = () => {
    if (enabled) {
      composer.render()
    } else {
      renderer.render(scene, camera)
    }
  }

  return { composer, shaderPass, enabled, toggle, setStrength, resize, render }
}
