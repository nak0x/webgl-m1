# webgl-m1 — Guide Claude Code

Projet Nuxt 4 + Three.js r183 + Vue 3. Expérience 3D interactive (scène Atelier, FPS, quest + dialogue).

## À lire en priorité

@.claude/rules/architecture.md
@.claude/rules/stack-constraints.md
@.claude/rules/code-style.md

## Rules complémentaires (charger à la demande)

- `@.claude/rules/cleanup-policy.md` — fichiers legacy à ne pas ressusciter
- `@.claude/rules/workflow.md` — dev server, debug, git

## Skills disponibles

Les skills se déclenchent automatiquement selon le contexte. Voir `.claude/skills/` pour la liste.

## Commandes projet

- `/dev-scene` — lance le dev server
- `/new-world <name>` — scaffold une nouvelle scène
- `/inspect-glb <path>` — audit d'un fichier GLB
- `/cleanup-legacy` — retire les fichiers morts
- `/bind-object <stepId> <glbName>` — branche un objet GLB sur un step quest

## Rappels critiques

- **Three.js r183** — pas de features r184+
- **OutlinePass** (pas `SilhouetteOutline.js`, qui est legacy)
- **`#debug` dans l'URL** pour activer lil-gui
- **Never commit `.nuxt/`** (déjà gitignored)
- **Noms d'objets GLB** à retrouver via `#debug` avant toute interaction (voir PROGRESS.md)
