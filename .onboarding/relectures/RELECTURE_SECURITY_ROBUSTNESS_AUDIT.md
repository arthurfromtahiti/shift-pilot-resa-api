# Relecture — SECURITY_ROBUSTNESS_AUDIT.md

## Verdict global

**Bon** — L'audit est rigoureux, sourcé à la ligne, et aucune hypothèse n'est présentée comme un fait. Tous les constats clés ont été vérifiés indépendamment dans `src/server.js` et `src/transfers.js`.

## Problèmes bloquants

Aucun.

## Problèmes mineurs

**Comportement de crash présenté comme VÉRIFIÉ_CODE** — Le constat « une exception non attrapée dans un callback http.createServer fait crasher le process » est correct mais est une conséquence de comportement runtime Node.js, pas une lecture de code. Le code observable (`new URL(...)` sans `try/catch`) justifie bien `VÉRIFIÉ_CODE` pour la cause. La conséquence (crash du process) est, au sens strict, une `HYPOTHÈSE` documentée par le comportement Node.js ≥18. L'impact sur la compréhension est nul : le raisonnement est exact et le risque est réel — c'est une nuance de label, pas une erreur de fond.

## Points vérifiés et corrects

- `src/server.js:11` : `new URL(req.url, ...)` sans `try/catch` — confirmé par lecture directe du fichier (30 lignes, aucun bloc try visible).
- Absence de `process.on('uncaughtException', ...)` — confirmé : `src/server.js` intégralement relu, ce gestionnaire est absent.
- `sendJson` (`src/server.js:5-8`) : seul header `Content-Type: application/json`, aucun `Access-Control-*` — confirmé.
- Projection HTTP (`src/server.js:14-20`) : `seats` et `sold` absents de la réponse, seul `seatsLeft` exposé — confirmé.
- Aucun secret dans les 4 fichiers sources — confirmé : `package.json`, `src/server.js`, `src/transfers.js`, `test/transfers.test.js` relus.
- Qualification `HYPOTHÈSE` pour l'absence d'authentification intentionnelle et pour le risque futurs endpoints mutables — correctement calibrée.
- Recommandations (try/catch, CORS, auth) toutes actionnables avec référence fichier:ligne.

## Recommandations de correction

Aucune correction exigée. Si une v2 est produite, préciser que le crash est une conséquence documentée du comportement Node.js ≥18 (pas une observation code directe) pour respecter la frontière stricte VÉRIFIÉ_CODE / HYPOTHÈSE — mais ce n'est pas un bloquant.
