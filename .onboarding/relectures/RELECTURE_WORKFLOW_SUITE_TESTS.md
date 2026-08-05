# Relecture — WORKFLOW_SUITE_TESTS

## Verdict global

**Bon** — Analyse exacte et complète. Tous les fichiers cités existent, toutes les références de lignes sont correctes. La confiance `high` est honnête : le fichier de test (17 lignes) et `package.json` (7 lignes) sont sans ambiguïté. Les risques sont concrets et directement observables dans le code.

## Problèmes bloquants

Aucun.

## Problèmes mineurs

Aucun.

## Points vérifiés et corrects

- **Fichiers cités** : `test/transfers.test.js` (17 lignes) et `package.json` (7 lignes) — tous deux existent et ont été lus.
- **Points d'entrée** : `package.json` script `"test": "node --test test/"` — exact (ligne 6).
- **Runner natif** : `node:test` importé à `test/transfers.test.js:1`, `node:assert/strict` à la ligne 2 — exact.
- **Import des fonctions** : `const { listTransfers, seatsLeft, isFull } = require("../src/transfers")` à `test/transfers.test.js:3` — exact.
- **Test 1 seatsLeft** : `assert.equal(seatsLeft({ seats: 40, sold: 12 }), 28)` à `test/transfers.test.js:5-7` — exact.
- **Test 2 isFull** : deux assertions à `test/transfers.test.js:9-12` (true et false) — exact.
- **Test 3 listTransfers** : `assert.equal(listTransfers().length, 3)` à `test/transfers.test.js:14-16` — exact.
- **`module.exports = server`** : `src/server.js:30` — exact.
- **engines Node ≥ 18** : `package.json:5` — `"engines": { "node": ">=18" }` — exact.
- **Aucune devDependency** : `package.json` ne contient pas de champ `devDependencies` — confirmé.
- **Risque couverture HTTP manquante** : `src/server.js:5-23` (sendJson, routage, projection) sans test — observable directement.
- **Risque cardinalité hard-codée** : `listTransfers().length === 3` casse au 4e transfert — constat correct.
- **Confiance `high`** : justifiée — fichiers courts, aucune ambiguïté, aucun appel externe.

## Recommandations de correction

Aucune.
