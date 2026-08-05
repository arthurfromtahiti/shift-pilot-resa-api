# Relecture — TESTING_AUDIT.md

## Verdict global

**Bon** — Audit des tests le plus précis de la série : la table des trois tests avec leur intention réelle vs leur implémentation est un artefact de grande valeur. Le constat sur le "test 3 couplé à la donnée" (cardinalité vs comportement) est une observation fine et actionnable. Tous les chiffres sont exacts.

## Problèmes bloquants

Aucun.

## Problèmes mineurs

- **"Test 3 — cardinalité, pas le comportement"** : l'audit recommande de remplacer `listTransfers().length === 3` par `assert.ok(listTransfers().length > 0)`. C'est une amélioration valide. Cependant, la Question ouverte §78 soulève elle-même l'alternative : le test de cardinalité stricte (`=== 3`) peut être *intentionnel* pour vérifier que le catalogue de démonstration n'a pas été altéré. L'audit aurait pu trancher plus fermement — mais présenter les deux lectures et laisser la question ouverte est honnête plutôt qu'un défaut. Point de style.

## Points vérifiés et corrects

- `test/transfers.test.js` : 17 lignes, trois tests `seatsLeft`, `isFull`, `listTransfers`. ✓
- `seatsLeft({ seats: 40, sold: 12 }) === 28` : assertion correcte (`40-12=28`). ✓
- `isFull` testée sur les deux branches (complet / non complet). ✓
- `listTransfers().length === 3` : couplé à `src/transfers.js:3-7` (3 enregistrements hardcodés). ✓
- Aucun import de `src/server.js` dans `test/` : confirmé. ✓
- `module.exports = server` (`src/server.js:30`) : serveur exporté mais non utilisé en test. ✓
- `package.json:5` — `"engines": { "node": ">=18" }` : vérifié. ✓
- `package.json:6` — `"test": "node --test test/"` : vérifié (le script `test` est à la ligne 6). ✓
- Absence de CI (`.github/`, `.circleci/`, `Jenkinsfile`) : confirmée par listing. ✓
- Recommandations actionnables : toutes pointent des fichiers et lignes réels. ✓
- Zéro secret dans les constats. ✓

## Recommandations de correction

Aucune correction nécessaire.
