# Sécurité & Robustesse — Audit

> Confiance : high
> Mode : RÉCONCILIATION SHIA-571 (HEAD `8a108d1`). Évolution SHIA-396 : ajout de `cancelReservation()` et de l'endpoint DELETE — nouvelle surface à analyser. Évolution SHIA-408 : filtre `?available=true` sur GET (lecture seule, sans nouveau risque). Race condition correctement qualifiée `HYPOTHÈSE — mode cluster uniquement` depuis la correction post-relecture. Correction post-relecture (2e cycle) : preuve d'atteignabilité du crash `Host` malformé confirmée via vrai serveur HTTP ; recommandation `seats` retirée (déjà implémentée et testée). Correction post-relecture (3e cycle) : statuts runtime séparés (`OBSERVÉ`/`HYPOTHÈSE`/`VÉRIFIÉ_CODE`) ; décompte résumé corrigé à 8 constats ; parsing JSON ajouté en Risques et Recommandations ; recommandation CORS rendue prescriptive (allowlist, méthodes, headers, OPTIONS).

## Compréhension globale

Le service est un pilote de démonstration sans aucune couche de sécurité. Les risques sont réels mais assumés pour ce contexte. Le bug critique initial (`seats` négatif) a été corrigé. L'ajout de l'endpoint `DELETE /transfers/:id/reservations/:reservationId` introduit une nouvelle surface d'analyse : mutation d'état inversée, validation de cohérence URL/ressource, absence d'authentification sur l'opération de libération de stock.

## Résumé exécutif

L'audit a identifié **huit constats**. **Le bug critique — `seats` pouvant être négatif — a été corrigé** (`VÉRIFIÉ_CODE` + `OBSERVÉ` : 21 tests passent, `test/server.test.js:78-94`). Les sept autres points sont :

1. **Mutation inverse dans `cancelReservation`** — sûre en flow normal, aucune garde si Map corrompue (`HYPOTHÈSE`).
2. **Absence de garde sur `transfers.find()`** — TypeError si état incohérent (`HYPOTHÈSE`, impossible en flow normal).
3. **Absence d'authentification** — accès anonyme sur toutes les mutations (`VÉRIFIÉ_CODE`).
4. **Absence de CORS** — bloquant si frontend et API sont sur des origins distinctes (`HYPOTHÈSE`).
5. **Race condition** — impossible en process unique ; risque en mode cluster uniquement (`HYPOTHÈSE`).
6. **Parsing JSON silencieux** — un body malformé réserve un siège sans erreur (`VÉRIFIÉ_CODE`).
7. **En-tête `Host` malformé** — crash `TypeError: Invalid URL` non attrapé confirmé via TCP brut (`OBSERVÉ`).

Le DELETE est aussi non-authentifié que le POST.

## Constats détaillés

**`seats` validé comme entier positif (`VÉRIFIÉ_CODE`)** : double validation en place — `src/server.js:39-41` (`!Number.isInteger(seatsValue) || seatsValue < 1`) retourne 400 avant tout appel métier, et `src/transfers.js:26` (`!Number.isInteger(seats) || seats < 1`) retourne `{ ok: false, reason: "invalid_seats" }` comme garde de secours. Les valeurs `seats = -1`, `seats = 0` et `seats = 1.5` sont rejetées dans les deux couches. Tests couvrant ces cas : `test/server.test.js:78-94` — exécutés, 21 tests passés (`OBSERVÉ`).

**Mutation inverse dans `cancelReservation` — sûreté conditionnelle (`VÉRIFIÉ_CODE`)** : `src/transfers.js:41` exécute `transfer.sold -= reservation.seats`. La valeur `reservation.seats` a été validée comme entier positif lors de `bookSeats` (ligne 26) et stockée dans la Map. La soustraction ne peut donc pas produire une valeur négative en flow normal (on soustrait ce qui avait été validé et ajouté). Cependant, aucune garde explicite ne protège contre un état incohérent de la Map (ex. `reservation.seats` corrompu). En pratique, le seul chemin d'écriture vers la Map est `bookSeats` avec validation préalable — le risque est `HYPOTHÈSE` (condition impossible en flow normal actuel).

**Absence de garde sur `transfers.find()` dans `cancelReservation` (`VÉRIFIÉ_CODE`)** : `src/transfers.js:40` recherche le transfert associé à la réservation via `transfers.find(t => t.id === reservation.transferId)`. Si le résultat est `undefined`, la ligne 41 lève un TypeError. Ce cas est impossible en flow normal (le `transferId` dans la Map vient d'un `bookSeats()` réussi sur un transfert existant), mais l'absence de garde est un signal de code non-défensif.

**Absence d'authentification (`VÉRIFIÉ_CODE`)** : aucun des trois endpoints (`GET /transfers`, `POST /reserve`, `DELETE /reservations/:id`) n'exige de token, session ou header d'autorisation. N'importe quel client peut réserver ou annuler des sièges sans identité. Pour le DELETE spécifiquement, n'importe qui connaissant un UUID peut annuler la réservation correspondante — l'UUID est l'unique « secret » de facto.

**Absence de headers CORS (`VÉRIFIÉ_CODE`)** : `src/server.js` ne pose aucun header `Access-Control-Allow-Origin` (`src/server.js:5-8`). En l'absence de ces headers, un appel `fetch()` cross-origin depuis un navigateur peut être bloqué par la politique CORS du navigateur — le blocage effectif dépend du mode de la requête (simple vs préflightée) et de l'origin depuis laquelle le frontend est servi. Ce n'est pas un risque de sécurité stricto sensu, mais un bug fonctionnel potentiel pour l'intégration frontend (`HYPOTHÈSE` : l'impact est conditionnel à ce que frontend et API soient servis depuis des origins distinctes). Selon `.onboarding/documents/ECOSYSTEME.md`, seul `GET /transfers` est consommé par le frontend actuel — l'impact sur les endpoints `POST /reserve` et `DELETE /reservations/:id` est conditionnel à leur intégration future (`HYPOTHÈSE`).

**Race condition sur les opérations concurrentes (`HYPOTHÈSE — mode cluster uniquement`)** : `bookSeats` (`src/transfers.js:25-34`) et `cancelReservation` (`src/transfers.js:36-44`) sont deux fonctions entièrement synchrones — aucun `await`, aucun I/O dans leur corps. Node.js est single-threaded : une fois le callback `req.on("end")` déclenché pour le POST, ou le callback DELETE déclenché, la fonction s'exécute jusqu'à son retour sans jamais rendre la main à l'event loop. Deux requêtes simultanées sont traitées séquentiellement — leurs callbacks ne peuvent pas s'interleaver. La race condition est impossible en process unique dans l'état actuel. Elle ne deviendrait réelle qu'en présence d'appels asynchrones dans les fonctions métier (lecture en base de données, `await`) ou en mode cluster (plusieurs instances Node.js partageant les mêmes données).

**Parsing JSON silencieux (`VÉRIFIÉ_CODE`)** : `src/server.js:33-37` : si le corps de la requête POST est malformé, `JSON.parse` lève une exception catchée silencieusement, et `seats` est positionné à `undefined`. Le fallback `seatsValue = seats ?? 1` (`src/server.js:38`) assure alors la réservation d'un siège sans avertissement. Ce comportement peut masquer des bugs côté client.

**En-tête `Host` utilisé dans la construction d'URL (`VÉRIFIÉ_CODE`)** : `new URL(req.url, \`http://${req.headers.host}\`)` (`src/server.js:11`). La valeur `req.headers.host` provient du client et n'est pas validée. **Si `Host` est absent**, `req.headers.host` vaut `undefined`, le littéral de template produit `"http://undefined"` — URL syntaxiquement valide pour le constructeur ; aucune exception n'est levée (`VÉRIFIÉ_CODE` : testé via `new URL('/transfers', 'http://undefined')` → pathname `/transfers`, aucun throw). **Si `Host` est malformé** (ex. `foo bar` avec espace), le crash a été confirmé via le serveur HTTP réel (`OBSERVÉ` : requête TCP brute `Host: foo bar\r\n` envoyée à `server.listen(0)` → le parser llhttp laisse passer le header, `req.headers.host` reçoit `"foo bar"`, `new URL()` lève `TypeError: Invalid URL` non attrapé). Le serveur ne déclare aucun handler `uncaughtException` (`VÉRIFIÉ_CODE` : absent de `src/server.js`) — la terminaison du process Node.js est la conséquence attendue d'une exception non rattrapée en mode production (`HYPOTHÈSE` : terminaison non reproduite, process non tué lors du test). En pratique, HTTP/1.1 impose qu'un client conforme envoie un header `Host` bien formé — le crash n'est exploitable que par un client HTTP délibérément non-conforme (connexion TCP brute) (`HYPOTHÈSE` : niveau de risque faible en déploiement standard derrière un reverse proxy qui valide les headers). Mauvaise pratique sur un code durci, sans vecteur d'injection exploitable dans ce contexte.

## Forces

- **Séparation des données exposées** : `GET /transfers` retourne uniquement `{ id, from, to, price, seatsLeft }` (`src/server.js:16-22`) — pas d'exposition accidentelle de `seats` et `sold`.
- **Aucune dépendance de production déclarée** : surface d'attaque via la supply chain fortement réduite (`package.json:1-6`).
- **Cohérence URL/ressource sur l'annulation** : `cancelReservation` vérifie que `reservation.transferId === transferId` avant toute mutation (`src/transfers.js:39`). Un appelant ne peut pas annuler une réservation via l'URL d'un autre transfert.
- **Validation double couche sur `seats`** : HTTP (400 immédiat) + métier (reason: invalid_seats) — la dette de sécurité initiale est résolue.

## Dettes techniques

- **`seats` validé** (`VÉRIFIÉ_CODE`) : `src/server.js:39-41` et `src/transfers.js:26`.
- **Absence de headers de sécurité HTTP** : pas de CORS, pas de `X-Content-Type-Options`, pas de `Content-Security-Policy`. Hors périmètre pilote.

## Zones critiques

- **`src/transfers.js:40-41`** : `transfers.find()` sans garde suivi de `transfer.sold -= ...` — point de crash potentiel dans le chemin d'annulation (TypeError si `find()` retourne `undefined`).
- **`src/server.js:11`** : `new URL(req.url, \`http://${req.headers.host}\`)` — exécuté pour chaque requête, avant tout branchement. Un `Host` **absent** ne crashe pas (`"http://undefined"` est valide — `VÉRIFIÉ_CODE`). Un `Host` **malformé** (ex. `foo bar` avec espace) lève un `TypeError: Invalid URL` non attrapé — crash **confirmé via le vrai serveur HTTP** (`OBSERVÉ` : requête TCP brute avec `Host: foo bar` sur `server.listen(0)`). La terminaison du process est la conséquence attendue de ce TypeError non rattrapé (`HYPOTHÈSE` — terminaison non reproduite en test). L'exploitabilité reste faible : seul un client TCP délibérément non-conforme peut déclencher ce chemin ; un reverse proxy en amont élimine le risque (`HYPOTHÈSE`).
- **`src/server.js:39-41`** (validation de `seats` en couche HTTP) : toute régression ici réintroduirait le bug de seats négatif.
- **`src/transfers.js:26`** : garde de secours dans `bookSeats`.

## Risques

- **`seats` négatif ou nul** : risque adressé — validation en place (`VÉRIFIÉ_CODE`). `src/server.js:39-41` et `src/transfers.js:26`.
- **Absence de CORS bloquant l'intégration frontend** : l'absence de header `Access-Control-Allow-Origin` est vérifiée (`VÉRIFIÉ_CODE`, `src/server.js:5-8`). L'impact dépend de l'intégration effective — selon `.onboarding/documents/ECOSYSTEME.md`, seul `GET /transfers` est actuellement consommé par le frontend ; l'impact sur réservation et annulation est conditionnel à leur intégration (`HYPOTHÈSE`).
- **Réservations et annulations illimitées sans authentification** : accès anonyme à la mutation de stock sur les deux sens (réservation et libération) — `VÉRIFIÉ_CODE`, assumé pour le pilote.
- **TypeError latent dans `cancelReservation`** : `transfers.find()` retourne `undefined` en cas d'état incohérent — `HYPOTHÈSE` (`src/transfers.js:40`).
- **Race condition** : `HYPOTHÈSE — mode cluster uniquement`, impossible en process unique synchrone actuel.
- **Parsing JSON silencieux** : un body POST malformé déclenche le fallback `seats ?? 1` — une réservation d'un siège s'effectue sans que le client reçoive d'erreur (`VÉRIFIÉ_CODE`, `src/server.js:33-38`). Impact : bugs client masqués, réservations non intentionnelles possibles.

## Recommandations priorisées

> Note : la validation de `seats` (entier ≥ 1) est déjà implémentée et testée — `src/server.js:39-41` + `src/transfers.js:26` + `test/server.test.js:78-94`. Ce point n'est plus une recommandation ouverte ; il figure en "Zones critiques" comme garde à ne pas régresser.

1. **Configurer les headers CORS avec une allowlist** (`src/server.js:5-8`) : définir un header `Access-Control-Allow-Origin` sur une liste d'origins autorisées (ex. `https://frontend.example.com`) — **ne pas utiliser le wildcard `*`** pour une API exposant des mutations. Autoriser uniquement les méthodes nécessaires (`GET, POST, DELETE, OPTIONS`) et les headers requis (`Content-Type`). Ajouter un handler `OPTIONS` retournant 204 pour gérer les requêtes préflight. Priorité : **moyenne** (l'absence est vérifiée `VÉRIFIÉ_CODE` ; l'impact effectif est conditionnel à ce que frontend et API soient sur des origins distinctes — `HYPOTHÈSE`).
2. **Rejeter les JSON malformés avec une réponse 400** (`src/server.js:33-38`) : si `JSON.parse` lève une exception, répondre immédiatement 400 au lieu de continuer avec `seats = undefined`. Le comportement actuel masque silencieusement les erreurs client. Priorité : **basse** (fonctionnellement cohérent mais trompeur).
3. **Ajouter une garde défensive dans `cancelReservation`** après `transfers.find()` — `src/transfers.js:40`. Priorité : **basse** (défense en profondeur, cas impossible en flow normal).
4. **Authentification** avant toute montée en charge ou accès public — hors périmètre pilote, mais doit figurer dans la roadmap.

## Questions ouvertes

- Quel est le niveau d'isolation réseau du pilote ? Si l'API n'est accessible qu'en intranet/localhost, les risques d'abus sont moindres.
- La politique CORS cible-t-elle un domaine précis ou wildcard `*` ? Décision board.
- L'UUID comme seul facteur d'authentification pour l'annulation est-il accepté comme modèle de sécurité ? (ownership implicite via possession de l'UUID)

## Journal de réconciliation

| Élément | Version précédente | Version actuelle (HEAD `8a108d1`) | Action |
|---|---|---|---|
| Race condition | Qualifiée `HYPOTHÈSE — mode cluster uniquement` (corrigée post-relecture) | **HYPOTHÈSE — mode cluster uniquement maintenue** — `bookSeats` ET `cancelReservation` synchrones, même analyse | **Maintenu** |
| `cancelReservation` — surface sécurité | Absent | **Analysée** : mutation inverse sûre en flow normal, absence de garde sur `find()`, DELETE non-authentifié | **Ajouté** |
| Endpoint DELETE authentification | Absent | **Documenté** : non-authentifié, UUID comme seul secret | **Ajouté** |
| Cohérence URL/ressource | Absent | **Force documentée** : `reservation.transferId === transferId` (`src/transfers.js:39`) | **Ajouté** |
| Validation `seats` ligne refs | `src/server.js:37-39` | **`src/server.js:39-41`** | Numéro **mis à jour** |
| POST zone ligne refs | `src/server.js:23-42` | **`src/server.js:25-48`** | Numéro **mis à jour** |
| Parsing JSON silencieux | `src/server.js:30-35` | **`src/server.js:33-37`** | Numéro **mis à jour** |
| CORS — impact | Bloque workflow de consultation | **Absence de CORS confirmée** — impact sur réservation/annulation qualifié `HYPOTHÈSE` (non consommés par le frontend actuel) | **Étendu et requalifié** |
| Bug `seats` négatif | CORRIGÉ | **Confirmé** — tests 400 en place (`test/server.test.js:78-94`) | **Confirmé** |
| Host absent crash | Affirmé sans vérification | **Réfuté** : `"http://undefined"` est valide pour `new URL()` — aucun throw (`VÉRIFIÉ_CODE`). Crash seulement si Host est malformé (espace, crochet invalide) — cas rare, client non-conforme requis (`HYPOTHÈSE`) | **Corrigé post-relecture SHIA-571** |
| Host malformé — preuve d'atteignabilité | `VÉRIFIÉ_CODE` basé sur test REPL de `new URL()` isolé — chemin réel non prouvé | **Confirmé via vrai serveur HTTP** (`OBSERVÉ`) : requête TCP brute `Host: foo bar` sur `server.listen(0)` → llhttp laisse passer, `req.headers.host = "foo bar"`, crash `TypeError: Invalid URL`. Terminaison du process qualifiée `HYPOTHÈSE` (non reproduite en test) ; absence de handler `uncaughtException` est `VÉRIFIÉ_CODE` | **Complété post-relecture SHIA-571 (correction reviewer)** |
| Statuts de preuve runtime | Crash Host et tests `seats` marqués `VÉRIFIÉ_CODE` — confondu avec lecture de code | **Séparé** : exécution TCP brute et résultat `npm test` (21 tests) marqués `OBSERVÉ` ; terminaison du process marquée `HYPOTHÈSE` ; absence de handler `uncaughtException` maintenue `VÉRIFIÉ_CODE` | **Corrigé post-relecture SHIA-571 3e cycle** |
| Décompte résumé | "six points de risque, cinq autres" — incohérent avec le détail | **Recompté** : huit constats explicitement listés dans le résumé, chacun avec son statut | **Corrigé post-relecture SHIA-571 3e cycle** |
| Parsing JSON — Risques et Recommandations | Présent en Constats détaillés ; absent de Risques et Recommandations | **Ajouté** dans Risques (impact : réservation silencieuse sans erreur) et dans Recommandations (rejeter 400 si JSON malformé, priorité basse) | **Corrigé post-relecture SHIA-571 3e cycle** |
| CORS — recommandation | Générique : "ajouter les headers", wildcard non exclu | **Prescriptif** : allowlist d'origins nommée, méthodes (`GET, POST, DELETE, OPTIONS`) et headers (`Content-Type`) explicités, handler `OPTIONS` 204 pour préflight, wildcard `*` explicitement déconseillé | **Corrigé post-relecture SHIA-571 3e cycle** |
| Recommandation `seats` | Figurait en recommandation n°1 (avec note VÉRIFIÉ_CODE) | **Retirée** : validation déjà implémentée et testée — `src/server.js:39-41` + `src/transfers.js:26` + `test/server.test.js:78-94`. Maintenue en "Zones critiques" comme garde à ne pas régresser | **Corrigé post-relecture SHIA-571 (correction reviewer)** |
| CORS priorité | **haute** | **moyenne** — origin de déploiement inconnue, frontend absent du workspace, impact conditionnel confirmé | **Recalibrée post-relecture SHIA-571** |
