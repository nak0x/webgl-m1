# webgl-pathtracer

A real-time path tracing engine for WebGL with temporal reprojection, bilateral denoising, and **Three.js integration**.

## Features

- **Path tracing** with Monte Carlo sampling and Next Event Estimation
- **Material system** — Lambert, Metal, Glass, Emissive
- **Geometry types** — Box, Sphere, Plane
- **Temporal reprojection** for noise-free animation
- **Bilateral denoiser** — edge-aware spatial filter
- **Texture-based scene** — all objects/materials/lights packed into float textures
- **Three.js adapter** — convert any Three.js scene for path tracing
- **Zero dependencies** — works with raw ES modules, no build step required

## Quick Start

### Standalone

```js
import { PathTracer, Scene, Camera, Mesh, Material,
         BoxGeometry, SphereGeometry, AreaLight } from './src/index.js';

const scene = new Scene();
scene.add(new Mesh(new BoxGeometry(0.8), Material.lambert([0.1, 0.8, 0.4])));
scene.add(new Mesh(new SphereGeometry(0.4), Material.metal([0.95, 0.95, 0.95], 0.05)));
scene.add(new AreaLight({ position: [2, 3.5, 1], intensity: 12 }));
scene.camera = new Camera({ position: [3, 2.5, 4], fov: 45 });

const pt = new PathTracer(canvas, { maxBounces: 3, temporal: true, denoise: true });

function animate() {
    pt.render(scene);
    requestAnimationFrame(animate);
}
animate();
```

### Three.js Integration

```js
import * as THREE from 'three';
import { PathTracer } from './src/core/PathTracer.js';
import { ThreeAdapter } from './src/three/ThreeAdapter.js';

// Standard Three.js scene
const threeScene = new THREE.Scene();
threeScene.add(new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x1acc66, roughness: 0.9 })
));

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(3, 2.5, 4);

// Convert and render
const adapter = new ThreeAdapter();
const ptScene = adapter.convert(threeScene, camera);
const pt = new PathTracer(canvas);
pt.render(ptScene);
```

## Project Structure

```
├── package.json
├── src/
│   ├── index.js                  Public API
│   ├── core/
│   │   ├── PathTracer.js         4-pass render pipeline
│   │   └── ShaderCompiler.js     #include resolution + compilation
│   ├── scene/
│   │   ├── Scene.js              Scene graph
│   │   ├── Camera.js             Camera
│   │   ├── Material.js           Lambert / Metal / Glass / Emissive
│   │   ├── Mesh.js               Geometry + Material + Transform
│   │   ├── Light.js              Area & Point lights
│   │   └── TexturePacker.js      Scene → float textures
│   ├── geometry/
│   │   ├── BoxGeometry.js
│   │   ├── SphereGeometry.js
│   │   └── PlaneGeometry.js
│   ├── three/
│   │   └── ThreeAdapter.js       Three.js → PathTracer scene
│   └── shaders/                  Embedded GLSL modules
├── examples/
│   ├── standalone/               Multi-object demo
│   └── threejs/                  Three.js integration demo
```

## Render Pipeline

```
Path Trace (1 SPP) → Temporal Blend → Bilateral Denoise → Tonemapping
```

## API Reference

### `PathTracer(canvas, options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxBounces` | number | 3 | Max light bounces |
| `temporal` | boolean | true | Enable temporal blend |
| `temporalBlendFactor` | number | 0.1 | New sample weight |
| `denoise` | boolean | true | Enable bilateral filter |
| `denoiseColorSigma` | number | 0.15 | Color similarity |
| `denoiseDepthSigma` | number | 0.5 | Depth similarity |
| `exposure` | number | 1.5 | Tonemapping exposure |
| `gamma` | number | 2.2 | Gamma correction |

### Materials

```js
Material.lambert([r, g, b], roughness)
Material.metal([r, g, b], roughness)
Material.glass([r, g, b], roughness)
Material.emissive([r, g, b], intensity)
```

### Three.js Supported Types

| Three.js | Converted to |
|----------|-------------|
| `BoxGeometry` | `BoxGeometry` |
| `SphereGeometry` | `SphereGeometry` |
| `PlaneGeometry` | `PlaneGeometry` |
| `MeshStandardMaterial` | Lambert/Metal (by metalness) |
| Transparent materials | Glass |
| Emissive materials | Emissive |
| `RectAreaLight` | `AreaLight` |
| `PointLight` | `PointLight` |

## Requirements

- Browser with WebGL1 + `OES_texture_float`
- Three.js ≥ 0.150 (optional, for adapter only)

## Run Examples

```bash
python3 -m http.server 8005
# Standalone: http://localhost:8005/examples/standalone/
# Three.js:   http://localhost:8005/examples/threejs/
```

## License

MIT
