# Stack & contraintes techniques

## Versions figées

- **Nuxt 4.4.2** — répertoire source : `app/` (pas de `src/`)
- **Three.js 0.183.2** — API r183, pas de features r184+
- **Vue 3.5** + **vue-router 5**
- **lil-gui 0.21** — UI debug

## Auto-imports Nuxt (`nuxt.config.js`)

```js
imports: {
  dirs: [
    'utils/three/materials',
    'utils/three/textures',
  ],
}
```

→ Tout fichier dans ces deux dossiers est auto-importé. Ne pas `import` manuellement depuis eux.

Les autres modules Three (`Experience`, `Renderer`, managers, worlds) s'importent explicitement.

## Styles globaux

`app/assets/css/global.css` chargé via `css: [...]` dans `nuxt.config.js`.

## Dépendances Three.js utilisées

- `GLTFLoader` + `DRACOLoader` (décodeur CDN `three/examples/jsm/libs/draco/`)
- `EffectComposer`, `RenderPass`, `OutlinePass`, `ShaderPass` (ACES), `OutputPass`
- `PointerLockControls` (FPS)

## Contraintes runtime

- **SSR désactivé de facto** pour les pages Three (tout monte côté client via `onMounted`)
- **`#debug` URL hash** active lil-gui + overlays debug (CrosshairTarget, Raycast)
- **WebGL seulement** — pas de WebGPU dans ce projet
- **Tone mapping ACES Filmic**, exposure EV -1.64, environment Neutral

## Conventions de fichiers

- `utils/three/*.js` — modules ES, une classe par fichier
- `utils/three/world/<Nom>World.js` — un World par scène
- `utils/three/world/<Nom>Sources.js` — liste des GLB/textures de ce World
- `utils/three/world/<Nom>Config.js` — constantes (noms d'objets, radius, positions)
- `components/*Hud.vue` — overlays UI
- `composables/use*.js` — bridges réactifs
