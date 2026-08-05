# WORKFLOW_SUITE_TESTS — Exécution de la suite de tests unitaires

## Classification
- **Type** : `technical_flow`
- **Sous-type** : vérification / tests unitaires
- **Visibilité** : technical
- **Acteur principal** : Développeur (ou pipeline CI)
- **Acteurs** : Développeur / pipeline CI ; lanceur natif `node --test` (Node.js ≥ 18)
- **Criticité** : Basse — 3 tests de logique pure couvrant les fonctions métier de `src/transfers.js` ; aucune couverture de la route HTTP ni de la sérialisation.
- **Confiance** : high
- **Justification** : Fichier de test et commande `npm test` relus en intégralité, sans ambiguïté. Couverture réduite et absence de tests HTTP constatées directement dans le code, non inférées.

## Objectif
Valider que les trois fonctions de calcul de la logique métier — `seatsLeft`, `isFull`, `listTransfers` — retournent les valeurs correctes pour des fixtures déterministes. Constitue le filet de sécurité minimal contre les régressions sur la logique de disponibilité, sans dépendance externe ni serveur à démarrer.

## Acteurs
- **Développeur / pipeline CI** : lance `npm test` (ou `node --test test/` directement)
- **`node:test`** (`test/transfers.test.js:1`) : runner natif Node.js ≥ 18, sans dépendance npm

## Points d'entrée
- `npm test` → `node --test test/` (`package.json`, script `"test"`)

## Étapes principales
1. `npm test` invoque `node --test test/` (`package.json`).
2. Le runner Node.js découvre `test/transfers.test.js` ; les modules `node:test` et `node:assert/strict` sont chargés (`test/transfers.test.js:1-2`).
3. Les trois fonctions cibles sont importées depuis `../src/transfers` (`test/transfers.test.js:3`).
4. **Test 1 — `seatsLeft`** : `assert.equal(seatsLeft({ seats: 40, sold: 12 }), 28)` — vérifie que le calcul `seats - sold` est correct (`test/transfers.test.js:5-7`).
5. **Test 2 — `isFull`** : `assert.equal(isFull({ seats: 60, sold: 60 }), true)` et `assert.equal(isFull({ seats: 40, sold: 12 }), false)` — vérifie la détection du transfert complet et non-complet (`test/transfers.test.js:9-12`).
6. **Test 3 — `listTransfers`** : `assert.equal(listTransfers().length, 3)` — vérifie la cardinalité du catalogue en mémoire (`test/transfers.test.js:14-16`).
7. Le runner émet le résultat (format TAP ou natif) ; code de sortie `0` = succès, `≠ 0` = échec.

## Règles métier
- **Fixtures déterministes** : les tests 1 et 2 injectent leurs propres objets `{ seats, sold }` sans dépendre du tableau `transfers` de `src/transfers.js:3-7` — ils sont indépendants du catalogue réel. Seul le test 3 dépend des données en mémoire.
- **`isFull` testé ici seulement** : la fonction est validée par les tests (`test/transfers.test.js:9-12`) mais n'est jamais importée dans `src/server.js` (`src/server.js:3`). Les tests couvrent une surface plus large que ce que la route HTTP expose.
- **Aucune dépendance npm** : le runner utilise `node:test` et `node:assert/strict` (modules natifs Node.js ≥ 18). `package.json` déclare `"engines": { "node": ">=18" }` ; aucun `devDependency` n'est présent.

## Données
- Fixtures inline : `{ seats: 40, sold: 12 }`, `{ seats: 60, sold: 60 }` — valeurs isolées, pas d'import du catalogue réel pour les tests 1 et 2.
- `transfers` en mémoire (`src/transfers.js:3-7`) : utilisé uniquement pour le test de cardinalité (`listTransfers().length === 3`).

## Intégrations
Aucune intégration externe. Tests 100 % logique pure : aucune requête HTTP, aucune base, aucun système tiers.

## Risques
- **Aucune couverture de la route HTTP** : un bug dans `sendJson`, le routage par `url.pathname`/`req.method`, ou la projection `.map()` (`src/server.js:5-23`) ne serait pas détecté par cette suite. Le serveur est exporté (`src/server.js:30`, `module.exports = server`), ce qui rend un test d'intégration HTTP possible sans infrastructure supplémentaire.
- **Cardinalité hard-codée** : `listTransfers().length === 3` (`test/transfers.test.js:14-16`) casse dès qu'un 4e transfert est ajouté dans `src/transfers.js`. Le test vérifie la donnée figée, pas le comportement de la fonction.
- **`isFull` testé mais non exposé** : un futur développeur pourrait supprimer `isFull` du code source sans que la route HTTP en souffre, mais en cassant ce test — source de confusion si le lien avec une route future n'est pas documenté.

## Questions ouvertes
- Quand des tests de la route HTTP seront-ils ajoutés ? Le serveur exporté (`src/server.js:30`) est prêt pour un test `http.request` natif ou `supertest` sans modifier le code de production.
- Le test 3 doit-il vérifier le comportement de `listTransfers` (retourne bien un tableau) ou la cardinalité du catalogue (exactement 3 trajets) ? Ces deux intentions divergent dès qu'un trajet est ajouté.

## Preuves
- `test/transfers.test.js` — lu en intégralité (lignes 1-17)
- `package.json` — lu en intégralité
