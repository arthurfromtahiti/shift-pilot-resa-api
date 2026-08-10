# Fonctionnel — Audit

> Confiance : high

## Compréhension globale

L'API implémente deux endpoints correspondant à deux workflows documentés : consultation du catalogue (`GET /transfers`) et réservation de sièges (`POST /transfers/:id/reserve`). La cohérence interne de l'API est bonne, mais deux incohérences avec le front-end sont documentées et non corrigées, et plusieurs fonctionnalités annoncées dans les workflows sont absentes ou partiellement implémentées.

## Résumé exécutif

Les trois endpoints HTTP fonctionnent conformément à leurs spécifications internes : consultation du catalogue (`GET /transfers` avec filtrage optionnel par `?available=true`), réservation de sièges (`POST /transfers/:id/reserve`), et annulation (`DELETE /transfers/:id/reservations/:reservationId`). La principale incohérence fonctionnelle probable reste le nom de champ `seatsLeft` retourné par l'API alors que le frontend (`shift-pilot-resa-web`) attendrait `availableSeats` (hypothèse — source `documents/ECOSYSTEME.md:14-22` ; code frontend non accessible dans ce workspace) — si confirmée, la consultation du catalogue ne peut pas fonctionner end-to-end depuis le web en l'état. La réservation et son annulation sont implémentées côté API ; le formulaire frontend est marqué « TODO » dans les workflows, ce qui signifie que le workflow de réservation end-to-end n'est pas utilisable par un utilisateur réel. La fonction `isFull` est maintenant câblée au filtrage de disponibilité. Le catalogue de démarrage contient toujours un transfert pré-complet qui nuit à la lisibilité du produit.

## Constats détaillés

**Divergence `seatsLeft` / `availableSeats`** — statut composite :
- **(a) L'API retourne `seatsLeft`** — `VÉRIFIÉ_CODE` : `GET /transfers` construit la projection `{ id, from, to, price, seatsLeft }` (`src/server.js:21`). Constat direct sur code présent dans ce workspace.
- **(b) Le frontend attendrait `availableSeats`** — `HYPOTHÈSE` : `documents/ECOSYSTEME.md:14-22` indique que `shift-pilot-resa-web/js/app.js:13` accède à `t.availableSeats`. Le code frontend n'est pas dans ce workspace et n'a pas été lu directement — cette information provient d'un artefact écosystème, pas d'une lecture de code.
- **(c) Le champ s'afficherait comme `undefined` côté web** — `HYPOTHÈSE` : conséquence directe de (b), mais non observable depuis ce workspace.

Le code côté API est cohérent avec lui-même ; son incompatibilité avec le consommateur déclaré est probable mais non vérifiée sur code.

**Formulaire de réservation côté frontend absent (`VÉRIFIÉ_CODE` sur la documentation, incertitude sur l'état du frontend)** : WORKFLOWS.md indique explicitement `"Implémentation : TODO, pas encore dans le code du frontend"` pour le workflow 2 (réservation). L'API côté backend est complète (endpoint POST fonctionnel, 3 cas couverts), mais l'interface utilisateur qui devrait l'appeler n'existe pas encore. Le workflow de réservation end-to-end est donc techniquement implémenté côté API et fonctionnellement inaccessible côté utilisateur.

**`isFull` exportée et utilisée pour le filtrage disponibilité (`VÉRIFIÉ_CODE`, [SHIAAAAAAAAAAAAAAAAAAAAAAAA-408](SHIAAAAAAAAAAAAAAAAAAAAAAAA-408))** : `src/transfers.js:21-23` exporte une fonction `isFull(transfer)` qui retourne `seatsLeft(transfer) === 0`. Cette fonction est maintenant **importée et utilisée dans `src/server.js:3`** pour implémenter le filtrage côté serveur : `availableOnly ? listTransfers().filter((t) => !isFull(t)) : listTransfers()` (`src/server.js:14-15`). Le paramètre de requête `?available=true` permet de retourner uniquement les transferts avec places libres. La fonction est aussi utilisée dans `test/transfers.test.js:9-11`.

**Transfert 2 pré-complet dans le catalogue initial (`VÉRIFIÉ_CODE`)** : `src/transfers.js:5` initialise le transfert Papeete → Bora Bora avec `seats: 60, sold: 60`. Un utilisateur consultant `GET /transfers` au premier démarrage du service voit un transfert complet dans la liste — non parce qu'il y a eu des réservations, mais parce que c'est l'état initial. C'est un état de test (`test/server.test.js:42` l'utilise pour tester le 409) mélangé aux données du catalogue réel. Dans un contexte de démonstration ou de recette, cela peut induire en erreur.

**Réponse 409 sémantique inadéquate pour le cas « pas assez de places » (`VÉRIFIÉ_CODE`)** : `bookSeats` retourne `reason: "full"` (`src/transfers.js:29`) et `src/server.js:44` mappe cela en `409 { error: "Transfer full" }` dans deux cas distincts : (a) le transfert est totalement complet (0 places restantes), et (b) le transfert a des places mais pas assez pour la quantité demandée (ex. 2 places demandées pour 1 disponible). Dans le second cas, le message `"Transfer full"` est trompeur — le transfert n'est pas complet, il n'a juste pas assez de places pour cette demande précise. Un client qui reçoit 409 `"Transfer full"` ne sait pas si le transfert est vraiment complet ou s'il devrait réessayer avec moins de sièges.

**Endpoint d'annulation implémenté (`VÉRIFIÉ_CODE`, [SHIAAAAAAAAAAAAAAAAAAAAAAAA-353](SHIAAAAAAAAAAAAAAAAAAAAAAAA-353))** : l'endpoint `DELETE /transfers/:id/reservations/:reservationId` existe et permet d'annuler une réservation (`src/server.js:50-57`). Le transferId dans l'URL est validé pour cohérence ([SHIA-396](SHIA-396)) — la réservation doit appartenir au bon transfert.

**Réponse 200 de réservation enrichie (`VÉRIFIÉ_CODE`)** : `POST /transfers/:id/reserve` retourne maintenant `{ reservationId, transferId, seatsLeft }` en cas de succès (`src/server.js:45`), ce qui fournit un identifiant de réservation pour d'éventuelles annulations ultérieures. Il manque toujours le nombre de sièges réservés dans la réponse — la confirmation de la quantité et toute confirmation numérique d'action. Un client reçoit `reservationId` mais ne peut pas confirmer combien de sièges ont effectivement été réservés à partir de la réponse.

## Forces

- **Cohérence interne de l'API** : les deux endpoints sont cohérents entre eux — `GET /transfers` retourne `seatsLeft` calculé identiquement à `seatsLeft(transfer)` utilisé dans `bookSeats`. Pas d'incohérence de calcul interne.
- **Tous les cas d'erreur documentés sont implémentés** : 404 (transfert inexistant) et 409 (transfert complet) sont correctement retournés et correspondent aux contrats JSON documentés dans CARTE_DOMAINE.md.
- **Cohérence avec la carte des domaines** : les fonctions documentées (`listTransfers`, `seatsLeft`, `bookSeats`) correspondent exactement au code réel — la documentation n'est pas obsolète.

## Dettes techniques

- **Divergence `seatsLeft` / `availableSeats`** : incohérence connue et non corrigée entre l'API et le frontend — fonctionnalité principale cassée en intégration réelle (`src/server.js:21`).
- **Message d'erreur 409 ambigu** : `"Transfer full"` couvre deux cas distincts (complet vs. pas assez de places) sans distinction (`src/server.js:43-44`).
- **Réponse de succès pauvre** : `{ reservationId, transferId, seatsLeft }` retourne maintenant un identifiant de réservation (`src/server.js:45`) mais le nombre de sièges réservés n'est pas confirmé dans la réponse.

## Zones critiques

- **Contrat `seatsLeft` / `availableSeats`** (`src/server.js:21`) : c'est le point de blocage fonctionnel le plus immédiat — le product owner doit décider quel nom est canonique et quel côté change (API ou frontend).
- **Sémantique du 409** (`src/server.js:44`, `src/transfers.js:29`) : un senior noterait que le même code d'erreur couvre deux situations différentes avec le même message — confus pour un client qui essaie de comprendre pourquoi sa réservation a échoué.

## Risques

- **Workflow de consultation potentiellement non fonctionnel end-to-end** : si le frontend accède à `t.availableSeats` alors que l'API retourne `seatsLeft`, le champ s'affiche `undefined` et l'utilisateur ne peut pas évaluer la disponibilité d'un transfert — `HYPOTHÈSE` (le code frontend n'est pas dans ce workspace ; source : `documents/ECOSYSTEME.md:14-22`). La partie API de ce workflow est fonctionnelle — `VÉRIFIÉ_CODE`.
- ~~**Réservations sans référence**~~ : `POST /transfers/:id/reserve` retourne désormais `{ reservationId, transferId, seatsLeft }` (`src/server.js:45`) — le `reservationId` permet l'annulation via `DELETE /transfers/:id/reservations/:reservationId`. ✓ Résolue ([SHIAAAAAAAAAAAAAAAAAAAAAAAA-353](SHIAAAAAAAAAAAAAAAAAAAAAAAA-353)).

## Recommandations priorisées

1. **Aligner le nom de champ `seatsLeft` / `availableSeats`** : décider du nom canonique (API ou frontend qui change) et effectuer la correction. Priorité : **haute** (bloque le workflow principal end-to-end) — `src/server.js:21` ou le code frontend.
2. **Distinguer les cas 409** : retourner deux messages différents selon que le transfert est totalement complet (`"Transfer full"`) ou n'a pas assez de places pour la quantité demandée (`"Not enough seats"`) — `src/server.js:44`, `src/transfers.js:29` (ajouter un reason dédié). Priorité : **moyenne**.
3. **Enrichir la réponse 200 de réservation** : inclure `seatsReserved` dans `{ reservationId, transferId, seatsLeft, seatsReserved }` pour que le client confirme la quantité réservée — `src/server.js:45`. Priorité : **basse** (manque de confort, pas de blocage fonctionnel).
4. ~~**Décider du sort de `isFull`**~~  : maintenant utilisée pour le filtrage `?available=true` ([SHIAAAAAAAAAAAAAAAAAAAAAAAA-408](SHIAAAAAAAAAAAAAAAAAAAAAAAA-408)) — `src/transfers.js:21-23`, `src/server.js:15`. ✓ Résolue.

## Questions ouvertes

- Quel est le nom de champ canonique pour les places disponibles : `seatsLeft` (API actuelle) ou `availableSeats` (frontend actuel) ? Décision board/product.
- `isFull` est-elle une feature planifiée (future route de statut individuel) ou un résidu non nettoyé ?
- La réponse de succès `POST /reserve` doit-elle contenir un identifiant de réservation dès le pilote, ou cela attend-il la persistance en base de données ?
