---
name: write-shader
description: Écrit ou modifie un ShaderMaterial Three.js (GLSL, uniforms, varyings, includes). Se déclenche sur édition de fichiers .glsl ou de code manipulant ShaderMaterial/RawShaderMaterial.
---

# Écrire un shader Three.js

Procédure et conventions pour ajouter un shader custom dans le projet. Three.js r183 (voir `@.claude/rules/stack-constraints.md`).

## Structure minimale ShaderMaterial

```js
import { ShaderMaterial, Uniform } from 'three'

const material = new ShaderMaterial({
  uniforms: {
    uTime: new Uniform(0),
    uColor: new Uniform(new Color(0xffffff)),
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform vec3 uColor;
    varying vec2 vUv;
    void main() {
      gl_FragColor = vec4(uColor, 1.0);
    }
  `,
})
```

## Règles

- **Precision** : ne jamais hardcoder `precision highp float` — Three.js l'injecte. Exception : `RawShaderMaterial` (déconseillé ici).
- **Uniforms** : toujours `new Uniform(value)`, jamais `{ value: ... }` direct (plus stable sur les versions récentes).
- **Varyings** : préfixe `v` (`vUv`, `vNormal`, `vWorldPosition`).
- **Attributes built-in** : `position`, `normal`, `uv` injectés par Three — ne pas les redéclarer dans `RawShaderMaterial`.
- **Espace de travail** : toujours préciser (world, view, clip) dans le nom du varying (`vWorldPosition`, `vViewPosition`).

## Includes Three.js

Pour les utilitaires (PBR, tone mapping, fog) utiliser `ShaderChunk` :
```glsl
#include <common>
#include <fog_pars_fragment>
#include <tonemapping_pars_fragment>
```
Injecter dans le bon ordre (voir `ShaderChunk` dans `node_modules/three/src/renderers/shaders/`).

## Update du uniform uTime

Dans l'update loop du module qui possède le matériau :
```js
update(delta) {
  material.uniforms.uTime.value += delta * 0.001 // delta en ms → s
}
```

`Time.delta` du projet est en **ms** (voir `@.claude/rules/architecture.md`).

## Dispose

ShaderMaterial n'est pas géré automatiquement par le garbage collector Three. À appeler dans le `destroy()` du module :
```js
material.dispose()
```

## Pièges spécifiques r183

- `onBeforeCompile` reste l'échappatoire pour customiser les shaders natifs, mais éviter si un `ShaderMaterial` dédié suffit
- `ColorManagement.enabled` est true par défaut — les `uColor` passent en linear. Passer `.convertSRGBToLinear()` si la valeur vient d'un picker sRGB
- Pour le tone mapping ACES (appliqué en post-process dans `Renderer.js`), le fragment shader doit sortir en linear
