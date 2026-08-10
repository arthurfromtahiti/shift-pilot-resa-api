# Carte des domaines — shift-pilot-resa-api

> **Niveau de confiance global : high.** Dépôt volontairement minimal (« pilote de test SHIFT/Paperclip », `README.md:3`) : ~100 lignes de source réparties sur deux fichiers. Toutes les affirmations ci-dessous sont `VÉRIFIÉ_CODE` (lues en source, `fichier:ligne`) ; **aucune n'est `OBSERVÉ`** — le serveur n'a pas été exécuté et aucune base n'existe (données en mémoire). Matière pauvre → carte courte et honnête, confiance donnée **par domaine**, jamais gonflée pour atteindre un quota.
>
> **Mode : RÉCONCILIATION 2.** Cette carte met à jour la version précédente (après SHIAAAAAAAAAAAAAAAAAAAAAAAA-61) en la confrontant au code courant (`src/` après SHIAAAAAAAAAAAAAAAAAAAAAAAA-353, commit `1f7c5f6`). Le drift réconcilié est détaillé en fin de document (§ « Journal de réconciliation »). En un mot : l'annulation de réservation, autrefois **absente** du code, est **désormais implémentée** (SHIAAAAAAAAAAAAAAAAAAAAAAAA-353).

## Nature du projet

**API HTTP de réservation de transferts inter-îles**, en Node natif (`node:http`), sans framework ni dépendance externe (`package.json`, `README.md:5-6`). Elle expose un **catalogue de transferts** (trajets Papeete↔Moorea, Papeete↔Bora Bora, Raiatea↔Tahaa) avec **prix** et **places restantes**, via une route de lecture `GET /transfers` (`src/server.js:13`), permet de **réserver des sièges** via `POST /transfers/:id/reserve` (`src/server.js:25-48`) et **d'annuler des réservations** via `DELETE /transfers/:id/reservations/:reservationId` (`src/server.js:50-56`). Les données sont **codées en dur en mémoire** (`src/transfers.js:5-9`), sans persistance sur disque : la réservation **mute l'état en mémoire** (`transfer.sold`, registre `reservations`) et est perdue au redémarrage du process.

D'après le `README.md:3-4`, cette API est **consommée par `shift-pilot-resa-web`** (même projet Paperclip, dépôt séparé — hors périmètre de ce workspace), qui à ce jour n'appelle que la lecture `GET /transfers`.

## Domaines

### Catalogue des transferts inter-îles (`catalogue-transferts`)
- **Catégorie** : métier
- **Priorité** : cœur
- **Confiance** : high
- **Description** : Le référentiel des trajets de transfert proposés (origine, destination, prix), et leur exposition en liste au client. C'est la raison d'être du service : sans ce catalogue, l'API n'a rien à servir ni à réserver.
- **Entités** : le tableau `transfers` (`src/transfers.js:3-7`), objets à champs `id`, `from`, `to`, `seats`, `sold`, `price`.
- **Routes / points d'entrée** : `GET /transfers` (`src/server.js:13`) → renvoie `id`, `from`, `to`, `price`, `seatsLeft` par transfert (`src/server.js:16-22`) ; fonction `listTransfers()` (`src/transfers.js:13-15`).
- **Indices de rattachement** : identifiant `transfers`/`transfer`, champs `from`/`to`/`price`, chemin `src/transfers.js`, route `/transfers`.
- **Types de workflows attendus** : consultation de l'offre par un client web ; (à terme) filtrage/recherche de trajets.
- **Preuves** : `src/transfers.js:3-11`, `src/server.js:13-21`.
- **Dépend de la base** : non — données codées en dur en mémoire, aucun signal schéma/entité-étendue/code-exécutable de contenu piloté par la base.

### Disponibilité, réservation et annulation de places (`disponibilite-reservation`)
- **Catégorie** : métier
- **Priorité** : cœur
- **Confiance** : high
- **Description** : Le cœur « resa » du produit : le suivi du remplissage de chaque transfert (places totales `seats` vs vendues `sold`), le calcul des places restantes / de la complétude, **la prise de réservation** qui décrémente le stock, **et l'annulation de réservation** qui le restaure. Ce domaine porte trois versants : **lecture** (calcul de disponibilité affiché au client), **écriture-réservation** (réservation de N sièges avec garde de capacité et génération d'UUID), et **écriture-annulation** (libération de sièges et suppression de la réservation). C'est le seul chemin de mutation d'état du service.
- **Entités** : 
  - champs `seats` et `sold` du tableau `transfers` (`src/transfers.js:5-9`) ; `sold` est muté par `bookSeats()` et `cancelReservation()`
  - registre `reservations` Map (`src/transfers.js:11`) stockant `reservationId → { transferId, seats }`
- **Routes / points d'entrée** :
  - Lecture : `seatsLeft(transfer)` = `seats - sold` (`src/transfers.js:17-19`), exposé dans `GET /transfers` (`src/server.js:21`) ; `isFull(transfer)` = `seatsLeft === 0` (`src/transfers.js:21-23`), importé et utilisé pour le filtrage optionnel `?available=true` (`src/server.js:15`) [UPDATED SHIAAAAAAAAAAAAAAAAAAAAAAAA-408].
  - Écriture-réservation : `bookSeats(transferId, seats=1)` (`src/transfers.js:25-34`) → `{ ok, reason?, reservationId?, seatsLeft? }` [UPDATED] ; exposé par `POST /transfers/:id/reserve` (`src/server.js:25-48`) qui mappe `reason:"invalid_seats"` → 400, `reason:"not_found"` → 404, `reason:"full"` → 409, succès → 200 `{ reservationId, transferId, seatsLeft }`.
  - Écriture-annulation : `cancelReservation(reservationId, transferId)` (`src/transfers.js:36-44`) [UPDATED SHIA-396] → `{ ok, reason?, seatsLeft? }` ; exposé par `DELETE /transfers/:id/reservations/:reservationId` (`src/server.js:50-57`) qui mappe `reason:"not_found"` → 404 (UUID inconnu OU transferId incohérent [SHIA-396]), succès → 200 `{ seatsLeft }`.
- **Indices de rattachement** : identifiants `seats`, `sold`, `seatsLeft`, `isFull`, `bookSeats`, `cancelReservation`, `reservationId`, `reservations`, motif de route `/transfers/:id/reserve`, `/transfers/:id/reservations/:reservationId`, mots-clés `reserve`/`book`/`cancel`.
- **Types de workflows attendus** : affichage « complet / N places restantes » côté web (avec filtrage optionnel `?available=true` [SHIAAAAAAAAAAAAAAAAAAAAAAAA-408]) ; prise de réservation d'un ou plusieurs sièges avec rejet si complet ; **annulation de réservation avec récupération de l'UUID** [NEW].
- **Preuves** : `src/transfers.js:11-44`, `src/server.js:21`, `src/server.js:25-57`, `test/transfers.test.js`, `test/server.test.js`.
- **Dépend de la base** : non — mutations purement en mémoire, non persistées.

### Exposition HTTP de l'API (`exposition-http-api`)
- **Catégorie** : technique
- **Priorité** : support
- **Confiance** : high
- **Description** : La couche serveur transverse qui reçoit les requêtes, route sur la méthode + le chemin (GET, POST, DELETE avec paramètres dynamiques `:id` et `:reservationId`), lit et parse le corps JSON des requêtes POST, sérialise les réponses en JSON et gère les cas non trouvés. Transverse au métier : ne fusionne pas avec le catalogue ni la réservation.
- **Entités** : aucune entité métier — serveur `http.createServer` (`src/server.js:10`).
- **Routes / points d'entrée** : 
  - Helper `sendJson(res, status, body)` (`src/server.js:5-8`)
  - Parsing d'URL `new URL(...)` (`src/server.js:11`)
  - Routage par `url.pathname` + `req.method` :
    - GET `/transfers` (`src/server.js:13-23`)
    - POST `/transfers/:id/reserve` avec matching regex (`src/server.js:25-48`) [UPDATED]
    - DELETE `/transfers/:id/reservations/:reservationId` avec matching regex (`src/server.js:50-56`) [NEW]
  - Agrégation du corps de requête (`src/server.js:28-29`)
  - `JSON.parse` du corps avec fallback silencieux (`src/server.js:30-36`)
  - Réponse `404` par défaut (`src/server.js:58`)
  - Port configurable `process.env.PORT || 3100` et `server.listen` (`src/server.js:61-64`)
- **Indices de rattachement** : `http`, `createServer`, `sendJson`, `url.pathname`, `req.method`, `regex` `/^\/transfers\/(\d+)\/reserve$/`, `/^\/transfers\/(\d+)\/reservations\/([^/]+)$/`, `req.on("data")`/`"end"`, `JSON.parse`, `PORT`, chemin `src/server.js`.
- **Types de workflows attendus** : ajout de nouvelles routes, gestion des erreurs/statuts HTTP, parsing de corps de requête, validation de paramètres d'URL, configuration du port/déploiement.
- **Preuves** : `src/server.js:1-64`.
- **Dépend de la base** : non.

### Qualité et tests automatisés (`qualite-tests`)
- **Catégorie** : support
- **Priorité** : support
- **Confiance** : medium-high
- **Description** : La suite de tests couvrant à la fois la logique métier pure (calcul des places, complétude, cardinalité du catalogue) et le **comportement HTTP de bout en bout des opérations CRUD** (réservation 200/409/404, **annulation 200/404**), via le lanceur natif `node:test`. Domaine mince mais réel ; confiance rehaussée depuis l'ajout d'une couverture d'intégration HTTP complète (réservation + annulation).
- **Entités** : aucune.
- **Routes / points d'entrée** : 
  - Script `npm test` → `node --test test/*.test.js` (`package.json`)
  - Tests de logique pure `seatsLeft`, `isFull`, `listTransfers`, `cancelReservation` (`test/transfers.test.js`)
  - Tests d'intégration HTTP démarrant un vrai serveur et exerçant :
    - `POST /transfers/:id/reserve` sur 3 issues (200/409/404) [SHIAAAAAAAAAAAAAAAAAAAAAAAA-61]
    - `DELETE /transfers/:id/reservations/:reservationId` sur 2 issues (200/404) [SHIAAAAAAAAAAAAAAAAAAAAAAAA-353 NEW]
- **Indices de rattachement** : chemin `test/`, `node:test`, `node:assert`, `http.request`, suffixe `.test.js`.
- **Types de workflows attendus** : ajout de tests à la logique métier et aux routes HTTP ; tests des workflows d'annulation de réservation.
- **Preuves** : `test/transfers.test.js`, `test/server.test.js`, `package.json`.
- **Dépend de la base** : non.

## Incertitudes

- **Frontière `catalogue-transferts` / `disponibilite-reservation`.** Les deux domaines partagent la même entité (le tableau `transfers`). Je les garde séparés parce qu'un chef de projet nommerait distinctement « l'offre » (catalogue, prix) et « la réservation / le remplissage » (stock, prise de siège, annulation) — et l'ajout de SHIAAAAAAAAAAAAAAAAAAAAAAAA-353 renforce ce choix, l'annulation étant maintenant aussi une capacité à part entière. Un relecteur pourrait légitimement préférer une fusion « Offre & réservation & annulation de transferts » ; choix signalé plutôt que tranché en silence.
- **`isFull()` est désormais utilisé en production** (`src/transfers.js:21-23`) : importé par `src/server.js:3` depuis SHIAAAAAAAAAAAAAAAAAAAAAAAA-408, utilisé pour implémenter le filtrage optionnel `?available=true` sur `GET /transfers` (`src/server.js:15`). Facette prévue en incertitude, désormais câblée.
- **Annulation non persistée et non authentifiée.** `cancelReservation()` mute `transfer.sold` en mémoire et supprime l'UUID du registre Map : un redémarrage du process réinitialise tout. Aucune vérification d'identité/token sur `DELETE /transfers/:id/reservations/:reservationId` (pas de session, pas de JWT). **Depuis SHIAAAAAAAAAAAAAAAAAAAAAAAA-456, la validation de cohérence transferId/reservationId a été supprimée** : le paramètre `:id` dans l'URL n'est plus utilisé pour valider que la réservation appartient au bon transfert (simplification intentionnelle : le Map `reservations` retrouve déjà la réservation par UUID seul). Aucune protection contre les annulations concurrentes (pas de verrou ; deux requêtes simultanées peuvent tenter d'annuler le même UUID). Acceptable en pilote, à confirmer par le board pour la suite.
- **Validation de seats dupliquée.** `src/server.js:39-40` valide que `seats > 0` et rejette 400, mais `bookSeats()` refait la même validation (ligne 26). En production, une validation unique suffirait ; cette duplication est un signal de prototypage encore en cours.
- **UUID du client pas tracé.** `bookSeats()` génère un UUID via `randomUUID()` et le retourne au client, mais aucun lien n'existe avec le client/utilisateur qui l'a créé. Une même personne ne peut pas récupérer « ses réservations » — l'API est stateless et sans authentification.
- **Aucune donnée réelle observée.** Tout est `VÉRIFIÉ_CODE`, rien n'est `OBSERVÉ` : serveur non exécuté, données en mémoire (`src/transfers.js:5-9`), pas de base. Aucun accès base fourni à ce stade — cohérent avec l'absence de persistance.
- **Écosystème inter-dépôts.** `README.md:3-4` désigne `shift-pilot-resa-web` comme consommateur (même projet, dépôt séparé). Le web ne consomme aujourd'hui que `GET /transfers` ; il n'appelle pas encore les routes de réservation/annulation. Hors périmètre de ce workspace ; relève de la synthèse transverse `ECOSYSTEME.md` au niveau projet.

## Journal de réconciliation

### Phase 1 : SHIAAAAAAAAAAAAAAAAAAAAAAAA-61 (réservation)
Confrontation de la carte canonique (branche `onboarding/artifacts`, SHA `d869b94`) au code post-61 (commit `06b7594`) :

| Élément | Avant | Après | Action |
|---|---|---|---|
| Chemin d'écriture de réservation | **Absent** | `bookSeats()` + `POST /transfers/:id/reserve` implémentés | Incertitude **résolue** |
| Domaine `disponibilite-places` | métier / cœur / **medium** | Renommé `disponibilite-reservation`, gagne versant écriture | Confiance **medium → high** |
| Retour de `bookSeats()` | `{ ok, reason?, seatsLeft? }` | `{ ok, reason?, reservationId?, seatsLeft? }` | Réponse **enrichie** |
| Domaine `exposition-http-api` | GET + 404 | GET + POST + 404 | Preuves **étendues** |
| Domaine `qualite-tests` | **low** | `test/server.test.js` POST couvre 200/404/409 | Confiance **low → medium** |

### Phase 2 : SHIAAAAAAAAAAAAAAAAAAAAAAAA-353 (annulation) ← **CETTE RÉCONCILIATION**
Confrontation de la carte post-61 (commit `06b7594`) au code courant (commit `1f7c5f6`) :

| Élément | Avant (post-61) | Après (post-353) | Action |
|---|---|---|---|
| Chemin d'annulation de réservation | **Absent** | `cancelReservation()` + `DELETE /transfers/:id/reservations/:reservationId` | Capability **ajoutée** |
| Domaine `disponibilite-reservation` | réservation uniquement | réservation **+ annulation** | Description **enrichie** |
| Registre `reservations` | Absent | `Map { reservationId → { transferId, seats } }` | Data structure **ajoutée** |
| Validation `seats` | Côté server seulement | Côté server **+ transfers.js** | Validation **dupliquée** (prototypage) |
| Imports de transfers.js | `listTransfers`, `seatsLeft`, `bookSeats` | + `cancelReservation` | Exports **étendus** |
| Routes HTTP | GET `/transfers`, POST `/transfers/:id/reserve` | + DELETE `/transfers/:id/reservations/:reservationId` | Routage **étendu** |
| Domaine `qualite-tests` | medium (POST couverts) | **medium-high** (POST + DELETE couverts) | Confiance **medium → medium-high** |
| Nombre de domaines | 4 | 4 | Inchangé |
| Niveau de confiance global | medium-high | **high** | Implémentation plus complète & testée |

Les autres constats (nature du projet, catalogue, absence de base, écosystème) restent valides et sont conservés.
