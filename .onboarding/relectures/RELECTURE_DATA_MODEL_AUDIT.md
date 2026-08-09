# Relecture — DATA_MODEL_AUDIT.md

## Verdict global

**À corriger** — Le modèle est décrit fidèlement, mais un risque d'invariant est mal statué et une formulation inverse est factuellement trompeuse.

## Problèmes bloquants

**[BLOQUANT-1] Violation d'invariant présentée comme `VÉRIFIÉ_CODE`**

Le code vérifie les entrées de `bookSeats` (`src/transfers.js:26-30`) et `reservations` est privée au module (`src/transfers.js:11`). Le scénario « UUID dont `seats` stocké est erroné » n'est pas observé dans le dépôt ; c'est une corruption d'état hypothétique. Le risque doit être `HYPOTHÈSE`, avec la preuve limitée à l'absence de contrainte structurelle.

## Problèmes mineurs

**[MINEUR-1] « opérations irréversibles »**

Le texte affirme que les deux mutations sont « irréversibles sans redémarrage ». Une réservation créée par `bookSeats` peut précisément être inversée par `cancelReservation` (`src/transfers.js:36-43`). Parler de mutations en mémoire et d'état volatil, pas d'irréversibilité.

## Points vérifiés et corrects

- Forme des transferts et Map (`src/transfers.js:5-11`).
- Deux mutations de `sold` (`src/transfers.js:30`, `41`).
- Volatilité au redémarrage et seed complet id 2 (`src/transfers.js:7`).
- Projection API (`src/server.js:16-22`).
- Aucun secret recopié.

## Recommandation

Abaisser le scénario de corruption en `HYPOTHÈSE` et corriger l'assertion d'irréversibilité.
