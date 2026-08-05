# Relecture — DATA_MODEL_AUDIT.md

## Verdict global

**Bon** — Le modèle de données est décrit avec exactitude, les valeurs citées correspondent au code source, et les risques (mutation, sold figé, absence de validation) sont correctement qualifiés. La référence à `RELECTURE_WORKFLOW_CALCUL_DISPONIBILITE.md` est valide (fichier existant dans `.onboarding/relectures/`).

## Problèmes bloquants

Aucun.

## Problèmes mineurs

Aucun.

## Points vérifiés et corrects

- Structure du catalogue : 3 objets avec champs `id, from, to, seats, sold, price` — confirmé par lecture de `src/transfers.js:3-7`. Valeurs exactes :
  - `{ id: 1, from: "Papeete", to: "Moorea", seats: 40, sold: 12, price: 3500 }` ✓
  - `{ id: 2, from: "Papeete", to: "Bora Bora", seats: 60, sold: 60, price: 21000 }` ✓
  - `{ id: 3, from: "Raiatea", to: "Tahaa", seats: 20, sold: 5, price: 1800 }` ✓
- `listTransfers()` retourne `transfers` sans copie (`src/transfers.js:10: return transfers`) — confirmé.
- `sold` non modifié au runtime — confirmé : aucun `sold =` ni `sold +=` dans les sources (revue complète de `src/server.js` et `src/transfers.js`).
- `seatsLeft(transfer)` sans validation d'invariant (`src/transfers.js:13-15`) — confirmé : `return transfer.seats - transfer.sold` sans garde.
- Qualification `HYPOTHÈSE` pour le fixture id 2 (test de saturation) — correct, aucune documentation ne le confirme explicitement.
- `NaN` sérialisé en `null` en JSON si `sold` ou `seats` sont `undefined` — comportement JSON.stringify standard, exact.
- Encapsulation : `seats` et `sold` absents de la projection HTTP (`src/server.js:14-20`) — confirmé.
- Aucune dépendance externe (`package.json:7` liste zéro dépendance) — confirmé.
- Référence à `RELECTURE_WORKFLOW_CALCUL_DISPONIBILITE.md` vérifiée : fichier présent dans `.onboarding/relectures/`.
- Aucun secret.

## Recommandations de correction

Aucune.
