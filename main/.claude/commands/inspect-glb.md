---
description: Analyse un fichier GLB et retourne la hiérarchie des objets, animations, matériaux. Usage — /inspect-glb <chemin>
argument-hint: <chemin vers le .glb>
---

# /inspect-glb

Audit d'un fichier GLB pour retrouver les noms d'objets à utiliser dans `getObjectByName()`.

## Arguments

`$ARGUMENTS` — chemin relatif ou absolu vers un fichier `.glb` ou `.gltf`.

## Étapes

1. Vérifier que le fichier existe
2. Invoquer l'**agent** `glb-auditor` avec le chemin
3. Afficher le rapport retourné à l'utilisateur
4. Si l'utilisateur cherchait un objet précis (mentionné dans sa requête), mettre en avant les noms pertinents

## Exemple d'usage

```
/inspect-glb public/models/atelier_camera_1.0.0.glb
```

Résultat : arbre des objets, animations, caméras embarquées, matériaux, warnings.

## Suivi suggéré

Après l'audit, proposer à l'utilisateur :
- Mettre à jour `AtelierConfig.js` avec les noms trouvés
- Brancher une interaction via `/bind-object <stepId> <glbName>`
