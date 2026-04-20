---
name: tune-post-processing
description: Règle ou modifie le pipeline EffectComposer (RenderPass, OutlinePass, ACES, OutputPass). Se déclenche sur édition de Renderer.js ou ajout/retrait de passes post-process.
---

# Régler le post-processing

Pipeline actuel dans `app/utils/three/Renderer.js` :

```
RenderPass → OutlinePass → ShaderPass(ACESFilmicToneMapping) → OutputPass
```

## Ordre des passes (ne pas casser)

1. **RenderPass** — rend la scène dans le FBO (toujours en premier)
2. **OutlinePass** — applique l'outline sur `selectedObjects`
3. **ACESFilmicToneMappingShader** — tone mapping manuel (car on est en post-process, pas de `renderer.toneMapping`)
4. **OutputPass** — conversion color space finale vers sRGB (toujours en dernier)

**Ajout d'une nouvelle passe** : l'insérer AVANT `OutputPass`. Si c'est un effet « scene-space » (bloom, DOF, SSAO), l'insérer APRÈS `OutlinePass` pour éviter que l'outline soit flouté.

## Paramètres actuels

- Tone mapping : ACES Filmic, exposure **EV -1.64** (`0.32` en linéaire)
- Environment : Neutral (`neutralEnvironment` de Three)
- OutlinePass color : `0xffffff` (AdditiveBlending empêche le noir pur)
- Thickness : à ajuster selon la taille viewport

## OutlinePass quirks

- **Couleur noire impossible** nativement : AdditiveBlending. Si noir requis → réactiver `SilhouetteOutline.js` après discussion (voir `@.claude/rules/cleanup-policy.md`)
- `selectedObjects` est un tableau, pas un Set → nettoyer chaque frame dans `CrosshairTarget.js`
- Performance : OutlinePass fait un pass supplémentaire par objet. Limiter à 1-2 objets sélectionnés

## Resize

`EffectComposer.setSize(width, height)` dans `Sizes.resize` — NE PAS oublier, sinon upscaling visible.

Chaque passe qui a un FBO interne (OutlinePass, SMAA…) a sa propre `setSize()`.

## Debug

Exposer les paramètres via `Debug` (lil-gui) derrière `#debug` :
```js
if (this.experience.debug.active) {
  const folder = this.experience.debug.ui.addFolder('PostProcess')
  folder.add(toneMappingPass.uniforms.exposure, 'value', 0, 2, 0.01).name('exposure')
}
```

## Pièges

- Ne pas ajouter `GammaCorrectionShader` — `OutputPass` s'en charge déjà
- Ne pas mettre `renderer.outputColorSpace = SRGBColorSpace` si tu utilises `OutputPass` (double conversion)
- Si tu désactives le post-process temporairement, bypass via `renderer.render(scene, camera)` mais garder le composer intact
