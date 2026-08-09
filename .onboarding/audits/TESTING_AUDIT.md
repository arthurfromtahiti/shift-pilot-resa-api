# Tests — Audit

> Confiance : high
> Mode : RÉCONCILIATION SHIA-571 (HEAD `8a108d1`). 21 tests, 21 pass, 0 fail — confirmé par exécution de `npm test` (`node --test test/*.test.js`) sur le checkout courant par l'agent relecteur (état HEAD `8a108d1`).

## Compréhension globale

Le projet dispose de deux fichiers de tests couvrant la logique métier pure et le comportement HTTP de bout en bout. La suite a été étoffée au fil des évolutions (SHIA-396 : annulation ; SHIA-408 : filtre disponibilité). Elle compte désormais **21 tests, 21 pass, 0 fail** (exécution vérifiée par `npm test` sur le checkout courant). Les lacunes documentées dans la version initiale de cet audit (pas de test `GET`, pas de cas limites `seats`, `bookSeats` non testé directement) ont été comblées. Il reste une fragilité structurelle d'isolation de l'état.

## Résumé exécutif

**21 tests** répartis sur deux fichiers. `test/transfers.test.js` (9 tests) couvre les fonctions pures `seatsLeft`, `isFull`, `listTransfers`, `bookSeats` (validation + reservationId) et `cancelReservation` (nominal, ID inconnu, transferId incohérent, double-annulation). `test/server.test.js` (12 tests) couvre `POST /reserve` (200/409/404/400 × 3 variantes), `DELETE /reservations/:id` (200/404 dont transferId incorrect), `GET /transfers` (200 + filtre `?available=true`). La couverture est devenue solide. La dette résiduelle principale est l'isolation d'état : les tests mutent un état global partagé, et plusieurs assertions reposent sur les valeurs initiales du catalogue — si l'ordre d'exécution changeait, certains tests échoueraient.

## Constats détaillés

**`test/transfers.test.js` — 9 tests unitaires (`VÉRIFIÉ_CODE`)** : teste `seatsLeft` avec fixture inline (ligne 5-7), `isFull` sur deux cas (lignes 9-12), `listTransfers` en vérifiant le count (lignes 14-16), `bookSeats` avec valeurs invalides `0 / -1 / 1.5 / "2"` (lignes 18-23), `bookSeats` en succès avec vérification du type de `reservationId` (lignes 25-31), `cancelReservation` en succès avec vérification du delta de places (lignes 33-39), `cancelReservation` sur ID inconnu (lignes 41-43), `cancelReservation` quand le `transferId` ne correspond pas à la réservation (lignes 44-50 — nettoyage inclus), et double-annulation de la même réservation (lignes 52-56). Les tests de `cancelReservation` utilisent le transfert 3 et nettoient leur état via une annulation ou en vérifiant que l'opération échoue.

**`test/server.test.js` — 12 tests d'intégration HTTP (`VÉRIFIÉ_CODE`)** : le serveur démarre sur un port éphémère (`server.listen(0)`, ligne 9) et se ferme après (`server.close()`, ligne 15). Les tests couvrent :
- `POST /transfers/1/reserve` → 200, `seatsLeft: 27` (ligne 58-64) — mute l'état du transfert 1
- `POST /transfers/2/reserve` (complet) → 409 (lignes 66-70)
- `POST /transfers/999/reserve` (inexistant) → 404 (lignes 72-76)
- `POST /transfers/3/reserve seats: 0` → 400 (lignes 78-82)
- `POST /transfers/3/reserve seats: -1` → 400 (lignes 84-88)
- `POST /transfers/3/reserve seats: 1.5` → 400 (lignes 90-94)
- `POST /reserve` retourne un `reservationId` typé string non vide (lignes 96-102)
- `DELETE /reservations/:id` → 200 avec `seatsLeft` correct (book 2 + cancel, delta vérifié, lignes 104-111)
- `DELETE /reservations/unknown` → 404 (lignes 113-117)
- `DELETE /transfers/:wrongId/reservations/:id` → 404 + nettoyage (lignes 119-126)
- `GET /transfers` → 200, 3 transferts, `seatsLeft` typé (lignes 128-133)
- `GET /transfers?available=true` → exclut le transfert complet id=2, tous `seatsLeft > 0` (lignes 135-140)

**Mutation d'état partagé — fragilité résiduelle (`VÉRIFIÉ_CODE`)** : `server.test.js:63` (`assert.equal(res.body.seatsLeft, 27)`) est une assertion absolue — elle suppose que `transfer.sold` vaut `12` au démarrage du test. Cela fonctionne uniquement parce que : (a) `server.test.js` s'exécute avant `transfers.test.js` dans l'ordre alphabétique du glob `test/*.test.js` ; (b) aucun test précédent dans `server.test.js` ne touche le transfert 1. Si l'ordre changeait ou si un nouveau test était inséré avant, cette assertion échouerait sans message d'erreur clair. La fragilité n'est pas hypothétique mais structurelle — elle repose sur l'ordre d'exécution implicite.

**Accumulation de `sold` sur le transfert 3 (`VÉRIFIÉ_CODE`)** : plusieurs tests (unitaires dans `transfers.test.js` et HTTP dans `server.test.js`) réservent sur le transfert 3 sans toujours annuler. Le total de `sold` après l'intégralité des 21 tests est supérieur à la valeur initiale (5). Les tests qui portent des assertions relatives (delta de places) restent corrects, mais si un test échouait au milieu d'une paire book+cancel, le catalogue se retrouverait dans un état inattendu pour les tests suivants.

**Lacunes résiduelles (`VÉRIFIÉ_CODE`)** :
- Pas de test pour le cas où `bookSeats` reçoit un `seats` supérieur à la capacité disponible sur un transfert non complet (ex. 100 sièges sur le transfert 1 qui en a 28 de libres) — la logique `seatsLeft < seats` est testée via le 409 sur le transfert 2, mais toujours en testant le cas extrême (transfert plein) plutôt que le dépassement partiel.
- La protection de `cancelReservation` contre un `transfer` non trouvé à la ligne 40 de `src/transfers.js` n'est pas testée directement (impossible dans le flow normal, mais pas couvert explicitement).

**Stack de test (`VÉRIFIÉ_CODE`)** : `node:test` et `node:assert/strict` (stdlib Node.js) — aucune dépendance de test externe. La commande `node --test test/*.test.js` dans `package.json:6` est directe. Le pattern d'intégration HTTP (port 0, `before`/`after`) est correct et idiomatique.

## Forces

- **Couverture de bout en bout complète** : les 3 endpoints (`GET /transfers` avec son filtre optionnel `?available=true`, `POST /reserve`, `DELETE /reservations/:id`) sont tous exercés par des tests HTTP démarrant un vrai serveur (`test/server.test.js`). Le filtre est un paramètre de requête, pas un endpoint distinct — 3 routes, non 4. Pas de mocking de `http`.
- **Cas limites de `seats` couverts** : `0`, `-1`, `1.5` sont tous testés avec vérification du 400 (`test/server.test.js:78-94`). Un bug sur la validation serait détecté.
- **`cancelReservation` bien couverte** : nominal, ID inconnu, transferId incohérent, double-annulation — 4 cas unitaires + 3 cas HTTP.
- **`bookSeats` a des tests unitaires directs** : `test/transfers.test.js:18-31` teste la validation et le retour de reservationId séparément du comportement HTTP.
- **Aucune dépendance de test externe** : zéro configuration à maintenir.

## Dettes techniques

- **Isolation de l'état globale insuffisante** : l'état du catalogue est partagé entre tous les tests, sans `beforeEach`/`afterEach` de remise à zéro. Les assertions absolues (ex. `seatsLeft: 27`) reposent sur l'ordre d'exécution implicite — source de fragilité si les tests sont réordonnés ou rejoués.
- **Test de dépassement partiel manquant** : le cas "moins de places disponibles que demandées, mais transfert non complet" n'a pas de test dédié. Le comportement est couvert par la logique de `bookSeats` mais pas validé par un cas de test explicite.

## Zones critiques

- **`test/server.test.js:63`** : assertion absolue `seatsLeft: 27` — point de fragilité le plus direct. Un nouveau test inséré avant qui réserve sur le transfert 1 cassera ce test sans rapport avec le code métier.
- **`test/transfers.test.js:25-31`** (`bookSeats retourne un reservationId`) : réserve sur le transfert 3 sans annuler — contribue à l'accumulation de `sold` sur ce transfert tout au long de la suite.

## Risques

- **Flakiness en mode watch ou retry** : si `node:test` rejoue un test échoué sans redémarrer le process (dépend du runner), les assertions absolues sur `seatsLeft` s'exécutent dans un état divergent — `HYPOTHÈSE` (comportement dépendant du runner).
- **Fragilité à l'insertion de nouveaux tests** : tout nouveau test réservant sur le transfert 1 avant `test/server.test.js:58` casse l'assertion `seatsLeft: 27` — `VÉRIFIÉ_CODE` (structure de la suite actuelle).
- **Dépassement de capacité du transfert 3 en cas de suites étendues** : si de nombreux tests réservent sur le transfert 3 (seats: 20, sold: 5 initial, seatsLeft initial=15), la capacité peut s'épuiser pour les tests tardifs — `HYPOTHÈSE` (à vérifier si la suite s'étend).

## Recommandations priorisées

1. **Isoler l'état du catalogue entre les tests** : ajouter un mécanisme de remise à zéro (`sold` initial) dans un `beforeEach` ou après chaque test mutatif. Priorité : **moyenne** (la suite passe actuellement, mais chaque ajout de test augmente le risque de fragilité).
2. **Ajouter un test de dépassement partiel** : `POST /transfers/1/reserve` avec `seats: 30` (seatsLeft=27 après le premier test, donc 30 dépasse la capacité) → 409. Priorité : **basse** (la logique est couverte implicitement, mais le cas nominal est absent).
3. **Documenter l'ordre d'exécution dans le commentaire du test T1** : noter explicitement que `seatsLeft: 27` suppose `sold: 12` au démarrage, et qu'aucun autre test ne doit réserver sur le transfert 1 avant ce test. Priorité : **basse** (commentaire préventif, pas de correction fonctionnelle).

## Questions ouvertes

- Y a-t-il une intention de passer à un framework de test (Jest, Vitest) offrant des `beforeEach`/`afterEach` isolants ? `node:test` supporte des hooks mais pas l'isolation de module par défaut.
- Le test de double-annulation est couvert en unitaire (`test/transfers.test.js:52-56`) mais pas en HTTP (`test/server.test.js`). Est-ce intentionnel ?

## Journal de réconciliation

| Élément | Version précédente | Version actuelle (HEAD `8a108d1`) | Action |
|---|---|---|---|
| Nombre de tests | 6 (3 unitaires + 3 HTTP) | **21 (9 unitaires + 12 HTTP)** | Mis à jour — évolution majeure |
| `GET /transfers` sans test HTTP | Lacune documentée | **Comblée** — `test/server.test.js:128-133` | Lacune **retirée** |
| Filtre `?available=true` | Absent | **Testé** — `test/server.test.js:135-140` | **Ajouté** |
| Cas limites `seats` | Lacune documentée | **Comblée** — `test/server.test.js:78-94` | Lacune **retirée** |
| `bookSeats` sans test unitaire direct | Lacune documentée | **Comblée** — `test/transfers.test.js:25-31` | Lacune **retirée** |
| `cancelReservation` | Inexistant | **4 tests unitaires** + **3 tests HTTP** | **Ajouté** |
| `DELETE` endpoint HTTP | Inexistant | **3 tests** (200/404/404 wrong id) | **Ajouté** |
| `reservationId` dans la réponse | Non testé | **Testé** — `test/server.test.js:96-102` | **Ajouté** |
| Double-annulation | Non testé | **Testé unitaire** — `test/transfers.test.js:52-56` | **Ajouté** |
| Fragilité état partagé | Documentée (T1 sur transfert 1) | **Étendue** : plus de tests mutent l'état | Risque **étendu** |
| package.json ligne 6 | Erreur de numéro de ligne (relecture SHIA-353) | **Confirmé** : ligne 6 | Confirmé |
| Nombre d'endpoints | « 4 endpoints » (GET×2 + POST + DELETE) | **3 endpoints** : GET /transfers est un seul endpoint avec filtre optionnel `?available=true` — filtre = query param, pas une route distincte (`VÉRIFIÉ_CODE`) | **Corrigé post-relecture SHIA-571** |
