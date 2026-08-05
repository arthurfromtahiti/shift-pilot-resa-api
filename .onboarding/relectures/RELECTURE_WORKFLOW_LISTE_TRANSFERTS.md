# Relecture — WORKFLOW_LISTE_TRANSFERTS

## Verdict global

**Bon** — L'analyse est exacte, sourcée et exploitable sans réserve. Chaque affirmation a été vérifiée dans le code source. Aucun fichier inventé, aucune étape fantôme, aucune règle métier déformée.

## Problèmes bloquants

Aucun.

## Problèmes mineurs

Aucun. Toutes les références ligne par ligne sont correctes.

## Points vérifiés et corrects

| Affirmation | Preuve |
|---|---|
| Point d'entrée `GET /transfers` — `src/server.js:13` | Lu : `if (url.pathname === "/transfers" && req.method === "GET") {` ✅ |
| Parse URL via `new URL(req.url, ...)` — `src/server.js:11` | Lu : `const url = new URL(req.url, \`http://${req.headers.host}\`);` ✅ |
| `listTransfers()` appelé `src/server.js:14`, défini `src/transfers.js:9-11` | Confirmé ligne à ligne ✅ |
| 3 transferts : Papeete→Moorea, Papeete→Bora Bora, Raiatea→Tahaa | Lu : `src/transfers.js:4-6` ✅ |
| Projection `{ id, from, to, price, seatsLeft }` — `src/server.js:14-20` | Confirmé : `seats` et `sold` absents de la réponse ✅ |
| `seatsLeft = t.seats - t.sold` — `src/transfers.js:14` | Lu : `return transfer.seats - transfer.sold;` ✅ |
| Réponse 404 `{ error: "Not found" }` — `src/server.js:23` | Lu : `sendJson(res, 404, { error: "Not found" });` ✅ |
| `isFull` absente de l'import `src/server.js:3` | Lu : `const { listTransfers, seatsLeft } = require("./transfers");` — `isFull` absent ✅ |
| Zéro dépendance externe — `package.json` | Lu : aucun champ `dependencies` dans les 7 lignes ✅ |
| Transfert id 2 : `seatsLeft: 0` (`src/transfers.js:5`) | Lu : `{ id: 2, ..., seats: 60, sold: 60 }` → 60-60=0 ✅ |
| Comptage de lignes : `src/server.js` 30 lignes, `src/transfers.js` 21 lignes, `package.json` 7 lignes | Confirmés ✅ |

## Recommandations de correction

Aucune correction requise. Le livrable est prêt pour publication.
