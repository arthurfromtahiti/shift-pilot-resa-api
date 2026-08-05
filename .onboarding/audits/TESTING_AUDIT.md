# Tests — Audit

> Confiance : high

## Compréhension globale

La suite de tests de `shift-pilot-resa-api` est minimale mais honnête : trois tests unitaires couvrant les trois fonctions pures de `src/transfers.js`, écrits avec le runner natif `node:test`, sans aucune dépendance externe. La couverture de la couche HTTP (routage, sérialisation, handler 404, projection) est entièrement absente. Le serveur est pourtant exporté et importable, ce qui rend les tests d'intégration HTTP réalisables sans infrastructure supplémentaire.

## Résumé exécutif

Trois tests, tous dans `test/transfers.test.js`, tous sur la logique pure de `src/transfers.js` : `seatsLeft` (calcul des places), `isFull` (détection de transfert complet), `listTransfers` (cardinalité du catalogue). Exécutables via `npm test` → `node --test test/` (`package.json`). Aucune dépendance npm : runner et assertions sont natifs (`node:test`, `node:assert/strict`).

Ce qui n'est pas testé : `sendJson` (`src/server.js:5-8`), le routage HTTP (`src/server.js:13`), la projection `.map()` (`src/server.js:14-20`), le handler 404 (`src/server.js:23`), le démarrage sur port (`src/server.js:26-29`). La route `GET /transfers` — l'unique fonctionnalité livrée — n'a pas de test de bout en bout.

Le test de cardinalité (`listTransfers().length === 3`, `test/transfers.test.js:14-16`) est couplé à la donnée de départ, pas au comportement de la fonction : il cassera dès qu'un quatrième transfert sera ajouté dans `src/transfers.js`.

`isFull` est testée (`test/transfers.test.js:9-12`) bien qu'elle ne soit pas importée dans `src/server.js` (`src/server.js:3`) et donc jamais appelée en production. Les tests couvrent une surface légèrement plus large que le code en prod.

## Constats détaillés

**Tests existants — VÉRIFIÉ_CODE.** `test/transfers.test.js` déclare trois tests :

| # | Nom | Fonction testée | Assertion | Statut |
|---|---|---|---|---|
| 1 | `seatsLeft calcule les places restantes` | `seatsLeft({ seats: 40, sold: 12 })` | `=== 28` | valide comportement |
| 2 | `isFull detecte un transfert complet` | `isFull({ seats: 60, sold: 60 })` / `isFull({ seats: 40, sold: 12 })` | `true` / `false` | valide les deux branches |
| 3 | `listTransfers retourne les 3 transferts` | `listTransfers().length` | `=== 3` | valide la cardinalité, pas le comportement |

(`test/transfers.test.js:5-16`)

**Test 1 — VÉRIFIÉ_CODE.** L'assertion `seatsLeft({ seats: 40, sold: 12 }) === 28` vérifie le calcul `seats - sold` avec des fixtures isolées, indépendantes du tableau `transfers` en mémoire. C'est un test comportemental correct.

**Test 2 — VÉRIFIÉ_CODE.** L'assertion couvre les deux branches de `isFull` : complet (`sold === seats`) et non complet (`sold < seats`). C'est une couverture complète de la fonction. Rappel : `isFull` n'est pas utilisée par la route HTTP (`src/server.js:3`), mais son export et sa présence dans les tests signalent qu'elle est destinée à un usage futur.

**Test 3 — VÉRIFIÉ_CODE.** `listTransfers().length === 3` vérifie que le catalogue contient exactement trois transferts. Ce test est couplé à la donnée (`src/transfers.js:3-7`) et non au comportement de `listTransfers()`. Si un quatrième transfert est ajouté, ce test échoue non parce que la fonction est cassée, mais parce que le test vérifie une donnée. L'intention correcte serait `assert.ok(Array.isArray(listTransfers()))` ou vérifier qu'au moins un transfert est retourné avec les bons champs.

**Couverture de `src/server.js` — VÉRIFIÉ_CODE (absence).** Ni `sendJson`, ni le handler `http.createServer`, ni le routage, ni la projection `.map()`, ni le handler 404 ne sont couverts. Aucun fichier de test n'importe `src/server.js`. Le serveur est pourtant exporté via `module.exports = server` (`src/server.js:30`) — cette exportation a été posée pour permettre les tests d'intégration, mais aucun test ne l'utilise.

**Infrastructure de tests — VÉRIFIÉ_CODE.** `node:test` (Node.js ≥ 18) et `node:assert/strict` sont des modules natifs — aucune dépendance npm requise. `package.json:5` déclare `"engines": { "node": ">=18" }`, cohérent. `package.json:6` déclare `"test": "node --test test/"`. Les tests sont rapides (pas d'I/O, pas de réseau, logique pure) et reproductibles.

**Pas de CI configurée — VÉRIFIÉ_CODE (absence).** Aucun fichier `.github/workflows/`, `.circleci/`, `Jenkinsfile` ni équivalent dans le dépôt. Les tests ne s'exécutent pas automatiquement lors des commits.

## Forces

- **Tests purs et rapides** : aucune dépendance externe, aucun I/O, exécution instantanée.
- **Fixtures inline** : les tests 1 et 2 injectent leurs propres objets `{ seats, sold }` sans dépendre des données réelles du catalogue — ils resteront valides si les données changent.
- **Runner natif** : `node:test` sans `devDependency` maintient la philosophie zéro-dépendance du projet.
- **`isFull` couverte dans ses deux branches** : la logique de détection de transfert complet est validée (même si la fonction n'est pas exposée HTTP).

## Dettes techniques

- **Route HTTP entièrement non testée** : `src/server.js` n'a aucun test. La fonctionnalité principale du service (`GET /transfers`) n'est pas vérifiée automatiquement.
- **Test 3 couplé à la donnée** : `listTransfers().length === 3` (`test/transfers.test.js:14`) casse dès qu'un 4e transfert est ajouté, pour une raison non liée à un bug fonctionnel.
- **`sendJson` non testée** : la seule fonction de sérialisation HTTP n'a aucun test. (`src/server.js:5-8`)
- **Absence de CI** : les tests ne s'exécutent pas automatiquement.

## Zones critiques

- **La route `GET /transfers` n'a pas de test** : c'est l'unique fonctionnalité livrée du service. Un bug dans la projection (mauvais champ omis ou ajouté) ou dans le routage (mauvaise condition) passerait inaperçu. Preuve : aucun import de `src/server.js` dans `test/`.

## Risques

- **Régression silencieuse sur la route HTTP** : toute modification de `src/server.js` (ajout d'une route, modification de la projection, correction du handler 404) est sans filet. Preuve : `src/server.js:30` — `module.exports = server` — le serveur est testable mais aucun test ne le fait.
- **Test 3 comme faux signal de qualité** : `listTransfers().length === 3` passe aujourd'hui — mais il valide la donnée, pas la logique. Si la fonction est modifiée pour filtrer ou trier, le test passera toujours tant que 3 transferts existent, masquant un bug éventuel de comportement.
- **Absence de CI** : sans exécution automatique des tests, une régression peut atteindre `origin/main` sans être détectée.

## Recommandations priorisées

1. **Ajouter un test de la route HTTP `GET /transfers`** — importer `server` depuis `src/server.js`, faire une requête HTTP native (`http.request`) ou via `supertest`, et vérifier la structure de la réponse (`status: 200`, `body[0].seatsLeft`, absence de `seats` et `sold`). Le serveur est déjà exporté et prêt. — `src/server.js:30`, `test/`
2. **Ajouter un test du handler 404** — même approche, requête sur `/inexistant` et vérification `status: 404`, `body.error === "Not found"`. — `src/server.js:23`
3. **Corriger le test 3** — remplacer `listTransfers().length === 3` par `assert.ok(listTransfers().length > 0)` et `assert.ok(listTransfers().every(t => 'id' in t && 'from' in t))` pour tester le comportement plutôt que la cardinalité des données. — `test/transfers.test.js:14-16`
4. **Configurer une CI minimale** (GitHub Actions ou équivalent) avec `npm test` sur chaque push/PR.

## Questions ouvertes

- `supertest` sera-t-il introduit pour les tests d'intégration HTTP, ou préfère-t-on rester sur `http.request` natif pour préserver la politique zéro-dépendance ?
- Le test de cardinalité (`length === 3`) est-il intentionnel — pour vérifier que le catalogue de démonstration n'a pas été altéré — ou est-ce un test de comportement mal formulé ? La réponse détermine si la recommandation 3 s'applique.
- Des tests e2e (client → API → réponse JSON) sont-ils prévus au niveau du projet `shift-pilot-resa-web` pour couvrir la chaîne complète ?
