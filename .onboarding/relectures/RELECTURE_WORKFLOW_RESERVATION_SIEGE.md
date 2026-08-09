# Relecture — WORKFLOW_RESERVATION_SIEGE.md

## Verdict global

**Bon** — après correction, l'analyse distingue correctement le chemin de prise de réservation du chemin d'annulation, et le déroulement décrit correspond au code.

## Problèmes bloquants

Aucun identifié.

## Problèmes mineurs

Aucun identifié.

## Points vérifiés et corrects

- `src/server.js`, `src/transfers.js`, `test/server.test.js` et `test/transfers.test.js` existent et ont été ouverts.
- Le point d’entrée, l’accumulation du corps, la validation, la garde de capacité, la mutation, l’UUID et l’enregistrement sont conformes (`src/server.js:25-45`, `src/transfers.js:25-33`).
- L'objectif corrigé indique bien que le POST est le seul chemin de prise d'une réservation et cite explicitement le DELETE comme second chemin de mutation (`WORKFLOW_RESERVATION_SIEGE.md:17`). Cette distinction est conforme à `cancelReservation()` (`src/transfers.js:36-43`) et à sa route (`src/server.js:50-57`).
- Le JSON malformé est correctement décrit comme toléré par défaut (`src/server.js:31-40`), et le mapping 404/409/200 est exact (`src/server.js:43-45`).
- `npm test` exécuté pendant la relecture : 21 tests passés.

## Recommandations de correction

- Conserver la distinction actuelle entre prise de réservation et mutation d'annulation ; aucune correction supplémentaire requise.
