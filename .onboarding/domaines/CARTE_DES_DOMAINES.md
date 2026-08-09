# Carte des domaines — shift-pilot-resa-api

> **Niveau de confiance global : high.** Dépôt volontairement minimal (« pilote de test SHIFT/Paperclip », `README.md:3`) : ~110 lignes de source réparties sur deux fichiers. Toutes les affirmations ci-dessous sont `VÉRIFIÉ_CODE` (lues en source, `fichier:ligne`). La suite de tests a de plus été **exécutée** (`npm test` → 21 tests, 21 pass, 0 fail) : les comportements HTTP décrits sont donc aussi `OBSERVÉ`. Aucune base n'existe (données en mémoire, `src/transfers.js:5-9`). Matière pauvre → carte courte et honnête, confiance donnée **par domaine**, jamais gonflée pour atteindre un quota.
>
> **Mode : RÉCONCILIATION 3.** Cette carte met à jour la version précédente (post-SHIAAAAAAAAAAAAAAAAAAAAAAAA-396) en la confrontant au code courant (HEAD `8a108d1`, après SHIAAAAAAAAAAAAAAAAAAAAAAAA-408). Le drift réconcilié est détaillé en fin de document (§ « Journal de réconciliation »). En un mot : `GET /transfers` accepte désormais un filtre `?available=true` qui **câble `isFull()` au runtime** — cette fonction, auparavant morte hors tests, est maintenant importée par le serveur (`src/server.js:3`) et utilisée (`src/server.js:15`). L'ancienne incertitude « `isFull` mort côté runtime » est donc **retirée**.

## Nature du projet

**API HTTP de réservation de transferts inter-îles**, en Node natif (`node:http`), sans framework ni dépendance externe (`package.json`, `README.md:5-6`). Elle expose un **catalogue de transferts** (trajets Papeete↔Moorea, Papeete↔Bora Bora, Raiatea↔Tahaa) avec **prix** et **places restantes**, via une route de lecture `GET /transfers` (`src/server.js:13`) — désormais filtrable sur les seuls transferts non complets via `?available=true` (`src/server.js:14-15`) —, permet de **réserver des sièges** via `POST /transfers/:id/reserve` (`src/server.js:25-48`) et **d'annuler des réservations** via `DELETE /transfers/:id/reservations/:reservationId` (`src/server.js:50-57`). Les données sont **codées en dur en mémoire** (`src/transfers.js:5-9`), sans persistance sur disque : la réservation **mute l'état en mémoire** (`transfer.sold`, registre `reservations`) et est perdue au redémarrage du process.

D'après le `README.md:3-4`, cette API est **consommée par `shift-pilot-resa-web`** (même projet Paperclip, dépôt séparé — hors périmètre de ce workspace).

## Domaines

### Catalogue des transferts inter-îles (`catalogue-transferts`)
- **Catégorie** : métier
- **Priorité** : cœur
- **Confiance** : high
- **Description** : Le référentiel des trajets de transfert proposés (origine, destination, prix), et leur exposition en liste au client. C'est la raison d'être du service : sans ce catalogue, l'API n'a rien à servir ni à réserver. La liste peut être servie intégralement ou **restreinte aux transferts encore disponibles** via le paramètre `?available=true`.
- **Entités** : le tableau `transfers` (`src/transfers.js:5-9`), objets à champs `id`, `from`, `to`, `seats`, `sold`, `price`.
- **Routes / points d'entrée** : `GET /transfers` (`src/server.js:13`) → renvoie `id`, `from`, `to`, `price`, `seatsLeft` par transfert (`src/server.js:16-22`) ; **filtre `?available=true`** qui exclut les transferts complets via `isFull(t)` (`src/server.js:14-15`) [NEW SHIA-408] ; fonction `listTransfers()` (`src/transfers.js:13-15`).
- **Indices de rattachement** : identifiant `transfers`/`transfer`, champs `from`/`to`/`price`, paramètre `available`, chemin `src/transfers.js`, route `/transfers`.
- **Types de workflows attendus** : consultation de l'offre par un client web ; filtrage sur disponibilité ; (à terme) recherche/tri de trajets.
- **Preuves** : `src/transfers.js:5-15`, `src/server.js:13-23`, `test/server.test.js:128-140`.
- **Dépend de la base** : non — données codées en dur en mémoire, aucun signal schéma/entité-étendue/code-exécutable de contenu piloté par la base.

### Disponibilité, réservation et annulation de places (`disponibilite-reservation`)
- **Catégorie** : métier
- **Priorité** : cœur
- **Confiance** : high
- **Description** : Le cœur « resa » du produit : le suivi du remplissage de chaque transfert (places totales `seats` vs vendues `sold`), le calcul des places restantes / de la complétude, **la prise de réservation** qui décrémente le stock, **et l'annulation de réservation** qui le restaure. Ce domaine porte trois versants : **lecture** (calcul de disponibilité affiché au client + filtre de disponibilité du catalogue), **écriture-réservation** (réservation de N sièges avec garde de capacité et génération d'UUID), et **écriture-annulation** (libération de sièges et suppression de la réservation). C'est le seul chemin de mutation d'état du service.
- **Entités** :
  - champs `seats` et `sold` du tableau `transfers` (`src/transfers.js:5-9`) ; `sold` est muté par `bookSeats()` et `cancelReservation()`
  - registre `reservations` Map (`src/transfers.js:11`) stockant `reservationId → { transferId, seats }`
- **Routes / points d'entrée** :
  - Lecture : `seatsLeft(transfer)` = `seats - sold` (`src/transfers.js:17-19`), exposé dans `GET /transfers` (`src/server.js:21`) ; `isFull(transfer)` = `seatsLeft === 0` (`src/transfers.js:21-23`), **désormais câblé au runtime** par le filtre `?available=true` (`src/server.js:3` import, `src/server.js:15` usage) [UPDATED SHIA-408].
  - Écriture-réservation : `bookSeats(transferId, seats=1)` (`src/transfers.js:25-34`) → `{ ok, reason?, reservationId?, seatsLeft? }` ; exposé par `POST /transfers/:id/reserve` (`src/server.js:25-48`) qui mappe `seats` invalide → 400 (`src/server.js:39-41`), `reason:"not_found"` → 404, `reason:"full"` → 409, succès → 200 `{ reservationId, transferId, seatsLeft }`.
  - Écriture-annulation : `cancelReservation(reservationId, transferId)` (`src/transfers.js:36-44`) → `{ ok, reason?, seatsLeft? }` ; exposé par `DELETE /transfers/:id/reservations/:reservationId` (`src/server.js:50-57`) qui mappe `reason:"not_found"` → 404 (UUID inconnu **ou** transferId URL incohérent avec `reservation.transferId`, `src/transfers.js:38-39`), succès → 200 `{ seatsLeft }`.
- **Indices de rattachement** : identifiants `seats`, `sold`, `seatsLeft`, `isFull`, `bookSeats`, `cancelReservation`, `reservationId`, `reservations`, motif de route `/transfers/:id/reserve`, `/transfers/:id/reservations/:reservationId`, mots-clés `reserve`/`book`/`cancel`/`available`.
- **Types de workflows attendus** : affichage « complet / N places restantes » côté web ; filtre « masquer les transferts complets » ; prise de réservation d'un ou plusieurs sièges avec rejet si complet ; annulation de réservation avec récupération de l'UUID.
- **Preuves** : `src/transfers.js:11-44`, `src/server.js:14-15`, `src/server.js:21`, `src/server.js:25-57`, `test/transfers.test.js`, `test/server.test.js`.
- **Dépend de la base** : non — mutations purement en mémoire, non persistées.

### Exposition HTTP de l'API (`exposition-http-api`)
- **Catégorie** : technique
- **Priorité** : support
- **Confiance** : high
- **Description** : La couche serveur transverse qui reçoit les requêtes, route sur la méthode + le chemin (GET, POST, DELETE avec paramètres dynamiques `:id` et `:reservationId`), lit les paramètres de requête (`searchParams`), lit et parse le corps JSON des requêtes POST, sérialise les réponses en JSON et gère les cas non trouvés. Transverse au métier : ne fusionne pas avec le catalogue ni la réservation.
- **Entités** : aucune entité métier — serveur `http.createServer` (`src/server.js:10`).
- **Routes / points d'entrée** :
  - Helper `sendJson(res, status, body)` (`src/server.js:5-8`)
  - Parsing d'URL `new URL(...)` (`src/server.js:11`) et lecture de query `url.searchParams.get("available")` (`src/server.js:14`) [NEW SHIA-408]
  - Routage par `url.pathname` + `req.method` :
    - GET `/transfers` (`src/server.js:13-23`)
    - POST `/transfers/:id/reserve` avec matching regex (`src/server.js:25-48`)
    - DELETE `/transfers/:id/reservations/:reservationId` avec matching regex (`src/server.js:50-57`)
  - Agrégation du corps de requête (`src/server.js:28-29`)
  - `JSON.parse` du corps avec fallback silencieux (`src/server.js:32-37`)
  - Réponse `404` par défaut (`src/server.js:59`)
  - Port configurable `process.env.PORT || 3100`, `server.listen` sous garde `require.main === module`, export du serveur (`src/server.js:62-66`)
- **Indices de rattachement** : `http`, `createServer`, `sendJson`, `url.pathname`, `url.searchParams`, `req.method`, regex `/^\/transfers\/(\d+)\/reserve$/`, `/^\/transfers\/(\d+)\/reservations\/([^/]+)$/`, `req.on("data")`/`"end"`, `JSON.parse`, `PORT`, chemin `src/server.js`.
- **Types de workflows attendus** : ajout de nouvelles routes, gestion des erreurs/statuts HTTP, parsing de corps de requête, lecture de query params, validation de paramètres d'URL, configuration du port/déploiement.
- **Preuves** : `src/server.js:1-66`.
- **Dépend de la base** : non.

### Qualité et tests automatisés (`qualite-tests`)
- **Catégorie** : support
- **Priorité** : support
- **Confiance** : high
- **Description** : La suite de tests couvrant à la fois la logique métier pure (calcul des places, complétude, cardinalité du catalogue, réservation, annulation dont double-annulation) et le **comportement HTTP de bout en bout** (réservation 200/409/404/400, annulation 200/404, lecture `GET /transfers` et **filtre `?available=true`**), via le lanceur natif `node:test`. **Suite exécutée : 21 tests, 21 pass, 0 fail** (`npm test`). Confiance rehaussée à `high` : couverture d'intégration HTTP complète incluant la lecture, le filtre et les edge-cases de validation.
- **Entités** : aucune.
- **Routes / points d'entrée** :
  - Script `npm test` → `node --test test/*.test.js` (`package.json:6`)
  - Tests de logique pure `seatsLeft`, `isFull`, `listTransfers`, `bookSeats` (validation + reservationId), `cancelReservation` (nominal, ID inconnu, transferId incohérent, double-annulation) (`test/transfers.test.js`)
  - Tests d'intégration HTTP démarrant un vrai serveur (`server.listen(0)`) et exerçant `POST /reserve` (200/409/404/400), `DELETE /reservations/:id` (200/404 dont transferId incorrect), `GET /transfers` (200) et `GET /transfers?available=true` (exclusion du complet) (`test/server.test.js`)
- **Indices de rattachement** : chemin `test/`, `node:test`, `node:assert`, `http.request`, suffixe `.test.js`.
- **Types de workflows attendus** : ajout de tests à la logique métier et aux routes HTTP ; tests de nouveaux filtres/paramètres de requête.
- **Preuves** : `test/transfers.test.js`, `test/server.test.js`, `package.json:6`.
- **Dépend de la base** : non.

## Incertitudes

- **Frontière `catalogue-transferts` / `disponibilite-reservation`.** Les deux domaines partagent la même entité (le tableau `transfers`) et le filtre `?available=true` (SHIA-408) chevauche les deux (lecture d'offre côté catalogue, notion de complétude côté disponibilité). Je les garde séparés parce qu'un chef de projet nommerait distinctement « l'offre » (catalogue, prix) et « la réservation / le remplissage » (stock, prise de siège, annulation). Un relecteur pourrait légitimement préférer une fusion « Offre & réservation de transferts » ; choix signalé plutôt que tranché en silence.
- **Annulation non persistée et non authentifiée.** `cancelReservation()` mute `transfer.sold` en mémoire et supprime l'UUID du registre Map : un redémarrage du process réinitialise tout. Aucune vérification d'identité/token sur `DELETE /transfers/:id/reservations/:reservationId` (pas de session, pas de JWT). La cohérence URL/ressource est vérifiée depuis SHIA-396 (rejet 404 si `reservation.transferId !== transferId`), mais l'appelant n'est pas authentifié. Aucune protection contre les annulations/réservations concurrentes (pas de verrou). Acceptable en pilote, à confirmer par le board pour la suite.
- **Validation de `seats` dupliquée.** `src/server.js:39-41` valide que `seats` est un entier ≥ 1 et rejette 400, mais `bookSeats()` refait la même validation (`src/transfers.js:26`). En production, une validation unique suffirait ; cette duplication est un signal de prototypage encore en cours.
- **UUID du client pas tracé.** `bookSeats()` génère un UUID via `randomUUID()` et le retourne au client, mais aucun lien n'existe avec l'utilisateur qui l'a créé. Une même personne ne peut pas récupérer « ses réservations » — l'API est stateless et sans authentification.
- **Aucune donnée réelle persistée.** Les comportements sont `VÉRIFIÉ_CODE` et `OBSERVÉ` (tests exécutés), mais toutes les données sont en mémoire (`src/transfers.js:5-9`) : pas de base, pas de persistance. Aucun accès base fourni à ce stade — cohérent avec l'absence de persistance.
- **Écosystème inter-dépôts.** `README.md:3-4` désigne `shift-pilot-resa-web` comme consommateur (même projet, dépôt séparé). L'étendue réelle des routes consommées par le web relève de la synthèse transverse `ECOSYSTEME.md` au niveau projet. Hors périmètre de ce workspace.

## Journal de réconciliation

### Phase 1 : SHIAAAAAAAAAAAAAAAAAAAAAAAA-61 (réservation)
Confrontation de la carte canonique (branche `onboarding/artifacts`, SHA `d869b94`) au code post-61 (commit `06b7594`) : ajout du chemin d'écriture `bookSeats()` + `POST /transfers/:id/reserve` ; domaine `disponibilite-places` renommé `disponibilite-reservation` (medium → high) ; `qualite-tests` low → medium.

### Phase 2 : SHIAAAAAAAAAAAAAAAAAAAAAAAA-353 / -396 (annulation)
Confrontation post-61 (commit `06b7594`) → post-396 : ajout de `cancelReservation()` + `DELETE /transfers/:id/reservations/:reservationId`, registre `reservations` Map, cohérence transferId/reservationId (SHIA-396), validation `seats` dupliquée ; `qualite-tests` medium → medium-high ; 4 domaines inchangés.

### Phase 3 : SHIAAAAAAAAAAAAAAAAAAAAAAAA-408 (filtre de disponibilité) ← **CETTE RÉCONCILIATION**
Confrontation de la carte post-396 au code courant (HEAD `8a108d1`) :

| Élément | Avant (post-396) | Après (post-408) | Action |
|---|---|---|---|
| `GET /transfers` | liste complète | + filtre `?available=true` excluant les complets (`src/server.js:14-15`) | Route **enrichie** |
| `isFull()` | exporté mais **mort côté runtime** (importé nulle part hors tests) | **importé** (`src/server.js:3`) et **utilisé** (`src/server.js:15`) | Fonction **câblée** — incertitude **retirée** |
| Domaine `catalogue-transferts` | lecture simple | lecture + filtre disponibilité | Description/preuves **étendues** |
| Domaine `disponibilite-reservation` | `isFull` non exposé | `isFull` exposé via le filtre catalogue | Versant lecture **étendu** |
| Domaine `exposition-http-api` | pas de lecture de query | lecture `url.searchParams.get("available")` | Point d'entrée **ajouté** ; confiance medium-high → **high** |
| Couverture de tests | POST + DELETE | + `GET /transfers`, + `?available=true`, + edge-cases validation, + double-annulation | `qualite-tests` medium-high → **high** |
| Exécution des tests | non exécutés (VÉRIFIÉ_CODE seul) | **`npm test` → 21 pass / 0 fail** | Comportements HTTP désormais **OBSERVÉ** |
| Nombre de domaines | 4 | 4 | Inchangé |
| Niveau de confiance global | high | high | Maintenu (implémentation + tests plus complets) |

Les autres constats (nature du projet, absence de base, non-authentification, écosystème) restent valides et sont conservés.
