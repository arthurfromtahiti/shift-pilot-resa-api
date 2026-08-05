# Relecture — FUNCTIONAL_AUDIT.md

## Verdict global

**Bon** — Tous les constats fonctionnels sont exacts et correctement sourcés. La distinction entre ce qui est implémenté (`GET /transfers`) et ce qui est absent (endpoint de réservation) est claire, documentée, et bien qualifiée. Les hypothèses sont explicitement marquées.

## Problèmes bloquants

Aucun.

## Problèmes mineurs

Aucun.

## Points vérifiés et corrects

- Absence d'endpoints POST/PUT/PATCH/DELETE — confirmé : `src/server.js` fait 30 lignes, seul un `if` sur `GET /transfers` existe (ligne 13), tout le reste tombe dans le 404 catch-all (ligne 23).
- `isFull` absente de l'import `src/server.js:3` — confirmé : la destructuration est `{ listTransfers, seatsLeft }`, sans `isFull`.
- Transfert id 2 Papeete→Bora Bora avec `sold: 60, seats: 60` → `seatsLeft: 0` — confirmé dans `src/transfers.js:5`.
- `seatsLeft(t)` calculé à la volée (`src/transfers.js:13-15`) — confirmé : `return transfer.seats - transfer.sold`.
- Exclusion de `seats` et `sold` de la projection HTTP (`src/server.js:14-20`) — confirmé.
- Route 404 catch-all (`src/server.js:23`) sans distinction 404/405 — confirmé.
- Qualification `HYPOTHÈSE` pour le CORS (proxy possible non vérifiable dans ce dépôt) et pour l'absence d'authentification intentionnelle — correctement calibrée.
- Cohérence des workflows (`WORKFLOW_LISTE_TRANSFERTS.md`, `WORKFLOW_CALCUL_DISPONIBILITE.md`) avec le code : constat correct, workflows existants dans `.onboarding/workflows/`.
- Aucun secret dans les constats.

## Recommandations de correction

Aucune.
