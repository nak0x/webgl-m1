---
description: Lance le serveur Nuxt dev et ouvre :3000/#debug dans un message pour que l'utilisateur puisse cliquer.
---

# /dev-scene

Démarrer le dev server et donner l'URL de debug.

## Étapes

1. Vérifier qu'aucun process Node tourne déjà sur le port 3000 (`lsof -i :3000` ou équivalent — signaler mais ne pas tuer sans confirmation)
2. Lancer `npm run dev` en **background** (run_in_background: true)
3. Attendre ~4 secondes que Nuxt démarre
4. Poster à l'utilisateur :
   - Lien cliquable `http://localhost:3000/#debug`
   - Rappel des contrôles : clic gauche pour lock FPS, WASD pour bouger, E pour interagir, Espace/Entrée dans les dialogues
   - Rappel : appeler `/dev-scene` à nouveau ne relance pas si un process existe déjà — tuer avec `kill <pid>` d'abord

## Notes

- Ne pas laisser tourner le dev server à la fin de la session. Le rappeler à l'utilisateur en fin de tâche.
- Si l'utilisateur demande de stopper : `kill <pid>` du process Nuxt, ou laisser l'utilisateur faire `Ctrl+C` dans son terminal.
