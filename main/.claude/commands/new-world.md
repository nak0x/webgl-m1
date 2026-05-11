---
description: Scaffold une nouvelle scène (World + Sources + Config + page Nuxt) depuis les templates. Usage — /new-world <NomPascalCase>
argument-hint: <NomPascalCase>
---

# /new-world

Scaffold complet d'une nouvelle scène dans le projet.

## Arguments

`$ARGUMENTS` — nom en PascalCase (ex: `Forge`, `Workshop`, `Lab`).

## Étapes

Invoquer le skill `create-world` avec le nom fourni. Le skill connaît la procédure complète :

1. Vérifier que `$ARGUMENTS` n'est pas vide et est en PascalCase
2. Vérifier qu'aucun `<Nom>World.js` n'existe déjà
3. Créer `app/utils/three/world/<Nom>Sources.js` (copie de `_templateSources.js`)
4. Créer `app/utils/three/world/<Nom>Config.js`
5. Créer `app/utils/three/world/<Nom>World.js` (copie de `_TemplateWorld.js`)
6. Créer `app/pages/<nom-en-kebab>.vue` (copie de `_TemplatePage.vue`)
7. Mettre à jour `PROGRESS.md` avec la nouvelle scène
8. Poster à l'utilisateur :
   - Liste des 4 fichiers créés avec chemins cliquables
   - URL de test : `http://localhost:3000/<nom-en-kebab>`
   - Rappel : charger le GLB correspondant dans `public/models/` puis ajuster `<Nom>Sources.js`

## Pièges

- **Ne jamais** modifier les templates `_Template*` eux-mêmes
- Si l'utilisateur ne fournit pas de nom, demander et ne pas proposer de valeur par défaut
- Si le nom n'est pas PascalCase, corriger silencieusement et le signaler
