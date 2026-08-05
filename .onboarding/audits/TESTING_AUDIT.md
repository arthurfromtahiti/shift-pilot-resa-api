# Tests — Audit

> Confiance : high

## Compréhension globale

La suite de tests est un fichier unique (`test/transfers.test.js`, 16 lignes) utilisant le runner natif Node.js (`node:test`, `node:assert/strict`). Elle contient 3 tests unitaires ciblant les 3 fonctions exportées de `src/transfers.js`. Aucun test HTTP n'existe. La surface testée est entièrement limitée aux fonctions pures de calcul ; l'unique point d'entrée du service (`GET /transfers`) est intégralement non testé.

## Résumé exécutif

La couverture observable est volontairement minimale, cohérente avec la nature pilote du projet. Les 3 tests couvrent les cas heureux des fonctions pures (`seatsLeft`, `isFull`, `listTransfers`) et sont corrects. Le gap central est l'absence complète de tests HTTP : le comportement du serveur (codes de statut, format JSON, headers, gestion du 404) n'est validé par aucun test automatisé. Le guard `require.main === module` (`src/server.js:27`) a été explicitement posé pour permettre ce type de test, mais n'a jamais été utilisé. L'arbre de cas non testés comprend également les valeurs limites des fonctions de calcul et le comportement sur données invalides.

## Constats détaillés

**Tests existants** — `VÉRIFIÉ_CODE` : `test/transfers.test.js` contient 3 tests :

- `test("seatsLeft calcule les places restantes", ...)` (lignes 5-7) : un seul cas positif, `{ seats: 40, sold: 12 } → 28`. Correct.
- `test("isFull detecte un transfert complet", ...)` (lignes 9-12) : deux cas — plein (`{ seats: 60, sold: 60 } → true`) et non plein (`{ seats: 40, sold: 12 } → false`). Correct.
- `test("listTransfers retourne les 3 transferts", ...)` (lignes 14-16) : vérifie `listTransfers().length === 3`. Correct sur le compte, mais ne valide ni les champs, ni les valeurs, ni l'ordre.

Les 3 tests passent sur des objets littéraux construits ad hoc — ils ne dépendent pas du tableau `transfers` en mémoire pour les calculs (sauf `listTransfers` qui l'utilise directement).

**Runner et configuration** — `VÉRIFIÉ_CODE` : `package.json:6` définit `"test": "node --test test/"`. Node.js ≥18 requis (`package.json:5: "node": ">=18"`). Aucune dépendance externe de test (Jest, Mocha, etc.). Le runner natif `node:test` est approprié pour cette échelle.

**Zéro test HTTP** — `VÉRIFIÉ_CODE` : `test/transfers.test.js:1-3` importe uniquement depuis `../src/transfers` — jamais `../src/server`. Le handler HTTP (`src/server.js:10-24`), la logique de routage (`src/server.js:13`), la projection JSON (`src/server.js:14-20`), le code 404 (`src/server.js:23`) et la fonction `sendJson` (`src/server.js:5-8`) sont non testés. Le guard `require.main === module` (`src/server.js:27`) permettrait d'importer le serveur et de lui envoyer des requêtes via `http.request` ou un supertest-like — cette capacité est inexploitée.

**Cas limites non testés** — `VÉRIFIÉ_CODE` sur les fonctions de calcul :

- `seatsLeft` : seul le cas `sold < seats` est couvert. Manquent : `sold === 0` (résultat = `seats`), `sold === seats` (résultat = 0, frontière), `sold > seats` (résultat négatif — comportement silencieusement incohérent).
- `isFull` : les deux cas booléens sont couverts, mais la frontière `sold === seats` est atteinte via `{ seats: 60, sold: 60 }` — c'est suffisant pour cette fonction.
- `listTransfers` : seule la longueur est vérifiée. Un refactoring qui change les noms de champs passerait ce test sans avertissement.

**Absence de test d'intégration** — `VÉRIFIÉ_CODE` : aucun test ne démarre le serveur, ne lui envoie une requête HTTP, et ne vérifie la réponse. Le comportement observable par un client réel (codes HTTP, format de réponse, headers) n'est validé par aucun artefact automatisé.

## Forces

- Runner natif (`node:test`) : zéro dépendance externe, aligné avec `package.json:7`.
- Tests des fonctions pures corrects et indépendants des données en mémoire (construction ad hoc d'objets de test).
- Guard `require.main === module` (`src/server.js:27`) : la testabilité du serveur est architecturalement prévue.

## Dettes techniques

- **Aucun test HTTP** : le comportement du serveur est intégralement non testé.
- **Cas limites manquants** pour `seatsLeft` : `sold === 0`, `sold === seats`, `sold > seats`.
- **`listTransfers` ne valide pas le contenu** : un test vérifiant les champs et valeurs des objets retournés détecterait une régression de schéma.

## Zones critiques

- `src/server.js` entier : zéro couverture de test. C'est l'unique point d'entrée du service — son comportement n'est garanti par aucun test.
- `src/server.js:11` (parsing URL) : le vecteur de crash identifié dans `CODE_HOTSPOTS_AUDIT.md` est aussi le chemin le moins testé.

## Risques

- **Régression silencieuse sur le format HTTP** : un refactoring de `sendJson` ou de la projection (`src/server.js:5-8, 14-20`) ne serait détecté par aucun test existant.
- **Régression sur `seatsLeft` à la frontière** : si la règle de saturation change (ex. seuil à 1 place restante plutôt que zéro), le test existant de `seatsLeft` n'est pas suffisant pour valider la frontière.

## Recommandations priorisées

1. **Ajouter un test HTTP sur `GET /transfers`** (statut 200, Content-Type, structure du JSON retourné) — couvrir le chemin critique du service — `src/server.js:13-20`
2. **Ajouter un test HTTP sur le 404** (statut 404, corps `{ error: "Not found" }`) — `src/server.js:23`
3. **Ajouter les cas limites de `seatsLeft`** : `sold === 0`, `sold === seats` (= 0), `sold > seats` (comportement attendu à décider) — `test/transfers.test.js`
4. **Renforcer le test `listTransfers`** : vérifier la structure des objets retournés (présence des champs `id, from, to, price, seatsLeft`) en plus du compte

## Questions ouvertes

- Un test d'intégration HTTP est-il attendu dans ce pilote, ou la décision est-elle de ne pas en écrire jusqu'à l'implémentation de l'endpoint de réservation ?
- Le comportement de `seatsLeft` pour `sold > seats` doit-il lever une erreur ou retourner `0` (saturation safe) ? Cette décision détermine quels cas de test écrire.
