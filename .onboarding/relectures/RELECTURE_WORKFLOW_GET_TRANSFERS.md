# Relecture — WORKFLOW_GET_TRANSFERS

## Verdict global

**Bon** — Analyse exacte, sourcée ligne par ligne, confiance `high` justifiée. Tous les fichiers cités existent, toutes les références de lignes sont vérifiées. Les règles métier, la projection et le traitement du cas 404 sont fidèles au code. Une imprecision de notation sans impact sémantique notée en mineur.

## Problèmes bloquants

Aucun.

## Problèmes mineurs

- **Notation syntaxique — étape 2** : l'analyse écrit `'http://' + req.headers.host` (concaténation) alors que `src/server.js:11` utilise un template literal `` `http://${req.headers.host}` ``. Comportement identique ; la citation du code est légèrement imprécise mais n'induit aucune erreur de compréhension.

## Points vérifiés et corrects

- **Fichiers cités** : `src/server.js` (30 lignes) et `src/transfers.js` (22 lignes) lus et confirmés ; `README.md` existe, `shift-pilot-resa-web` mentionné à la ligne 4.
- **Points d'entrée** : `GET /transfers` à `src/server.js:13` (`url.pathname === "/transfers" && req.method === "GET"`) — exact.
- **Étape sendJson** : `src/server.js:5-8`, `res.writeHead` + `JSON.stringify` — exact.
- **Étape 404** : `src/server.js:23` — `sendJson(res, 404, { error: "Not found" })` — exact.
- **Projection** : `src/server.js:14-20` — `{ id, from, to, price, seatsLeft }`, champs `seats` et `sold` absents — vérifié.
- **`isFull` non importée** : `src/server.js:3` importe uniquement `{ listTransfers, seatsLeft }` — confirmé.
- **`seatsLeft`** : `src/transfers.js:13-15` — `return transfer.seats - transfer.sold` — exact.
- **Données** : tableau `transfers` à `src/transfers.js:3-7`, 3 objets avec les valeurs exactes citées (Papeete→Moorea seats:40/sold:12/price:3500, Papeete→Bora Bora seats:60/sold:60/price:21000, Raiatea→Tahaa seats:20/sold:5/price:1800) — vérifié.
- **Risque stock figé** : `grep -niE "post|put|delete|patch|book|reserv" src/` → aucun résultat — confirmé par examen direct de `src/server.js` et `src/transfers.js`.
- **Risque aucune gestion d'erreur** : pas de `try/catch` dans le handler — visible à `src/server.js:13-21`.
- **Confiance `high`** : justifiée — les deux fichiers source totalisent 52 lignes, sans couche cachée ni appel asynchrone.

## Recommandations de correction

Aucune correction obligatoire. La notation `'http://' + req.headers.host` en étape 2 peut être alignée sur la syntaxe réelle (template literal) si le producteur souhaite corriger, mais ce n'est pas requis pour la publication.
