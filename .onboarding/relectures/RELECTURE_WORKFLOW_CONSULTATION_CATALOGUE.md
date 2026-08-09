# Relecture — WORKFLOW_CONSULTATION_CATALOGUE.md

## Verdict global

**Bon** — le filtre est décrit selon le code (`!isFull`, donc exclusion de `seatsLeft === 0`) et les chemins de preuve sont valides. Les limites inter-dépôts sont explicitement signalées comme contexte/hypothèse.

## Problèmes bloquants

Aucun identifié.

## Problèmes mineurs

- L’objectif sur l’affichage côté utilisateur est contextuel, non démontré par le code de ce workspace ; cette limite est toutefois indiquée (`README.md:3-4`, frontend hors périmètre).

## Points vérifiés et corrects

- Les fichiers cités existent et ont été ouverts : `src/server.js:13-22`, `src/transfers.js:5-23`, `test/server.test.js:128-140`, `test/transfers.test.js:5-16`, `README.md:3-4` et `.onboarding/documents/ECOSYSTEME.md:14-22`.
- Le routage, le query param, le filtrage, la projection et le statut 200 correspondent à `src/server.js:13-22`.
- La règle générale est correctement distinguée du test sur les données initiales : `isFull` teste exactement `seatsLeft === 0` (`src/transfers.js:21-23`), et le test HTTP vérifie le catalogue courant (`test/server.test.js:135-140`).
- `npm test` exécuté pendant la relecture : 21 tests passés.

## Recommandations de correction

- Maintenir les constats frontend au statut de contexte/hypothèse tant que le dépôt web n’est pas dans le périmètre.
