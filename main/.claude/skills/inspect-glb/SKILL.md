---
name: inspect-glb
description: Procédure pour inspecter un fichier GLB et retrouver les noms réels des objets, anims, matériaux, caméras. Se déclenche quand l'utilisateur demande les noms d'objets d'un GLB, veut débugger la structure, ou utilise /inspect-glb.
---

# Inspecter un fichier GLB

Deux approches : visuelle (via `#debug`) ou programmatique (via l'agent `glb-auditor`).

## Approche 1 — Visuelle (#debug)

**Quand l'utiliser** : pour identifier un objet précis que l'utilisateur voit dans la scène.

1. Lancer `npm run dev`
2. Ouvrir `http://localhost:3000/#debug`
3. Clic gauche pour verrouiller le pointeur (FPS mode)
4. Viser l'objet avec le crosshair
5. Lire l'overlay debug en bas (fourni par `CrosshairTarget.js`) :
   - `type` : Mesh, Group, Object3D
   - `name` : nom à utiliser dans `getObjectByName()`
   - `path` : chemin hiérarchique complet
   - `outlined` : indique si c'est la cible réelle de l'outline

6. Noter le nom → l'utiliser dans `<Nom>Config.js` ou `_setupQuest()`

## Approche 2 — Programmatique (agent)

**Quand l'utiliser** : pour obtenir l'arbre complet d'un GLB sans lancer le dev server.

Invoquer l'agent `glb-auditor` avec le chemin du fichier :
```
Utiliser l'agent glb-auditor pour analyser public/models/atelier_camera_1.0.0.glb
```

L'agent retourne :
- Arbre des objets (nom + type + profondeur)
- Liste des animations (`AnimationClip`)
- Liste des matériaux + textures associées
- Présence de caméras embarquées
- Warning si DRACO compression détectée sans décodeur

## Approche 3 — Inline traverse (ponctuel)

Pour un debug rapide depuis le code :
```js
const model = this.resources.items.mainModel.scene
model.traverse((child) => {
  if (child.isMesh) console.log(child.name, child.type)
})
```

À retirer après usage — ne jamais laisser ce code en production.

## Cas des objets à noms dupliqués

Certains GLB exportent plusieurs objets avec le même nom. `getObjectByName` retourne le premier trouvé. Si ambigu :
- Utiliser `getObjectByProperty('uuid', '...')` si l'uuid est stable
- Ou renommer dans Blender et réexporter

## Objets manquants actuellement (voir PROGRESS.md)

- `computer` → nom réel du PC
- `Outil` → nom réel de l'outil ramassable
- `Porte` → nom réel de la porte de sortie
- `dalle_css3d` → écran du PC (confirmer)

Une fois trouvés, mettre à jour `AtelierConfig.js`.
