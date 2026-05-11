# Workflow

## Dev server

```bash
npm run dev
```

Serveur sur `http://localhost:3000`.

Pour debug :
- `http://localhost:3000/#debug` — active lil-gui, overlays CrosshairTarget et DebugRaycast

## Ne jamais committer

- `.nuxt/` — build output (gitignored)
- `.output/`, `.data/`, `.nitro/`, `.cache/` — idem
- `node_modules/` — idem
- `.DS_Store` — idem
- Fichiers `.env*` sauf `.env.example`

## Git

- Branches : une branche par feature/scène (ex: `1st_scene_atelier`)
- Main branch : `main`
- Jamais `git push --force` sur `main`
- Jamais `git reset --hard` sans accord explicite de l'utilisateur
- Commits : scope par sous-système (`world/`, `quest/`, `fps/`, `interaction/`)

## PROGRESS.md

Document source de vérité de l'avancement. À mettre à jour quand :
- Un TODO est résolu
- Un fichier est ajouté à la liste « à nettoyer »
- Un bloquant apparaît (objets GLB non nommés, etc.)

Voir skill `sync-progress-md`.

## Inspection GLB

Pour trouver les noms réels d'objets (`computer`, `Outil`, `Porte`…) :
1. Lancer `#debug`
2. Viser les objets avec le crosshair, lire l'overlay `type / name / path`
3. Mettre à jour `AtelierConfig.js` et `_setupQuest()` avec les vrais noms

Voir skill `inspect-glb` pour la procédure complète.

## Tests visuels

Pas de test unitaire dans ce projet. La vérification se fait :
- Visuellement sur `localhost:3000`
- Via le skill `webapp-testing` pour la partie HUD/UI
- En naviguant la quête complète (parler NPC → PC → outil → porte → scène 2)
