# Fonctionnel — Audit

> Confiance : high

## Compréhension globale

L'API implémente deux endpoints correspondant à deux workflows documentés : consultation du catalogue (`GET /transfers`) et réservation de sièges (`POST /transfers/:id/reserve`). La cohérence interne de l'API est bonne, mais deux incohérences avec le front-end sont documentées et non corrigées, et plusieurs fonctionnalités annoncées dans les workflows sont absentes ou partiellement implémentées.

## Résumé exécutif

Les deux endpoints fonctionnent conformément à leurs spécifications internes. La principale incohérence fonctionnelle probable est le nom de champ `seatsLeft` retourné par l'API alors que le frontend (`shift-pilot-resa-web`) attendrait `availableSeats` (hypothèse — source `documents/ECOSYSTEME.md:14-22` ; code frontend non accessible dans ce workspace) — si confirmée, la consultation du catalogue ne peut pas fonctionner end-to-end depuis le web en l'état. La réservation est implémentée côté API mais le formulaire frontend est marqué « TODO » dans les workflows, ce qui signifie que le workflow de réservation n'est pas utilisable par un utilisateur réel. Une fonction exportée (`isFull`) n'est pas câblée à la logique de production. Enfin, le catalogue de démarrage contient un transfert pré-complet qui nuit à la lisibilité du produit.

## Constats détaillés

**Divergence `seatsLeft` / `availableSeats`** — statut composite :
- **(a) L'API retourne `seatsLeft`** — `VÉRIFIÉ_CODE` : `GET /transfers` construit la projection `{ id, from, to, price, seatsLeft }` (`src/server.js:19`). Constat direct sur code présent dans ce workspace.
- **(b) Le frontend attendrait `availableSeats`** — `HYPOTHÈSE` : `documents/ECOSYSTEME.md:14-22` indique que `shift-pilot-resa-web/js/app.js:13` accède à `t.availableSeats`. Le code frontend n'est pas dans ce workspace et n'a pas été lu directement — cette information provient d'un artefact écosystème, pas d'une lecture de code.
- **(c) Le champ s'afficherait comme `undefined` côté web** — `HYPOTHÈSE` : conséquence directe de (b), mais non observable depuis ce workspace.

Le code côté API est cohérent avec lui-même ; son incompatibilité avec le consommateur déclaré est probable mais non vérifiée sur code.

**Formulaire de réservation côté frontend absent (`VÉRIFIÉ_CODE` sur la documentation, incertitude sur l'état du frontend)** : WORKFLOWS.md indique explicitement `"Implémentation : TODO, pas encore dans le code du frontend"` pour le workflow 2 (réservation). L'API côté backend est complète (endpoint POST fonctionnel, 3 cas couverts), mais l'interface utilisateur qui devrait l'appeler n'existe pas encore. Le workflow de réservation end-to-end est donc techniquement implémenté côté API et fonctionnellement inaccessible côté utilisateur.

**`isFull` exportée mais non utilisée dans la logique de production (`VÉRIFIÉ_CODE`)** : `src/transfers.js:17-19` exporte une fonction `isFull(transfer)` qui retourne `seatsLeft(transfer) === 0`. Cette fonction n'est pas importée dans `src/server.js:3` (qui importe `listTransfers`, `seatsLeft`, `bookSeats` uniquement). La garde de complétude en production repose sur `seatsLeft(transfer) < seats` dans `bookSeats` (`src/transfers.js:24`), pas sur `isFull`. La fonction est uniquement utilisée dans `test/transfers.test.js:9-11`. Deux interprétations : soit `isFull` était prévue pour câbler une route de statut individuelle (`GET /transfers/:id`) jamais implémentée, soit elle est un résidu de conception initiale jamais nettoyé.

**Transfert 2 pré-complet dans le catalogue initial (`VÉRIFIÉ_CODE`)** : `src/transfers.js:5` initialise le transfert Papeete → Bora Bora avec `seats: 60, sold: 60`. Un utilisateur consultant `GET /transfers` au premier démarrage du service voit un transfert complet dans la liste — non parce qu'il y a eu des réservations, mais parce que c'est l'état initial. C'est un état de test (`test/server.test.js:42` l'utilise pour tester le 409) mélangé aux données du catalogue réel. Dans un contexte de démonstration ou de recette, cela peut induire en erreur.

**Réponse 409 sémantique inadéquate pour le cas « pas assez de places » (`VÉRIFIÉ_CODE`)** : `bookSeats` retourne `reason: "full"` et `src/server.js:38` mappe cela en `409 { error: "Transfer full" }` dans deux cas distincts : (a) le transfert est totalement complet (0 places restantes), et (b) le transfert a des places mais pas assez pour la quantité demandée (ex. 2 places demandées pour 1 disponible). Dans le second cas, le message `"Transfer full"` est trompeur — le transfert n'est pas complet, il n'a juste pas assez de places pour cette demande précise. Un client qui reçoit 409 `"Transfer full"` ne sait pas si le transfert est vraiment complet ou s'il devrait réessayer avec moins de sièges.

**Pas d'endpoint d'annulation (`VÉRIFIÉ_CODE`)** : aucun endpoint `DELETE` ou `POST /transfers/:id/cancel` n'existe. Une réservation effectuée est définitive jusqu'au redémarrage du process. Ce cas est documenté comme hors périmètre du pilote, mais il manque à la complétude fonctionnelle d'un service de réservation.

**Réponse 200 de réservation minimale (`VÉRIFIÉ_CODE`)** : `POST /transfers/:id/reserve` retourne `{ transferId, seatsLeft }` en cas de succès (`src/server.js:39`). Il manque le nombre de sièges réservés, la confirmation de l'action, et tout identifiant de réservation. Un client ne peut pas distinguer une réservation de 1 siège d'une réservation de 3 sièges à partir de la réponse — et il ne reçoit pas de référence pour consulter ou annuler sa réservation.

## Forces

- **Cohérence interne de l'API** : les deux endpoints sont cohérents entre eux — `GET /transfers` retourne `seatsLeft` calculé identiquement à `seatsLeft(transfer)` utilisé dans `bookSeats`. Pas d'incohérence de calcul interne.
- **Tous les cas d'erreur documentés sont implémentés** : 404 (transfert inexistant) et 409 (transfert complet) sont correctement retournés et correspondent aux contrats JSON documentés dans CARTE_DOMAINE.md.
- **Cohérence avec la carte des domaines** : les fonctions documentées (`listTransfers`, `seatsLeft`, `bookSeats`) correspondent exactement au code réel — la documentation n'est pas obsolète.

## Dettes techniques

- **Divergence `seatsLeft` / `availableSeats`** : incohérence connue et non corrigée entre l'API et le frontend — fonctionnalité principale cassée en intégration réelle (`src/server.js:19`).
- **`isFull` exportée sans usage production** : dead code ou feature plannée non implémentée (`src/transfers.js:17-19`).
- **Message d'erreur 409 ambigu** : `"Transfer full"` couvre deux cas distincts (complet vs. pas assez de places) sans distinction (`src/server.js:38`).
- **Réponse de succès pauvre** : `{ transferId, seatsLeft }` sans confirmation de la quantité réservée ni identifiant de réservation (`src/server.js:39`).

## Zones critiques

- **Contrat `seatsLeft` / `availableSeats`** (`src/server.js:19`) : c'est le point de blocage fonctionnel le plus immédiat — le product owner doit décider quel nom est canonique et quel côté change (API ou frontend).
- **Sémantique du 409** (`src/server.js:38`) : un senior noterait que le même code d'erreur couvre deux situations différentes avec le même message — confus pour un client qui essaie de comprendre pourquoi sa réservation a échoué.

## Risques

- **Workflow de consultation potentiellement non fonctionnel end-to-end** : si le frontend accède à `t.availableSeats` alors que l'API retourne `seatsLeft`, le champ s'affiche `undefined` et l'utilisateur ne peut pas évaluer la disponibilité d'un transfert — `HYPOTHÈSE` (le code frontend n'est pas dans ce workspace ; source : `documents/ECOSYSTEME.md:14-22`). La partie API de ce workflow est fonctionnelle — `VÉRIFIÉ_CODE`.
- **Réservations sans référence** : sans identifiant de réservation dans la réponse 200, il est impossible de construire une fonctionnalité d'annulation, de confirmation ou d'historique côté frontend. Chaque réservation est anonyme et non traçable — `VÉRIFIÉ_CODE`.

## Recommandations priorisées

1. **Aligner le nom de champ `seatsLeft` / `availableSeats`** : décider du nom canonique (API ou frontend qui change) et effectuer la correction. Priorité : **haute** (bloque le workflow principal end-to-end) — `src/server.js:19` ou le code frontend.
2. **Distinguer les cas 409** : retourner deux messages différents selon que le transfert est totalement complet (`"Transfer full"`) ou n'a pas assez de places pour la quantité demandée (`"Not enough seats"`) — `src/server.js:38`, `src/transfers.js:21-27` (ajouter un reason dédié). Priorité : **moyenne**.
3. **Enrichir la réponse 200 de réservation** : inclure `seatsReserved` dans `{ transferId, seatsLeft, seatsReserved }` pour que le client confirme la quantité réservée — `src/server.js:39`. Priorité : **basse** (manque de confort, pas de blocage fonctionnel).
4. **Décider du sort de `isFull`** : l'utiliser dans `bookSeats`, la câbler à une route dédiée, ou la supprimer — `src/transfers.js:17-19`. Priorité : **basse** (dead code, sans impact fonctionnel immédiat).

## Questions ouvertes

- Quel est le nom de champ canonique pour les places disponibles : `seatsLeft` (API actuelle) ou `availableSeats` (frontend actuel) ? Décision board/product.
- `isFull` est-elle une feature planifiée (future route de statut individuel) ou un résidu non nettoyé ?
- La réponse de succès `POST /reserve` doit-elle contenir un identifiant de réservation dès le pilote, ou cela attend-il la persistance en base de données ?
