# Relecture — TESTING_AUDIT.md

## Verdict global

**À corriger** — Les comptes et le passage de la suite sont vérifiés, mais une description de couverture est factuellement mal comptée.

## Problèmes mineurs

**[MINEUR-1] « 21 tests, 21 pass » non sourcé dans l'audit**

Le texte dit « confirmé par lecture du code et de la carte ». Une lecture ne prouve pas le passage. J'ai exécuté `npm test` sur le checkout courant : 21 tests, 21 pass, 0 fail. Le résultat est donc confirmé pour cet état, mais l'audit devrait mentionner la commande et son résultat (ou qualifier l'affirmation comme non vérifiée au moment de sa production).

**[MINEUR-2] Risque de retry/watch spéculatif correctement marqué mais peu étayé**

Le scénario de rejeu dépend du runner et reste `HYPOTHÈSE`. Le conserver comme question ouverte ou le relier à un runner effectivement utilisé ; la fragilité structurelle de `test/server.test.js:63`, elle, est bien démontrée.

**[MINEUR-3] « 4 endpoints » est inexact — À CORRIGER**

Le code expose trois routes : `GET /transfers`, `POST /transfers/:id/reserve` et `DELETE /transfers/:id/reservations/:reservationId` (`src/server.js:13`, `25`, `50`). `?available=true` est une variante de requête du GET, pas un quatrième endpoint. Remplacer « 4 endpoints » par « 3 endpoints, dont le GET avec et sans filtre ».

## Points vérifiés et corrects

- 9 tests unitaires + 12 HTTP (`test/transfers.test.js`, `test/server.test.js`).
- Assertion dépendante de l'état (`test/server.test.js:58-64`).
- Accumulation sur le transfert 3 (`test/server.test.js:96-102`, `test/transfers.test.js:25-31`).
- Cas de dépassement partiel non couvert.
- `package.json:6` est la bonne référence.
- Aucun secret recopié.

## Recommandation

Ajouter dans l'audit la preuve d'exécution et conserver la distinction entre fragilité observée et comportement futur du runner.
