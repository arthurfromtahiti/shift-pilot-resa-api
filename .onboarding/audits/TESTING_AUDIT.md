# Tests — Audit

> Confiance : high

## Compréhension globale

Le projet dispose de deux fichiers de tests couvrant à la fois la logique métier pure et le comportement HTTP. La couverture nominale (les 3 cas POST documentés dans les workflows) est assurée. Mais des angles entiers restent non testés : le endpoint GET /transfers n'a aucun test HTTP, les cas limites de `seats` (négatif, nul, non-entier) sont absents, et les tests partagent un état global mutable sans isolation.

## Résumé exécutif

Six tests au total, répartis sur deux fichiers. Trois tests unitaires (`test/transfers.test.js`) couvrent les fonctions pures `seatsLeft`, `isFull` et `listTransfers`. Trois tests d'intégration HTTP (`test/server.test.js`) couvrent les trois cas nominaux de `POST /transfers/:id/reserve` (200, 409, 404). La couverture est cohérente avec ce que les workflows documentent comme cas de test, mais elle présente trois lacunes structurelles : (1) `GET /transfers` n'a aucun test HTTP ; (2) aucun cas limite sur `seats` (négatif, nul, non-entier) n'est testé — ce qui laisse le bug de validation documenté dans l'audit sécurité non détecté par la suite automatique ; (3) le test T1 mute l'état global en réservant un siège sur le transfert 1, ce qui rend la suite non idempotente si l'ordre des tests changeait ou si T1 était relancé sans redémarrage du serveur.

## Constats détaillés

**`test/transfers.test.js` — tests unitaires de logique pure (`VÉRIFIÉ_CODE`)** : trois tests, 17 lignes. Ils testent `seatsLeft` avec des valeurs arbitraires (`{ seats: 40, sold: 12 }`, ligne 6), `isFull` sur un transfert complet et non complet (lignes 9-11), et `listTransfers` pour vérifier le count de 3 (ligne 14). Ces tests n'utilisent pas les données du catalogue réel — ils construisent leurs propres fixtures inline. Ils sont idempotents (pas de mutation) et n'ont aucune dépendance entre eux.

**`test/server.test.js` — tests d'intégration HTTP (`VÉRIFIÉ_CODE`)** : trois tests, 53 lignes. Le serveur est démarré sur un port éphémère (`server.listen(0)`, ligne 9) et fermé après (`server.close()`, ligne 15). T1 (ligne 34-40) POST sur le transfert 1 et vérifie `seatsLeft: 27` — ce test **mute** `transfer.sold` de 12 à 13 dans l'état global. T2 (ligne 42-46) POST sur le transfert 2 (complet) et vérifie 409. T3 (ligne 48-52) POST sur le transfert 999 (inexistant) et vérifie 404. Les tests T2 et T3 ne mutent pas d'état. T1 oui.

**Mutation d'état partagé entre tests (`VÉRIFIÉ_CODE`)** : `test/server.test.js:34-40` (T1) appelle `POST /transfers/1/reserve` avec un body `{}` (`JSON.stringify({})` = `"{}"` — le body envoyé est la chaîne `"{}"`, pas une chaîne vide ; `parsed.seats` est `undefined`, donc `seats ?? 1` vaut `1`), ce qui exécute `bookSeats(1, 1)` et incrémente `transfer.sold` de 12 à 13 dans le tableau global `transfers`. Si T1 est rejoué sans redémarrage du serveur (ex. dans un watch mode, ou si `node:test` rejoue les échecs), le `seatsLeft` attendu (27) ne correspondra plus — le test échouera. Si les tests étaient réordonnés et que T1 passait après un autre test qui réserve aussi sur le transfert 1, la même désynchronisation se produirait.

**`GET /transfers` sans aucun test HTTP (`VÉRIFIÉ_CODE`)** : `test/server.test.js` ne contient aucun `test("GET /transfers...")`. Le endpoint `src/server.js:13-21` — qui est le premier endpoint livré et le plus critique fonctionnellement pour le frontend — n'est couvert que par les tests unitaires de `listTransfers` (qui tesent la fonction métier, pas le comportement HTTP). Le statut de réponse, le format JSON (`id, from, to, price, seatsLeft`), et la projection correcte des champs (masquage de `seats` et `sold`) ne sont pas vérifiés par un test automatisé.

**Cas limites de `seats` non testés (`VÉRIFIÉ_CODE`)** : aucun test ne vérifie le comportement avec `seats: 0` (réservation nulle), `seats: -1` (réservation négative créant des places), `seats: 2.5` (non-entier), ou `seats: 100` (dépassement de capacité alors qu'il reste 28 places). Ces cas sont documentés comme problématiques dans l'audit sécurité mais ne sont pas couverts par la suite automatique. Leur absence signifie que le bug `seats: -1` ne serait pas détecté par `npm test`.

**`bookSeats` sans test unitaire direct (`VÉRIFIÉ_CODE`)** : `test/transfers.test.js` teste `listTransfers`, `seatsLeft` et `isFull`, mais pas `bookSeats`. Le comportement de `bookSeats` est testé indirectement via les tests HTTP dans `test/server.test.js`, mais les cas logiques (retour `not_found`, retour `full`, mutation de `sold`) ne sont pas vérifiés séparément du comportement HTTP.

**Stack de test standard et légère (`VÉRIFIÉ_CODE`)** : `node:test` et `node:assert/strict` (stdlib Node.js) — aucune dépendance de test externe. La commande `node --test test/*.test.js` dans `package.json` (ligne 6, clé `"scripts"`) est directe. Le pattern d'intégration HTTP (démarrage sur port 0, `before`/`after`) est correct et idiomatique.

## Forces

- **Tests d'intégration HTTP réels** : les tests POST démarrent une vraie instance du serveur sur un port éphémère et font de vraies requêtes HTTP — pas de mocking de `http`, pas de substitut. Le comportement de bout en bout (parsing, dispatch, réponse) est effectivement exercé (`test/server.test.js:8-52`).
- **Couverture des 3 cas nominaux POST** : 200 (succès), 409 (complet), 404 (inexistant) sont tous les trois couverts, ce qui correspond exactement aux cas documentés dans WORKFLOWS.md (scénarios T1-T3).
- **Aucune dépendance de test externe** : `node:test` et `node:assert/strict` suffisent. Zéro configuration de test à maintenir.

## Dettes techniques

- **`GET /transfers` non couvert par un test HTTP** : le seul endpoint de lecture n'a pas de test d'intégration — comportement HTTP, format JSON, projection des champs non vérifiés (`src/server.js:13-21`).
- **Cas limites de `seats` absents** : `seats ≤ 0`, `seats` non-entier, `seats` dépassant la capacité disponible ne sont pas testés — le bug sécurité `seats: -1` n'est pas détectable par la suite actuelle.
- **État global muté sans isolation** : T1 modifie `transfer.sold` du transfert 1 ; si le test est rejoué ou réordonné, les assertions sur `seatsLeft` peuvent échouer (`test/server.test.js:34-40`).
- **`bookSeats` sans test unitaire** : la fonction la plus critique du point de vue métier n'a pas de tests directs — ses comportements sont vérifiés uniquement à travers la couche HTTP.

## Zones critiques

- **`test/server.test.js:34-40`** (T1) : test qui mute l'état global, source d'instabilité potentielle si rejoué.
- **Absence de tests pour `GET /transfers`** : zone complète non couverte côté HTTP.

## Risques

- **Bug `seats: -1` non détectable par la suite de tests** : un développeur qui corrige ou modifie `bookSeats` n'a aucun test lui indiquant que les valeurs négatives sont invalides — le bug peut se réintroduire sans signal automatique — `VÉRIFIÉ_CODE`.
- **Régression silencieuse sur `GET /transfers`** : une modification du format de réponse (ex. renommer `seatsLeft` en `availableSeats`) passerait sans erreur de test — `VÉRIFIÉ_CODE`.
- **Flakiness potentielle de T1 en mode watch/retry** : si le test T1 est relancé sans redémarrage du serveur, `seatsLeft` ne sera plus 27 — le test échouera et son diagnostic sera trompeur — `HYPOTHÈSE` (dépend du runner utilisé).

## Recommandations priorisées

1. **Ajouter un test HTTP pour `GET /transfers`** : vérifier le statut 200, le type de réponse, et au moins la structure d'un objet retourné (`id`, `from`, `to`, `price`, `seatsLeft` présents, `seats` et `sold` absents). Priorité : **haute** (endpoint critique non couvert).
2. **Ajouter des tests pour les cas limites de `seats`** dans `test/server.test.js` ou `test/transfers.test.js` : `seats: 0` (attendu : 400 ou rejet), `seats: -1` (attendu : 400 ou rejet), `seats: 100` sur le transfert 1 (attendu : 409). Ces tests documenteront le comportement attendu et détecteront le bug actuel. Priorité : **haute**.
3. **Ajouter des tests unitaires pour `bookSeats`** dans `test/transfers.test.js` : `bookSeats` sur un ID inexistant, sur un transfert complet, sur un transfert valide — séparément du comportement HTTP. Priorité : **moyenne**.
4. **Isoler l'état entre les tests HTTP** : soit réinitialiser `transfer.sold` dans un `beforeEach`/`afterEach`, soit reconstruire le catalogue à chaque test. Cela évite la dépendance d'ordre. Priorité : **moyenne**.

## Questions ouvertes

- Le test T1 est-il conçu pour s'exécuter dans un ordre défini et une seule fois ? Si oui, est-ce documenté quelque part ?
- Y a-t-il une intention de passer à un framework de test (Jest, Vitest) qui offrirait des `beforeEach`/`afterEach` plus expressifs et une isolation native ?
