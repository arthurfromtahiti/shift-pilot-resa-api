# Carte des domaines — shift-pilot-resa-api

> **Niveau de confiance global : medium-high.** Dépôt volontairement minimal (« pilote de test SHIFT/Paperclip », `README.md:3`) : ~80 lignes de source réparties sur deux fichiers. Toutes les affirmations ci-dessous sont `VÉRIFIÉ_CODE` (lues en source, `fichier:ligne`) ; **aucune n'est `OBSERVÉ`** — le serveur n'a pas été exécuté et aucune base n'existe (données en mémoire). Matière pauvre → carte courte et honnête, confiance donnée **par domaine**, jamais gonflée pour atteindre un quota.
>
> **Mode : RÉCONCILIATION.** Cette carte met à jour la version canonique validée (branche `onboarding/artifacts`, relue « Bon » 8/8) en la confrontant au code courant (`src/` au commit `6ef5850`, tête `532a08c`). Le drift réconcilié est détaillé en fin de document (§ « Journal de réconciliation »). En un mot : la réservation, autrefois **absente** du code, est **désormais implémentée** (SHIAAAAAAAAAAAAAAAAAAAAAAAA-61).

## Nature du projet

**API HTTP de réservation de transferts inter-îles**, en Node natif (`node:http`), sans framework ni dépendance externe (`package.json`, `README.md:5-6`). Elle expose un **catalogue de transferts** (trajets Papeete↔Moorea, Papeete↔Bora Bora, Raiatea↔Tahaa) avec **prix** et **places restantes**, via une route de lecture `GET /transfers` (`src/server.js:13`), et permet désormais de **réserver des sièges** via `POST /transfers/:id/reserve` (`src/server.js:23-42`). Les données sont **codées en dur en mémoire** (`src/transfers.js:3-7`), sans persistance sur disque : la réservation **mute l'état en mémoire** (`transfer.sold`) et est perdue au redémarrage du process.

D'après le `README.md:3-4`, cette API est **consommée par `shift-pilot-resa-web`** (même projet Paperclip, dépôt séparé — hors périmètre de ce workspace), qui à ce jour n'appelle que la lecture `GET /transfers`.

## Domaines

### Catalogue des transferts inter-îles (`catalogue-transferts`)
- **Catégorie** : métier
- **Priorité** : cœur
- **Confiance** : high
- **Description** : Le référentiel des trajets de transfert proposés (origine, destination, prix), et leur exposition en liste au client. C'est la raison d'être du service : sans ce catalogue, l'API n'a rien à servir ni à réserver.
- **Entités** : le tableau `transfers` (`src/transfers.js:3-7`), objets à champs `id`, `from`, `to`, `seats`, `sold`, `price`.
- **Routes / points d'entrée** : `GET /transfers` (`src/server.js:13`) → renvoie `id`, `from`, `to`, `price`, `seatsLeft` par transfert (`src/server.js:14-20`) ; fonction `listTransfers()` (`src/transfers.js:9-11`).
- **Indices de rattachement** : identifiant `transfers`/`transfer`, champs `from`/`to`/`price`, chemin `src/transfers.js`, route `/transfers`.
- **Types de workflows attendus** : consultation de l'offre par un client web ; (à terme) filtrage/recherche de trajets.
- **Preuves** : `src/transfers.js:3-11`, `src/server.js:13-21`.
- **Dépend de la base** : non — données codées en dur en mémoire, aucun signal schéma/entité-étendue/code-exécutable de contenu piloté par la base.

### Disponibilité et réservation des places (`disponibilite-reservation`)
- **Catégorie** : métier
- **Priorité** : cœur
- **Confiance** : high
- **Description** : Le cœur « resa » du produit : le suivi du remplissage de chaque transfert (places totales `seats` vs vendues `sold`), le calcul des places restantes / de la complétude, **et la prise de réservation** qui décrémente le stock disponible. Ce domaine porte à la fois le versant **lecture** (calcul de disponibilité affiché au client) et le versant **écriture** (réservation de N sièges avec garde de capacité). C'est le seul chemin de mutation d'état du service.
- **Entités** : champs `seats` et `sold` du tableau `transfers` (`src/transfers.js:3-7`) ; `sold` est **le seul champ muté à l'exécution**, exclusivement par `bookSeats()` (`src/transfers.js:25`).
- **Routes / points d'entrée** :
  - Lecture : `seatsLeft(transfer)` = `seats - sold` (`src/transfers.js:13-15`), exposé dans la réponse de `GET /transfers` (`src/server.js:19`) ; `isFull(transfer)` = `seatsLeft === 0` (`src/transfers.js:17-19`), **exporté mais non câblé à une route** — utilisé seulement par les tests (`test/transfers.test.js:9-12`).
  - Écriture : `bookSeats(transferId, seats=1)` (`src/transfers.js:21-27`) → `{ ok, reason?, seatsLeft? }` ; exposé par `POST /transfers/:id/reserve` (`src/server.js:23-42`) qui mappe `reason:"not_found"` → 404, `reason:"full"` → 409, succès → 200 `{ transferId, seatsLeft }`.
- **Indices de rattachement** : identifiants `seats`, `sold`, `seatsLeft`, `isFull`, `bookSeats`, motif de route `/transfers/:id/reserve`, mots-clés `reserve`/`book`.
- **Types de workflows attendus** : affichage « complet / N places restantes » côté web ; prise de réservation d'un ou plusieurs sièges avec rejet si complet ; (absent) annulation de réservation (pas d'endpoint DELETE/cancel).
- **Preuves** : `src/transfers.js:13-27`, `src/server.js:19`, `src/server.js:23-42`, `test/transfers.test.js:5-12`, `test/server.test.js:34-52`.
- **Dépend de la base** : non — mutation purement en mémoire, non persistée ; aucun signal de contenu piloté par la base.

### Exposition HTTP de l'API (`exposition-http-api`)
- **Catégorie** : technique
- **Priorité** : support
- **Confiance** : high
- **Description** : La couche serveur transverse qui reçoit les requêtes, route sur la méthode + le chemin (y compris le paramètre dynamique `:id` de la route de réservation), lit et parse le corps JSON des requêtes POST, sérialise les réponses en JSON et gère les cas non trouvés. Transverse au métier : ne fusionne pas avec le catalogue ni la réservation.
- **Entités** : aucune entité métier — serveur `http.createServer` (`src/server.js:10`).
- **Routes / points d'entrée** : helper `sendJson(res, status, body)` (`src/server.js:5-8`) ; parsing d'URL `new URL(...)` (`src/server.js:11`) ; routage par `url.pathname` + `req.method`, dont matching regex de `/transfers/(\d+)/reserve` (`src/server.js:13`, `23-24`) ; agrégation puis `JSON.parse` du corps de requête avec fallback silencieux sur corps vide/malformé (`src/server.js:26-35`) ; réponse `404 { error: "Not found" }` par défaut (`src/server.js:44`) ; port configurable `process.env.PORT || 3100` et `server.listen` (`src/server.js:47-49`) ; `module.exports = server` (`src/server.js:51`).
- **Indices de rattachement** : `http`, `createServer`, `sendJson`, `url.pathname`, `req.method`, `req.on("data")`/`"end"`, `JSON.parse`, `PORT`, chemin `src/server.js`.
- **Types de workflows attendus** : ajout de nouvelles routes, gestion des erreurs/statuts HTTP, parsing de corps de requête, configuration du port/déploiement.
- **Preuves** : `src/server.js:1-51`.
- **Dépend de la base** : non.

### Qualité et tests automatisés (`qualite-tests`)
- **Catégorie** : support
- **Priorité** : support
- **Confiance** : medium
- **Description** : La suite de tests couvrant à la fois la logique métier pure (calcul des places, complétude, cardinalité du catalogue) et, désormais, le **comportement HTTP de bout en bout de la réservation** (200/404/409), via le lanceur natif `node:test`. Domaine mince mais réel ; confiance rehaussée à `medium` depuis l'ajout d'une couverture d'intégration HTTP.
- **Entités** : aucune.
- **Routes / points d'entrée** : script `npm test` → `node --test test/*.test.js` (`package.json`) ; tests de logique pure `seatsLeft`, `isFull`, `listTransfers` (`test/transfers.test.js:5-16`) ; tests d'intégration HTTP démarrant un vrai serveur et exerçant `POST /transfers/:id/reserve` sur les 3 issues 200/409/404 (`test/server.test.js:34-52`).
- **Indices de rattachement** : chemin `test/`, `node:test`, `node:assert`, `http.request`, suffixe `.test.js`.
- **Types de workflows attendus** : ajout de tests à la logique métier et aux routes HTTP ; (absent) test du décodage de corps JSON malformé et de la lecture `GET /transfers`.
- **Preuves** : `test/transfers.test.js:1-16`, `test/server.test.js:1-52`, `package.json`.
- **Dépend de la base** : non.

## Incertitudes

- **Frontière `catalogue-transferts` / `disponibilite-reservation`.** Les deux domaines partagent la même entité (le tableau `transfers`). Je les garde séparés parce qu'un chef de projet nommerait distinctement « l'offre » (catalogue, prix) et « la réservation / le remplissage » (stock, prise de siège) — et l'ajout de SHIAAAAAAAAAAAAAAAAAAAAAAAA-61 renforce ce choix, la réservation étant maintenant une capacité à part entière avec sa route et sa fonction dédiées. Un relecteur pourrait légitimement préférer une fusion « Offre & réservation de transferts » ; choix signalé plutôt que tranché en silence.
- **`isFull()` reste exporté mais mort côté runtime** (`src/transfers.js:17-19`) : toujours pas importé par `src/server.js:3` (qui importe `listTransfers`, `seatsLeft`, `bookSeats` — pas `isFull`), utilisé uniquement par `test/transfers.test.js`. La garde de complétude effective en production passe par `seatsLeft(transfer) < seats` dans `bookSeats()` (`src/transfers.js:24`), pas par `isFull()`. Facette prévue mais non exposée, ou legacy ? À noter pour l'analyse des workflows.
- **Réservation non persistée et non authentifiée.** `bookSeats()` mute `transfer.sold` en mémoire (`src/transfers.js:25`) : un redémarrage du process réinitialise tout le stock aux valeurs codées en dur. Aucune vérification d'identité/token sur `POST /reserve`. Aucune protection contre les réservations concurrentes (pas de verrou ; deux requêtes simultanées peuvent lire le même `seatsLeft`). Acceptable en pilote, à confirmer par le board pour la suite.
- **Corps JSON malformé silencieusement ignoré** (`src/server.js:33-35`) : un body invalide ⇒ `seats = undefined` ⇒ `bookSeats(id, 1)` (défaut). Choix délibéré ou masquage d'erreur ? À noter (relève plutôt de l'audit robustesse).
- **Aucune donnée réelle observée.** Tout est `VÉRIFIÉ_CODE`, rien n'est `OBSERVÉ` : serveur non exécuté, données en mémoire (`src/transfers.js:3-7`), pas de base. Aucun accès base fourni à ce stade — cohérent avec l'absence de persistance.
- **Écosystème inter-dépôts.** `README.md:3-4` désigne `shift-pilot-resa-web` comme consommateur (même projet, dépôt séparé). Le web ne consomme aujourd'hui que `GET /transfers` ; il n'appelle pas encore la nouvelle route de réservation. Hors périmètre de ce workspace ; relève de la synthèse transverse `ECOSYSTEME.md` au niveau projet.

## Journal de réconciliation

Confrontation de la carte canonique (branche `onboarding/artifacts`, SHA `d869b94`, pré-SHIAAAAAAAAAAAAAAAAAAAAAAAA-61) au code courant (`src/` au commit `6ef5850`) :

| Élément | Avant (carte canonique) | Après (code courant) | Action |
|---|---|---|---|
| Chemin d'écriture de réservation | **Absent** — « le nom *resa* n'est pas honoré par le code » (incertitude centrale) | `bookSeats()` + `POST /transfers/:id/reserve` implémentés | Incertitude **résolue** ; domaine réservation matérialisé |
| Domaine `disponibilite-places` | métier / cœur / **medium** (car `sold` jamais incrémenté) | Renommé `disponibilite-reservation`, gagne le versant écriture | Confiance **medium → high** |
| Domaine `exposition-http-api` | routage GET + 404 seulement | Ajout matching regex `:id`, parsing corps JSON POST | Preuves & description **étendues** |
| Domaine `qualite-tests` | **low** — « aucune couverture HTTP » | `test/server.test.js` couvre 200/404/409 en intégration HTTP | Confiance **low → medium** |
| Nombre de domaines | 4 | 4 | Inchangé (réservation fusionnée à la disponibilité, même entité) |

Les autres constats de la carte canonique (nature du projet, catalogue, absence de base, écosystème) restent valides et sont conservés.
