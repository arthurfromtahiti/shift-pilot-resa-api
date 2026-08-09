# Points chauds du code — Audit

> Confiance : high
> Mode : RÉCONCILIATION SHIA-571 (HEAD `8a108d1`). Deux évolutions impactent les points chauds : SHIA-396 a ajouté `cancelReservation()` (nouveau point de mutation) et l'endpoint DELETE, SHIA-408 a câblé `isFull()` au runtime (n'est plus du code mort). Le codebase atteint désormais ~114 lignes de production.

## Compréhension globale

Le codebase est petit (~114 lignes de code de production sur 2 fichiers, ~140 lignes de tests sur 2 fichiers). La zone la plus dense reste le bloc POST dans `src/server.js`. Deux évolutions majeures ont modifié la carte des points chauds : `cancelReservation()` est devenu le second point de mutation d'état, et `isFull()` — précédemment code mort en production — est maintenant wired au runtime.

## Résumé exécutif

Le codebase a grandi de deux fonctions et d'un endpoint. La zone la plus risquée reste `src/server.js:25-48` (POST) qui mélange parsing asynchrone, validation et dispatch. Un second point chaud est apparu : `src/server.js:50-57` (DELETE) + `src/transfers.js:36-44` (`cancelReservation`). Le routage compte maintenant trois blocs `if/match` indépendants. `cancelReservation` est le second endroit où `transfer.sold` est muté — avec une absence de garde explicite pour le cas où `transfers.find()` retournerait `undefined` (impossible en flow normal, mais sans protection dans le code). `isFull()` n'est plus du code mort : elle est importée et utilisée dans `GET /transfers` avec le filtre `?available=true`.

## Constats détaillés

**`src/server.js:25-48` — zone de traitement POST, la plus couplée (`VÉRIFIÉ_CODE`)** : en 24 lignes, ce bloc effectue le matching de route, l'extraction et le cast du paramètre `id`, la collecte asynchrone du corps (`req.on("data")`/`"end"`), le parsing JSON avec fallback silencieux, la validation de `seats`, l'appel à `bookSeats`, et le mapping de tous les cas de réponse (200/400/404/409). Ces responsabilités multiples dans un même bloc rendent le code dense — chaque modification touche le même endroit et peut dégrader les autres comportements. Le traitement asynchrone (`req.on("end", () => {...})`) est correct mais augmente la profondeur d'imbrication.

**`src/server.js:50-57` — zone DELETE, nouveau point chaud (`VÉRIFIÉ_CODE`)** : en 8 lignes, ce bloc gère le matching regex, l'extraction de `transferId` et `reservationId`, l'appel à `cancelReservation`, et le mapping des réponses 200/404. Contrairement à la zone POST, il est synchrone (pas de lecture de corps). C'est la zone la plus récente et celle qui a le moins de tests de couverture des cas limites.

**`src/transfers.js:25-34` — `bookSeats`, premier point de mutation (`VÉRIFIÉ_CODE`)** : cette fonction de 10 lignes valide `seats`, recherche le transfert, vérifie la capacité, mute `transfer.sold += seats`, génère un UUID, enregistre dans `reservations`, et retourne le résultat. La validation `!Number.isInteger(seats) || seats < 1` est en place (ligne 26). Toujours la zone centrale de risque pour les réservations.

**`src/transfers.js:36-44` — `cancelReservation`, second point de mutation (`VÉRIFIÉ_CODE`)** : cette fonction de 9 lignes est le second endroit où `transfer.sold` est muté (`transfer.sold -= reservation.seats`, ligne 41) et où le registre `reservations` est modifié (`reservations.delete(reservationId)`, ligne 42). Elle vérifie l'existence de la réservation (ligne 37-38) et la cohérence `reservation.transferId === transferId` (ligne 39). Point à surveiller : `transfers.find(t => t.id === reservation.transferId)` à la ligne 40 ne dispose pas de garde si le transfert n'est pas trouvé — `transfers.find()` retournerait `undefined` et la ligne 41 (`transfer.sold -= ...`) lèverait un TypeError. Ce cas est structurellement impossible en fonctionnement normal (le `transferId` dans la Map vient nécessairement d'un `bookSeats()` réussi), mais l'absence de garde explicite est un signal.

**`isFull()` câblée au runtime (`VÉRIFIÉ_CODE`)** : `src/transfers.js:21-23` exporte `isFull()`. Elle est maintenant importée dans `src/server.js:3` et utilisée à `src/server.js:15` (filtre `?available=true`). N'est plus du code mort. La garde de complétude en production passe désormais par `isFull(t)` dans `GET /transfers` (pour le filtre), et par `seatsLeft(transfer) < seats` dans `bookSeats` (pour la réservation) — deux usages différents, cohérents avec leurs contextes respectifs.

**Routage manuel avec trois blocs (`VÉRIFIÉ_CODE`)** : `src/server.js:13`, `25` et `50` contiennent trois blocs de dispatching indépendants (GET `/transfers`, POST `/transfers/:id/reserve`, DELETE `/transfers/:id/reservations/:reservationId`). L'ordre de ces blocs est significatif : le GET simple est testé en premier, les deux avec regex ensuite. Un quatrième endpoint introduirait un quatrième bloc dont l'ordre relatif aux trois premiers doit être choisi consciemment. La densité de la fonction `createServer` augmente avec chaque endpoint.

**Absence de timeout applicatif sur la lecture du corps de requête (`VÉRIFIÉ_CODE`)** : `src/server.js:29-30` agrège le corps avec `req.on("data")` et attend `req.on("end")`. Aucun `server.setTimeout()` ni `req.setTimeout()` n'est posé dans le code applicatif. En pratique, le runtime Node.js applique un `requestTimeout` par défaut de 300 000 ms (5 min) depuis la v14.11.0, qui ferme la connexion si la requête complète n'est pas reçue dans ce délai — la fenêtre d'exposition est donc bornée par ce défaut, pas illimitée. Pour un pilote à usage unique, c'est négligeable ; pour un service exposé, un timeout applicatif explicitement plus court réduirait davantage la surface Slowloris. Le DELETE n'a pas ce problème (pas de lecture de corps).

## Forces

- **Petite taille absolue** : ~114 lignes de production sur 2 fichiers — n'importe quel développeur peut lire tout le code en 10 minutes. La zone POST reste dans une portée mentale gérable.
- **Deux points de mutation identifiés et localisés** : `bookSeats` (ajoute à `sold` et au registre) et `cancelReservation` (soustrait de `sold` et retire du registre) — mutations localisées, traçables, pas dispersées.
- **Pas de code mort** : `isFull()`, précédemment orpheline en production, est maintenant wired. Tout le code exporté a un usage.
- **DELETE synchrone** : `cancelReservation` est entièrement synchrone — pas d'imbrication de callbacks, logique linéaire, plus simple à lire que la zone POST.

## Dettes techniques

- **Zone POST trop dense** (`src/server.js:25-48`) : validation, parsing, logique métier, réponse HTTP — dans un seul bloc avec gestion asynchrone inline. Toute extension augmente la densité.
- **Absence de garde sur `transfers.find()` dans `cancelReservation`** : `src/transfers.js:40` suppose que le transfert existe. Le cas impossible en flow normal reste sans protection explicite.

## Zones critiques

- **`src/server.js:25-48`** : zone la plus risquée car elle mélange des responsabilités et gère l'asynchrone inline. C'est ici qu'un senior regarderait en premier lors d'un bug de réservation ou d'une extension de l'API.
- **`src/transfers.js:36-44`** (`cancelReservation`) : second point de mutation. La ligne 40 (`transfers.find(...)`) sans garde est le seul endroit identifié dans le chemin métier d'annulation qui pourrait théoriquement lever un crash TypeError en cas d'état incohérent.
- **`src/server.js:50-57`** (DELETE) : zone la plus récente, la moins complexe, mais aussi celle avec le moins de tests des cas limites.

## Risques

- **Extension de l'API via les zones POST et DELETE** : tout ajout de feature dans le corps de la fonction `createServer` augmente la densité d'un bloc déjà dense — `HYPOTHÈSE` (risque potentiel, pas encore de quatrième endpoint).
- **TypeError latent dans `cancelReservation`** : si un bug introduisait un `transferId` inexistant dans le registre `reservations`, la ligne 40 retournerait `undefined` et la ligne 41 crasherait — `HYPOTHÈSE` (impossible en flow normal, défensivité absente) — `src/transfers.js:40-41`.
- **Timeout applicatif absent sur la lecture du body POST** : aucun timeout explicite dans le code applicatif ; la fermeture repose sur le `requestTimeout` Node.js (300 s par défaut depuis v14.11.0) — `VÉRIFIÉ_CODE`, risque borné par le runtime mais non configurable sans action explicite (`src/server.js:29-30`).

## Recommandations priorisées

1. **Extraire le parsing du body POST en fonction dédiée** : une fonction `parseBody(req)` retournant une Promise réduit la profondeur d'imbrication et isole le parsing des autres responsabilités — `src/server.js:25-48`. Priorité : **basse** (amélioration de lisibilité, pas de bug).
2. **Ajouter une garde dans `cancelReservation`** après `transfers.find()` : `if (!transfer) return { ok: false, reason: "internal_error" }` à la ligne 40 — `src/transfers.js:40`. Priorité : **basse** (défense en profondeur, cas impossible en flow normal).
3. **Introduire un routeur minimal** avant l'ajout d'un quatrième endpoint — même une table de routes en objet suffit à éviter la prolifération des blocs `if` dans `src/server.js`. Priorité : **basse** (trois routes actuellement, risque faible aujourd'hui, coût croissant).

## Questions ouvertes

- Y a-t-il un plan pour introduire un routeur (`express`, `fastify`) avant l'ajout du quatrième endpoint ? Cette décision changerait profondément `src/server.js`.
- La garde absente dans `cancelReservation` est-elle intentionnelle (YAGNI, impossible en flow normal) ou un oubli ?

## Journal de réconciliation

| Élément | Version précédente | Version actuelle (HEAD `8a108d1`) | Action |
|---|---|---|---|
| `isFull()` dead code en production | Identifié comme code mort (`src/transfers.js:17-19`) | **Câblée** — importée `src/server.js:3`, utilisée `src/server.js:15` | Constat **retiré** |
| Zone POST | `src/server.js:23-42` | **`src/server.js:25-48`** | Numéros de lignes **mis à jour** |
| Zone DELETE | Absente | **`src/server.js:50-57`** + `cancelReservation` (`src/transfers.js:36-44`) | **Ajoutée** |
| `cancelReservation` — second point de mutation | Absent | **`src/transfers.js:36-44`** — `transfer.sold -= reservation.seats` | **Ajouté** |
| Routage | Deux blocs if | **Trois blocs if** | **Mis à jour** |
| `bookSeats` ligne refs | `src/transfers.js:21-27` | **`src/transfers.js:25-34`** | Numéros **mis à jour** |
| Taille codebase | ~80 lignes | **~114 lignes** (`src/server.js:67` + `src/transfers.js:47`) | **Mis à jour** |
| Mutation irréversible dans bookSeats | Validé, validation en place | **Confirmé** — validé double couche | **Confirmé** |
