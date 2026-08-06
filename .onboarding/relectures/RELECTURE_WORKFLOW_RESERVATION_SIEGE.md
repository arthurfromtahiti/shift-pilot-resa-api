# Relecture — WORKFLOW_RESERVATION_SIEGE.md

## Verdict global

**Bon** — le défaut bloquant identifié au premier tour a été corrigé. La "race condition" est désormais taggée `HYPOTHÈSE — mode cluster uniquement` avec l'explication technique exacte (garantie du modèle single-threaded Node.js entre la garde et la mutation synchrones). Les points mineurs (numérotation des tests, plage `req.on("end")`) ont également été corrigés. L'artefact est exploitable sans réserve.

## Problèmes bloquants

Aucun — corrigé au premier tour :

- **[RÉSOLU] BLOQUANT-1** — Le risque "Race condition sur le dernier siège" est désormais taggué `HYPOTHÈSE — mode cluster uniquement` avec l'explication correcte : la garde (`seatsLeft(transfer) < seats`) et la mutation (`transfer.sold += seats`) sont **synchrones**, sans `await` ni I/O entre elles (`src/server.js:28-39`, `src/transfers.js:21-27`). Dans un process Node.js unique, aucun interleaving n'est possible — la race condition est décrite comme hypothétique uniquement en mode cluster, qui n'est ni configuré ni documenté. ✓

## Problèmes mineurs

Aucun — corrigés au premier tour :

- **[RÉSOLU] MINEUR-1** — Les plages des tests 409 et 404 ont été corrigées : `:42-46` (test complet) et `:48-52` (test 404), lignes vérifiées dans `test/server.test.js`. ✓
- **[RÉSOLU] MINEUR-2** — La plage `req.on("end", ...)` est désormais citée `:28-35` (parsing JSON, `src/server.js:28`) — `req.on("end", () => {` est bien à la ligne 28. ✓

## Points vérifiés et corrects

- Tous les fichiers cités existent et sont lisibles : `src/server.js`, `src/transfers.js`, `test/server.test.js` ✓
- Point d'entrée `POST /transfers/:id/reserve` → `src/server.js:23-24` (regex `/^\/transfers\/(\d+)\/reserve$/`, POST) : exact ✓
- Déroulement (parsing URL, accumulation corps, parse JSON try/catch, `bookSeats`, mappage résultats → statuts HTTP) : tracé aux bonnes lignes, aucune étape inventée ✓
- Règles métier :
  - Défaut `seats = 1` via `??` (`src/server.js:36`) ✓
  - Garde stricte `<` (`src/transfers.js:24`) ✓
  - Existence du transfert (`src/transfers.js:22-23`) ✓
  - Mutation synchrone immédiate (`src/transfers.js:25`) ✓
  - Absence de validation `seats ≤ 0` : correctement identifiée ✓
  - Corps malformé silencieusement ignoré (try/catch, `src/server.js:30-35`) ✓
- Données (structure réponse 200 / 404 / 409) : exactes ✓
- Risques "perte totale de données au redémarrage", "pas d'authentification", "valeur seats négative ou nulle non rejetée" : corrects, sourcés, scénarios précis ✓
- Couverture tests (`test/server.test.js:34-39`, `:42-46`, `:48-52`) : lignes exactes ✓
- Confiance `high` justifiée (code intégralement lu, comportement entièrement tracé) ✓
- Nommage (`WORKFLOW_RESERVATION_SIEGE.md`, dossier `workflows/`) conforme ✓

## Recommandations de correction

Aucune — l'artefact est validé.
