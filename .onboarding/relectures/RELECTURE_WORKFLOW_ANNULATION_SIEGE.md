# Relecture — WORKFLOW_ANNULATION_SIEGE.md

## Verdict global

**Bon** — le déroulement, la cohérence `transferId`/UUID, les mutations et les statuts HTTP correspondent au code. La couverture HTTP et unitaire est distinguée correctement.

## Problèmes bloquants

Aucun identifié.

## Problèmes mineurs

Aucun identifié.

## Points vérifiés et corrects

- `src/server.js:50-57` route bien `DELETE /transfers/:id/reservations/:reservationId`, avec 404 sur `!result.ok` et 200 avec `seatsLeft`.
- `src/transfers.js:36-44` vérifie l’UUID, la cohérence du `transferId`, décrémente `sold`, supprime la réservation et retourne le nouveau stock.
- La couverture HTTP (`test/server.test.js:104-126`) est distinguée de la double annulation unitaire (`test/transfers.test.js:52-55`).
- `npm test` exécuté pendant la relecture : 21 tests passés.

## Recommandations de correction

- Conserver les scénarios conditionnels de risque comme hypothèses ou limites, puisqu’ils ne sont pas observables dans le dépôt.
