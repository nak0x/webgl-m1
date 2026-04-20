---
description: Détecte les fichiers morts du projet et propose leur suppression (avec confirmation).
---

# /cleanup-legacy

Passage de nettoyage sur les fichiers non-référencés.

## Étapes

1. Invoquer l'**agent** `legacy-scanner` pour produire un rapport complet
2. Lire `.claude/rules/cleanup-policy.md` pour la liste de référence
3. Afficher à l'utilisateur :
   - Fichiers **confirmés non-référencés** (prêts à supprimer)
   - Fichiers **à double-vérifier** (avec la raison)
   - Imports morts dans des fichiers encore actifs
4. **Demander confirmation explicite** avant toute suppression
5. Si confirmé :
   - Supprimer les fichiers confirmés un par un
   - Retirer les imports morts
   - Mettre à jour `PROGRESS.md` (section « Fichiers à nettoyer »)
   - Mettre à jour `.claude/rules/cleanup-policy.md` si la table change

## Précautions

- **Jamais** supprimer `_TemplateWorld.js`, `_templateSources.js`, `_TemplatePage.vue`
- **Jamais** supprimer un fichier classé « à double-vérifier » sans accord explicite
- En cas de doute sur un auto-import Nuxt : garder et ajouter un commentaire dans le rapport

## Commit

Après nettoyage, proposer à l'utilisateur de commit avec un message type :
```
chore(cleanup): retirer fichiers legacy non-référencés
```
