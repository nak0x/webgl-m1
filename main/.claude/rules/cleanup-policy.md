# Cleanup policy

## Fichiers legacy à NE PAS ressusciter

Ces fichiers sont présents dans le repo mais ne sont plus utilisés. Ne pas les importer, ne pas s'en inspirer, ne pas y ajouter de code sans demander confirmation explicite.

| Fichier | Statut | Raison |
|---|---|---|
| `app/utils/three/PcScreen.js` | Mort | Remplacé par la logique GLB `dalle_css3d` |
| `app/utils/three/SilhouetteOutline.js` | Mort | Remplacé par OutlinePass natif Three.js |
| `app/utils/three/SceneManager.js` | Mort | Hérité d'un ancien projet |
| `app/utils/three/materials/*` (createBois, createEau, createPlexiglass, createVerre, createXray) | Mort dans l'atelier | Hérités de project2, non utilisés |
| `app/utils/three/textures/*` (makePlexiTexture, makeWoodTexture) | Mort | Idem |

## Si un besoin réel se présente

- **Outline noir** : OutlinePass ne le supporte pas (AdditiveBlending). Dans ce cas seulement, réactiver `SilhouetteOutline.js` après discussion avec l'utilisateur.
- **Matériau custom** (bois, verre…) : créer un nouveau fichier dans `utils/three/materials/` avec un nom explicite au domaine de l'atelier, ne pas copier les legacy sans relecture.

## Avant de supprimer

- Vérifier qu'aucun `import` actif ne cite le fichier (`grep -r "from.*SilhouetteOutline"`)
- Vérifier les auto-imports Nuxt : un fichier dans `materials/` ou `textures/` peut être référencé par nom de fonction sans import explicite
- Mettre à jour `PROGRESS.md` (section « Fichiers à nettoyer / supprimer »)

## Templates à garder

- `app/utils/three/world/_TemplateWorld.js`
- `app/utils/three/world/_templateSources.js`
- `app/pages/_TemplatePage.vue`

Ne pas les modifier sans discussion — ils servent de base aux nouvelles scènes (voir skill `create-world`).
