# Fonctionnel — Audit

> Confiance : high
> Mode : RÉCONCILIATION SHIA-571 (HEAD `8a108d1`). Deux évolutions majeures depuis la version initiale : SHIA-396 a ajouté l'endpoint `DELETE /transfers/:id/reservations/:reservationId` (endpoint d'annulation), SHIA-408 a ajouté le filtre `?available=true` sur `GET /transfers` et câblé `isFull()` au runtime.

## Compréhension globale

L'API implémente trois endpoints correspondant à trois workflows documentés : consultation du catalogue (`GET /transfers`, filtrable via `?available=true`), réservation de sièges (`POST /transfers/:id/reserve`) et annulation de réservation (`DELETE /transfers/:id/reservations/:reservationId`). La cohérence interne de l'API est bonne. Une incohérence de nommage de champ avec le frontend reste probable mais non vérifiable depuis ce workspace.

## Résumé exécutif

Les trois endpoints fonctionnent conformément à leurs spécifications internes. La lacune fonctionnelle majeure des versions précédentes — l'absence d'endpoint d'annulation — est résolue depuis SHIA-396. `isFull()` est désormais câblée au runtime via le filtre `?available=true` (SHIA-408). La réponse `POST /reserve` inclut maintenant un `reservationId` (`src/server.js:45`). Les enjeux résiduels sont : la divergence probable `seatsLeft` / `availableSeats` avec le frontend (hypothèse, non vérifiable sur code), la sémantique ambiguë du 409 (couvre deux cas distincts), et le transfert 2 pré-complet dans le catalogue initial.

## Constats détaillés

**`GET /transfers` avec filtre de disponibilité (`VÉRIFIÉ_CODE`)** : `src/server.js:13-23` sert le catalogue complet ou filtré selon le paramètre `?available=true`. Avec le filtre, la liste est restreinte aux transferts dont `isFull(t)` est `false` (`src/server.js:14-15`). La projection retournée est `{ id, from, to, price, seatsLeft }` — les champs internes `seats` et `sold` ne fuient pas. `isFull()` est importée (`src/server.js:3`) et utilisée (`src/server.js:15`) — ce n'est plus du code mort.

**`POST /transfers/:id/reserve` — réservation (`VÉRIFIÉ_CODE`)** : `src/server.js:25-48` route la requête, collecte le corps asynchronement, valide `seats` (entier ≥ 1, sinon 400), appelle `bookSeats()`, et retourne selon le résultat : 404 si le transfert n'existe pas, 409 si la capacité est insuffisante, 200 `{ reservationId, transferId, seatsLeft }` en succès. La réponse de succès inclut désormais le `reservationId` (`src/server.js:45`), permettant au client de l'utiliser pour une annulation ultérieure.

**`DELETE /transfers/:id/reservations/:reservationId` — annulation (`VÉRIFIÉ_CODE`)** : `src/server.js:50-57` route la requête, extrait `transferId` et `reservationId` depuis l'URL, appelle `cancelReservation(reservationId, transferId)` (`src/server.js:54`), et retourne 404 si la réservation n'existe pas ou si le `transferId` URL ne correspond pas à la réservation, 200 `{ seatsLeft }` en succès. La validation de cohérence URL/ressource (`reservation.transferId !== transferId`, `src/transfers.js:39`) prévient les annulations cross-transfert.

**Divergence `seatsLeft` / `availableSeats`** — statut composite :
- **(a) L'API retourne `seatsLeft`** — `VÉRIFIÉ_CODE` : `GET /transfers` construit la projection `{ id, from, to, price, seatsLeft }` (`src/server.js:21`). Constat direct sur code présent dans ce workspace.
- **(b) Le frontend attendrait `availableSeats`** — `HYPOTHÈSE` : `.onboarding/documents/ECOSYSTEME.md:14-22` indique que `shift-pilot-resa-web/js/app.js:13` accède à `t.availableSeats`. Le code frontend n'est pas dans ce workspace — cette information provient d'un artefact écosystème, pas d'une lecture directe du code.
- **(c) Le champ s'afficherait comme `undefined` côté web** — `HYPOTHÈSE` : conséquence directe de (b), non observable depuis ce workspace.

**Sémantique du 409 ambiguë (`VÉRIFIÉ_CODE`)** : `bookSeats` retourne `reason: "full"` et `src/server.js:44` mappe cela en `409 { error: "Transfer full" }` dans deux cas distincts : (a) le transfert est totalement complet (0 places restantes) ; (b) le transfert a des places mais pas assez pour la quantité demandée. Dans le second cas, le message `"Transfer full"` est trompeur — le transfert n'est pas complet, il n'a juste pas assez de places pour cette demande. Un client qui reçoit 409 ne sait pas s'il doit abandonner ou réessayer avec moins de sièges.

**Transfert 2 toujours complet au démarrage (`VÉRIFIÉ_CODE` + `HYPOTHÈSE`)** : `src/transfers.js:7` initialise le transfert Papeete → Bora Bora avec `seats: 60, sold: 60` — `VÉRIFIÉ_CODE`. `sold` égale `seats` dès l'initialisation du module, sans qu'aucune réservation ait eu lieu. Ce transfert est utilisé par `test/server.test.js:66-70` (test 409) mais figure aussi dans le catalogue réel retourné par `GET /transfers`. Un utilisateur verra ce transfert comme complet dès le premier démarrage du service, et le filtre `?available=true` l'exclura systématiquement. L'intention (donnée de test ou état métier initial) n'est pas documentée dans le code — `HYPOTHÈSE`.

**Réponse 200 de réservation (`VÉRIFIÉ_CODE`)** : `POST /transfers/:id/reserve` retourne `{ reservationId, transferId, seatsLeft }` (`src/server.js:45`). Le `reservationId` est inclus depuis la mise en place de `bookSeats()`. La quantité de sièges réservés (`seatsReserved`) n'est pas retournée — un client ne peut pas confirmer combien de sièges ont été pris à partir de la réponse seule. Omission mineure pour un pilote.

**Pas d'authentification sur les trois endpoints (`VÉRIFIÉ_CODE`)** : aucun token, aucune session. `POST /reserve`, `DELETE /reservations/:id` et `GET /transfers` sont accessibles à tout client sans identification. Assumé pour le pilote.

## Forces

- **Trois endpoints cohérents entre eux** : `GET /transfers` expose `seatsLeft` calculé identiquement à `seatsLeft(transfer)` utilisé dans `bookSeats` et `cancelReservation`. Pas d'incohérence de calcul interne.
- **Tous les cas d'erreur documentés sont implémentés** : 404 (transfert inexistant, réservation inexistante, transferId incohérent), 409 (capacité insuffisante), 400 (valeur `seats` invalide) sont correctement retournés.
- **Projection publique correcte** : `GET /transfers` masque `seats` et `sold` — les internals ne fuient pas dans l'API publique (`src/server.js:16-22`).
- **`isFull()` câblée** : la fonction, auparavant exportée sans usage runtime, est désormais importée et utilisée (`src/server.js:3`, `src/server.js:15`) — pas de code mort sur ce point.
- **Cohérence avec la carte des domaines** : les fonctions documentées (`listTransfers`, `seatsLeft`, `isFull`, `bookSeats`, `cancelReservation`) correspondent exactement au code réel.

## Dettes techniques

- **Divergence `seatsLeft` / `availableSeats`** : l'API retourne `seatsLeft` (`VÉRIFIÉ_CODE`, `src/server.js:21`) ; si le frontend accède à `availableSeats`, le champ s'afficherait `undefined` côté web — `HYPOTHÈSE` (code frontend non lisible depuis ce workspace).
- **Message d'erreur 409 ambigu** : `"Transfer full"` couvre deux cas distincts (complet vs. pas assez de places) sans distinction (`src/server.js:44`).
- **Réponse de succès sans `seatsReserved`** : `{ reservationId, transferId, seatsLeft }` sans confirmation de la quantité réservée (`src/server.js:45`). Mineur.
- **Transfert 2 toujours complet au démarrage** : `id: 2` initialisé avec `sold == seats`, probable état de test non documenté dans le code, crée de la confusion en démonstration (`src/transfers.js:7`).

## Zones critiques

- **Contrat `seatsLeft` / `availableSeats`** (`src/server.js:21`) : probable point de blocage fonctionnel pour l'intégration frontend si la divergence de nommage est avérée (`HYPOTHÈSE`) — le product owner doit décider quel nom est canonique.
- **Sémantique du 409** (`src/server.js:44`) : un senior noterait que le même code d'erreur et le même message couvrent deux situations différentes — confus pour un client qui veut comprendre si une réservation partielle est possible.

## Risques

- **Workflow de consultation potentiellement non fonctionnel end-to-end** : si le frontend accède à `t.availableSeats` alors que l'API retourne `seatsLeft`, le champ s'affiche `undefined` — `HYPOTHÈSE` (code frontend non lisible depuis ce workspace ; source : `.onboarding/documents/ECOSYSTEME.md:14-22`). La partie API est fonctionnelle — `VÉRIFIÉ_CODE`.
- **Annulation sans authentification** : n'importe quel client connaissant un UUID peut annuler la réservation correspondante. L'UUID est l'unique protection — `VÉRIFIÉ_CODE`, assumé pour le pilote.
- **Transfert 2 toujours complet au démarrage** : le transfert Papeete → Bora Bora est plein dès l'initialisation du module, sans aucune réservation préalable — `VÉRIFIÉ_CODE` (`src/transfers.js:7`).

## Recommandations priorisées

1. **Aligner le nom de champ `seatsLeft` / `availableSeats`** : décider du nom canonique (API ou frontend qui change) et effectuer la correction. Priorité : **à confirmer après audit du dépôt frontend** — `HYPOTHÈSE` : si le frontend accède à `availableSeats`, le champ s'afficherait `undefined` dans le catalogue ; le code frontend n'est pas présent dans ce workspace et l'impact réel ne peut être établi d'ici. Côté API, `seatsLeft` est correctement renvoyé — `VÉRIFIÉ_CODE` (`src/server.js:21`).
2. **Distinguer les cas 409** : retourner deux messages distincts selon que le transfert est totalement complet (`"Transfer full"`) ou n'a pas assez de places pour la quantité demandée (`"Not enough seats"`) — `src/server.js:44`, `src/transfers.js:25-34` (ajouter un `reason` dédié). Priorité : **moyenne**.
3. **Corriger ou documenter le transfert 2 pré-complet** : soit initialiser `sold: 0` pour en faire un transfert disponible, soit le réserver aux tests et le retirer du catalogue réel — `src/transfers.js:7`. Priorité : **moyenne**.
4. **Enrichir la réponse 200 de réservation** : inclure `seatsReserved` dans `{ reservationId, transferId, seatsLeft, seatsReserved }` — `src/server.js:45`. Priorité : **basse**.

## Questions ouvertes

- Quel est le nom de champ canonique pour les places disponibles : `seatsLeft` (API actuelle) ou `availableSeats` (frontend probable) ?
- La réponse 409 doit-elle distinguer "transfert complet" de "pas assez de places" ? Décision product.
- La réponse 200 du DELETE `/reservations/:id` retourne `{ seatsLeft }` mais pas les sièges libérés. Faut-il ajouter `seatsRestored` pour symétrie avec la réservation ?

## Journal de réconciliation

| Élément | Version précédente | Version actuelle (HEAD `8a108d1`) | Action |
|---|---|---|---|
| Endpoint d'annulation | **Absent** — lacune fonctionnelle majeure | **Présent** — `DELETE /transfers/:id/reservations/:reservationId` (`src/server.js:50-57`) | Constat **retiré**, nouveau constat **ajouté** |
| `isFull()` | Exportée sans usage runtime (dead code) | **Câblée** — importée (`src/server.js:3`) et utilisée (`src/server.js:15`) | Statut **mis à jour** |
| Réponse 200 POST | `{ transferId, seatsLeft }` sans reservationId | **`{ reservationId, transferId, seatsLeft }`** (`src/server.js:45`) | Constat **mis à jour** |
| Filtre `?available=true` | Absent | **Présent** — `src/server.js:14-15` | **Ajouté** |
| Divergence `seatsLeft`/`availableSeats` | Partiellement `VÉRIFIÉ_CODE` (corrigé post-relecture) | Maintenu avec split `VÉRIFIÉ_CODE` (côté API) / `HYPOTHÈSE` (côté frontend) | **Confirmé** |
| Sémantique 409 | Identifié | **Confirmé** — toujours `"Transfer full"` pour les deux cas | Risque **confirmé** |
| Transfert 2 pré-complet | Identifié (`src/transfers.js:5`) | **Confirmé** — même situation, ligne mise à jour (`src/transfers.js:7` après ajout de `reservations Map` ligne 11) | Numéro de ligne **corrigé** (`5` → `7`) |
