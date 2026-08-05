# Fonctionnel — Audit

> Confiance : high

## Compréhension globale

`shift-pilot-resa-api` est explicitement labellisé « pilote de test SHIFT/Paperclip » (`README.md:3`) et « données en mémoire, pilote de démonstration » (`src/transfers.js:1`). L'unique fonctionnalité implémentée est la consultation du catalogue de transferts avec disponibilité calculée à la volée (`GET /transfers`). Aucun endpoint de réservation n'existe. Les données sont statiques. Le service répond à sa question pilote mais ne constitue pas une API de réservation opérationnelle.

## Résumé exécutif

La fonctionnalité implémentée — lister les transferts inter-îles avec le nombre de places restantes — est correcte, cohérente, et testée pour sa partie logique. En revanche, l'API de réservation annoncée par le nom du service (`resa-api`) est absente : `sold` n'est jamais incrémenté, il n'existe pas de `POST /bookings` ni aucun équivalent. Trois incohérences fonctionnelles mineures sont observées : `isFull` est exportée mais non exposée dans la réponse HTTP (les clients ne reçoivent pas d'indicateur de saturation explicite) ; le transfert Papeete→Bora Bora (`seatsLeft: 0`) apparaît dans la liste sans signal d'indisponibilité ; et CORS n'est pas configuré, ce qui bloquera le frontend web en contexte navigateur. Ces points sont cohérents avec le périmètre pilote déclaré mais devront être traités avant tout déploiement orienté utilisateur final.

## Constats détaillés

**Fonctionnalité implémentée : `GET /transfers`** — `VÉRIFIÉ_CODE` (`src/server.js:13-20`) : la route répond à toute requête `GET /transfers` en retournant un tableau JSON de 3 objets, chacun contenant `id, from, to, price, seatsLeft`. La projection exclut `seats` et `sold` (données internes). `seatsLeft` est calculé à la volée par `seatsLeft(t)` (`src/transfers.js:13-15`). La réponse a le statut `200` et le header `Content-Type: application/json` (`src/server.js:6`).

**Fonctionnalité manquante : réservation** — `VÉRIFIÉ_CODE` : aucun endpoint `POST`, `PUT`, `PATCH` ni `DELETE` n'est déclaré dans `src/server.js` (lu en entier, 30 lignes). Le champ `sold` n'est jamais modifié au runtime (`src/transfers.js:3-7` — tableau statique ; grep de `src/` : zéro occurrence de `sold =`). Le service ne peut pas traiter de réservation. Son nom (`shift-pilot-resa-api`, `resa-api` dans `src/server.js:28`) suggère que c'est la fonctionnalité cible non encore implémentée.

**`isFull` non exposée côté HTTP** — `VÉRIFIÉ_CODE` : `isFull` est exportée (`src/transfers.js:21`) mais absente de l'import `src/server.js:3` et de la projection de réponse (`src/server.js:14-20`). Le client HTTP reçoit `seatsLeft: 0` pour le transfert id 2, mais pas de champ `isFull: true` ni `available: false`. `HYPOTHÈSE` : c'est un oubli de câblage préparatoire, pas une décision fonctionnelle documentée.

**Transfert complet visible sans signal** — `VÉRIFIÉ_CODE` (`src/transfers.js:5: sold: 60, seats: 60`) : le transfert Papeete→Bora Bora (id 2) apparaît dans la réponse `GET /transfers` avec `seatsLeft: 0` sans champ discriminant. Un client souhaitant filtrer les transferts disponibles doit implémenter lui-même la règle `seatsLeft === 0`. `HYPOTHÈSE` : aucun filtre côté API n'est prévu dans le pilote, mais cela devra être adressé pour une UX correcte.

**Cohérence de la réponse HTTP** — `VÉRIFIÉ_CODE` : le format de réponse est cohérent entre les deux workflows documentés (`WORKFLOW_LISTE_TRANSFERTS.md`, `WORKFLOW_CALCUL_DISPONIBILITE.md`) et le code source. Aucune incohérence de schéma entre les workflows et l'implémentation.

**Route 404 catch-all** — `VÉRIFIÉ_CODE` (`src/server.js:23`) : toute URL non reconnue (y compris `GET /transfers/1`, `POST /transfers`, toute autre route) retourne `{ error: "Not found" }` en statut 404. C'est fonctionnellement correct pour le pilote, mais sans distinction entre « méthode non supportée » (405) et « ressource inexistante » (404).

**CORS absent** — `VÉRIFIÉ_CODE` : `sendJson` (`src/server.js:5-8`) ne pose pas de header `Access-Control-Allow-Origin`. `README.md:4` confirme que `shift-pilot-resa-web` consomme cette API. En contexte navigateur (origine différente), les requêtes `GET /transfers` seront rejetées avant même d'atteindre le serveur. `HYPOTHÈSE` : dans le contexte pilote, les deux services tournent peut-être sur la même origine ou un proxy est configuré — non vérifié dans ce dépôt.

## Forces

- `GET /transfers` implémenté correctement, sortie JSON bien formée, champs internes correctement exclus (`src/server.js:14-20`).
- Séparation claire entre la règle de calcul (`seatsLeft` dans `src/transfers.js`) et la présentation HTTP (`src/server.js`).
- Le service est honnêtement labellisé pilote — pas de fausse promesse fonctionnelle.

## Dettes techniques

- **Endpoint de réservation absent** : le cœur de l'API (`resa`) n'est pas implémenté.
- **`isFull` non câblée** : la règle de saturation existe mais n'est pas exposée aux clients.
- **Pas de distinction 404/405** : toute requête non reconnue retourne 404 sans indiquer si c'est la méthode ou la route qui est en faute.
- **CORS absent** : bloquant pour le frontend web en contexte cross-origin.

## Zones critiques

- L'absence de endpoint de réservation (`POST /bookings` ou équivalent) est le gap fonctionnel central : sans lui, `sold` reste statique et la disponibilité affichée est fictive.

## Risques

- **Crédibilité de la disponibilité** : `seatsLeft` reflète des valeurs hardcodées, pas l'état réel de vente. Si `shift-pilot-resa-web` affiche ces données comme « disponibilité en temps réel », c'est trompeur. `HYPOTHÈSE` : dans le contexte pilote, c'est accepté.
- **Frontend bloqué en navigateur** : l'absence de CORS bloque `shift-pilot-resa-web` dès qu'il tourne sur une origine différente.

## Recommandations priorisées

1. **Implémenter CORS** (au minimum `Access-Control-Allow-Origin: *` ou l'origine exacte de `shift-pilot-resa-web`) — bloquant pour le frontend — `src/server.js:5-8`
2. **Ajouter `isFull` à la projection** de `GET /transfers` (ou un champ `available: boolean`) — `src/server.js:14-20` — cohérence fonctionnelle immédiate
3. **Implémenter un endpoint de réservation** (`POST /bookings` ou `POST /transfers/:id/book`) avec incrémentation de `sold` — périmètre complet de l'API ; requiert une décision de persistance (voir `DATA_MODEL_AUDIT.md`)
4. **Distinguer 404 et 405** — mineur mais améliore le debugging pour les intégrateurs

## Questions ouvertes

- L'endpoint de réservation est-il prévu dans ce service (`shift-pilot-resa-api`) ou dans un autre service du projet SHIFT ?
- La disponibilité « temps réel » est-elle un objectif pilote ou une fonctionnalité différée à la phase suivante ?
- `shift-pilot-resa-web` est-il servi via un proxy qui co-localise les deux services sur la même origine, ou sur des origines distinctes ?
