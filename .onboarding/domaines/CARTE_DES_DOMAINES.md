# Carte des domaines — shift-pilot-resa-api

> **Niveau de confiance global : medium.** Dépôt volontairement minimal (« pilote de test SHIFT/Paperclip », `README.md:3`) : ~1,5 Ko de source répartie sur deux fichiers. Toutes les affirmations ci-dessous sont `VÉRIFIÉ_CODE` (lues en source, `fichier:ligne`) ; **aucune n'est `OBSERVÉ`** — le serveur n'a pas été exécuté et aucune base n'existe (données en mémoire). Matière pauvre → carte courte et honnête, confiance donnée **par domaine**, jamais gonflée pour atteindre un quota.

## Nature du projet

**API HTTP de réservation de transferts inter-îles**, en Node natif (`node:http`), sans framework ni dépendance externe (`package.json`, `README.md:5-6`). Elle expose un **catalogue de transferts** (trajets Papeete↔Moorea, Papeete↔Bora Bora, Raiatea↔Tahaa) avec **prix** et **places restantes**, via une unique route de lecture `GET /transfers` (`src/server.js:13`). Les données sont **codées en dur en mémoire** (`src/transfers.js:3-7`), sans persistance ni écriture.

D'après le `README.md:3-4`, cette API est **consommée par `shift-pilot-resa-web`** (même projet Paperclip, dépôt séparé — hors périmètre de ce workspace). Malgré son nom « resa/réservation », **aucun chemin d'écriture de réservation n'existe dans le code** : seule la consultation est implémentée (voir Incertitudes).

## Domaines

### Catalogue des transferts inter-îles (`catalogue-transferts`)
- **Catégorie** : métier
- **Priorité** : cœur
- **Confiance** : high
- **Description** : Le référentiel des trajets de transfert proposés (origine, destination, prix), et leur exposition en liste au client. C'est la raison d'être du service : sans ce catalogue, l'API n'a rien à servir.
- **Entités** : le tableau `transfers` (`src/transfers.js:3-7`), objets à champs `id`, `from`, `to`, `seats`, `sold`, `price`.
- **Routes / points d'entrée** : `GET /transfers` (`src/server.js:13`) → renvoie `id`, `from`, `to`, `price`, `seatsLeft` par transfert (`src/server.js:14-20`) ; fonction `listTransfers()` (`src/transfers.js:9-11`).
- **Indices de rattachement** : identifiant `transfers`/`transfer`, champs `from`/`to`/`price`, chemin `src/transfers.js`, route `/transfers`.
- **Types de workflows attendus** : consultation de l'offre par un client web ; (à terme) filtrage/recherche de trajets.
- **Preuves** : `src/transfers.js:3-11`, `src/server.js:13-21`.
- **Dépend de la base** : non — données codées en dur en mémoire, aucun signal schéma/entité-étendue/code-exécutable de contenu piloté par la base.

### Disponibilité et occupation des places (`disponibilite-places`)
- **Catégorie** : métier
- **Priorité** : cœur
- **Confiance** : medium
- **Description** : Le suivi du remplissage de chaque transfert — places totales vs vendues — et le calcul des places restantes / de la complétude. C'est le versant « réservation » du produit (occupation), mais réalisé **en lecture seule** : le stock diminue via le champ `sold`, sans qu'aucun code observé ne l'incrémente (pas de prise de réservation). Confiance `medium` de ce fait.
- **Entités** : champs `seats` et `sold` du tableau `transfers` (`src/transfers.js:3-7`).
- **Routes / points d'entrée** : `seatsLeft(transfer)` = `seats - sold` (`src/transfers.js:13-15`), exposé dans la réponse de `GET /transfers` (`src/server.js:19`) ; `isFull(transfer)` = `seatsLeft === 0` (`src/transfers.js:17-19`), **exporté mais non câblé à une route** — utilisé seulement par les tests (`test/transfers.test.js:9-12`).
- **Indices de rattachement** : identifiants `seats`, `sold`, `seatsLeft`, `isFull`.
- **Types de workflows attendus** : affichage « complet / N places restantes » côté web ; (à terme, non présent) décrément de `sold` à la prise d'une réservation.
- **Preuves** : `src/transfers.js:13-19`, `src/server.js:19`, `test/transfers.test.js:5-12`.
- **Dépend de la base** : non.

### Exposition HTTP de l'API (`exposition-http-api`)
- **Catégorie** : technique
- **Priorité** : support
- **Confiance** : high
- **Description** : La couche serveur transverse qui reçoit les requêtes, route sur la méthode + le chemin, sérialise les réponses en JSON et gère les cas non trouvés. Transverse au métier : ne fusionne pas avec le catalogue.
- **Entités** : aucune entité métier — serveur `http.createServer` (`src/server.js:10`).
- **Routes / points d'entrée** : helper `sendJson(res, status, body)` (`src/server.js:5-8`) ; routage par `url.pathname` + `req.method` (`src/server.js:11-13`) ; réponse `404 { error: "Not found" }` par défaut (`src/server.js:23`) ; port configurable `process.env.PORT || 3100` et `server.listen` (`src/server.js:26-29`).
- **Indices de rattachement** : `http`, `createServer`, `sendJson`, `url.pathname`, `req.method`, `PORT`, chemin `src/server.js`.
- **Types de workflows attendus** : ajout de nouvelles routes, gestion des erreurs/statuts HTTP, configuration du port/déploiement.
- **Preuves** : `src/server.js:1-30`.
- **Dépend de la base** : non.

### Qualité et tests automatisés (`qualite-tests`)
- **Catégorie** : support
- **Priorité** : support
- **Confiance** : low
- **Description** : La suite de tests unitaires couvrant la logique métier (calcul des places, complétude, cardinalité du catalogue) via le lanceur natif `node:test`. Domaine mince (3 tests, logique pure uniquement — aucune couverture HTTP), d'où confiance `low` ; recensé parce qu'il existe et porte une preuve concrète, pas parce qu'il structure le produit.
- **Entités** : aucune.
- **Routes / points d'entrée** : script `npm test` → `node --test test/` (`package.json`) ; cas de test `seatsLeft`, `isFull`, `listTransfers` (`test/transfers.test.js:5-16`).
- **Indices de rattachement** : chemin `test/`, `node:test`, `node:assert`, suffixe `.test.js`.
- **Types de workflows attendus** : ajout de tests à la logique métier ; (absent) tests d'intégration de la route HTTP.
- **Preuves** : `test/transfers.test.js:1-16`, `package.json`.
- **Dépend de la base** : non.

## Incertitudes

- **Le nom « resa/réservation » n'est pas honoré par le code.** Aucun chemin d'écriture (prise de réservation, décrément de `sold`) n'est implémenté : recherche `grep -niE "post|put|delete|patch|book|reserv|resa"` sur `src/` + `test/` → **rien** hormis le nom de fichier/route. La seule route est `GET /transfers` (`src/server.js:13`). Question : le versant écriture de la réservation vit-il ailleurs (dans `shift-pilot-resa-web`, ou pas encore écrit car pilote) ? À confirmer par le board / à l'analyse du dépôt web.
- **`isFull()` est exporté mais mort côté runtime** (`src/transfers.js:17-19`) : utilisé uniquement par les tests, jamais par une route. Facette prévue mais non exposée, ou legacy ? À noter pour l'analyse des workflows.
- **Frontière `catalogue-transferts` / `disponibilite-places`.** Les deux domaines partagent la même entité (le tableau `transfers`). Je les ai séparés parce qu'un chef de projet nommerait distinctement « l'offre » et « le remplissage », et que l'occupation est le cœur du produit « resa ». Un relecteur pourrait légitimement préférer les fusionner en un seul domaine « Offre de transferts (catalogue + disponibilité) » ; ce choix est signalé plutôt que tranché en silence.
- **Aucune donnée réelle observée.** Tout est `VÉRIFIÉ_CODE`, rien n'est `OBSERVÉ` : serveur non exécuté, données en mémoire (`src/transfers.js:3-7`), pas de base. Aucun accès base n'a été fourni à ce stade — cohérent avec l'absence de persistance.
- **Écosystème inter-dépôts.** `README.md:3-4` désigne `shift-pilot-resa-web` comme consommateur (même projet, dépôt séparé). Hors périmètre de ce workspace ; relève d'une éventuelle synthèse transverse `ECOSYSTEME.md` au niveau projet (décision du coordinateur), pas de cette carte.
