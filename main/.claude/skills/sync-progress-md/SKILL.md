---
name: sync-progress-md
description: Met à jour PROGRESS.md après un changement structurel (nouveau World, step résolu, fichier nettoyé, bloquant levé). Se déclenche après toute modification qui change l'état d'avancement du projet.
---

# Synchroniser PROGRESS.md

`PROGRESS.md` est la source de vérité de l'avancement. À maintenir à jour après tout changement notable.

## Sections à connaître

1. **Stack** — fige — ne pas modifier sans raison (nouvelle version Three, Nuxt…)
2. **Ce qui est fait** — ajouter les nouveaux modules, steps, composants
3. **Fichiers à nettoyer / supprimer** — ajouter ou retirer des entrées
4. **TODO** — sous-sections : Bloquant, Écran PC, Scène / Gameplay, Polish, Qualité de code

## Quand mettre à jour

| Événement | Action |
|---|---|
| Nouveau World créé | Ajouter section `### Scène <Nom>` dans « Ce qui est fait » |
| Step quest ajouté | Mettre à jour la liste numérotée des steps du World concerné |
| Fichier supprimé (legacy) | Retirer la ligne de la table « Fichiers à nettoyer » |
| TODO résolu | Cocher la case `- [x]` et/ou retirer l'item si entièrement fait |
| Nouveau bloquant découvert | Ajouter sous « Bloquant » avec assez de contexte pour reprendre froid |
| Fichier inutile détecté | Ajouter à la table « Fichiers à nettoyer / supprimer » avec statut |

## Format des items TODO

```markdown
- [ ] **Titre court** — description / contexte
- [ ] Avec sous-étapes :
  - étape 1
  - étape 2
```

## Format des bloquants

```markdown
- [ ] **Noms réels des objets GLB** — retrouver via `#debug` et mettre à jour dans `_setupQuest()`
  - `computer` → nom réel du PC (objet d'interaction)
```

Un bloquant bien écrit permet à quelqu'un (ou Claude) de reprendre sans contexte.

## Pièges

- **Ne pas** dupliquer les infos de `CLAUDE.md` ou des rules — PROGRESS.md est un journal d'avancement, pas une doc d'architecture
- **Ne pas** y consigner des règles durables (conventions, contraintes) — ça va dans `.claude/rules/`
- **Ne pas** écrire en première personne (« j'ai fait ») — style impersonnel/descriptif
- Les dates absolues si mention de deadline (`2026-04-25`), pas relatives (« jeudi »)
