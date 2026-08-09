# ECOSYSTEME — shift-pilot-resa

> Confiance : high

## Workspaces couverts

- **shift-pilot-resa-api** — API backend REST minimaliste en Node.js, exposant un catalogue de transferts inter-îles avec endpoints de consultation, réservation et annulation. Données en mémoire (volatiles).
- **shift-pilot-resa-web** — Interface web en HTML5 + JavaScript vanilla, affichant le catalogue des transferts consommé depuis l'API. Fonctionnalités complètes : consultation du catalogue, réservation de sièges avec gestion d'état utilisateur, annulation de réservation. Gestion d'erreur réseau intégrée avec messages utilisateur.

## Dépendances entre workspaces

### shift-pilot-resa-web → shift-pilot-resa-api

**Endpoint : GET /transfers (consultation catalogue)**

- **Consommé par** : `shift-pilot-resa-web/js/app.js:1-12`, fonction `loadTransfers()` 
- **Implémentation API** : `shift-pilot-resa-api/src/server.js:13-22` (route GET /transfers)
- **Contrat de données** :
  - **Requête** : GET sur `${API_BASE_URL}/transfers` (URL base configurée via `window.API_BASE_URL`, fallback `http://localhost:3100` en développement)
  - **Réponse 200** : tableau JSON de transferts
  - **Champs consommés par le frontend** : `from` (chaîne, île d'origine), `to` (chaîne, île destination), `price` (nombre, XPF), `seatsLeft` (nombre entier, places restantes)
  - **Projection API** : `{ id, from, to, price, seatsLeft }` (implémentation `server.js:16-22`)
  - **Filtrage optionnel** : paramètre `?available=true` filtre via `isFull()` pour ne retourner que transferts avec `seatsLeft > 0` (implémentation `server.js:14-15`, story SHIAAAAAAAAAAAAAAAAAAAAAAAA-408)
- **Utilisation** : rendu DOM — chaque transfert affiché en `<li>Papeete → Moorea — 3500 XPF (28 places)</li>` 

**Risque identifié — CORS bloquant** : L'API n'expose aucun header `Access-Control-Allow-Origin`. Si le frontend tourne sur une origine différente (ex. `localhost:3000` vs `localhost:3100`), le navigateur bloquera l'appel CORS. Documenté dans `PROJECT_CONTEXT.md` API comme question ouverte.

---

**Endpoint : POST /transfers/:id/reserve (réservation de sièges)**

- **Consommé par** : `shift-pilot-resa-web/js/app.js:44-65`, fonction `reserve()` ; bouton "Réserver" affiché pour chaque transfert avec places disponibles
- **Implémentation API** : `shift-pilot-resa-api/src/server.js:25-46`
- **Contrat** :
  - **Requête** : POST sur `/transfers/{id}/reserve` avec corps JSON `{ seats: N }` (optionnel, défaut 1)
  - **Validations** : `seats` doit être un entier ≥ 1 (rejet 400 si invalide, validation lignes 39-40)
  - **Réponse 200** : `{ reservationId (UUID), transferId, seatsLeft }`
  - **Erreurs** : 404 si transfert inexistant, 409 si capacité insuffisante
- **État de maturité** : Opérationnel et testé côté API et frontend. Frontend maintient un `Map<transferId, reservationId>` pour tracker les réservations actives de l'utilisateur, avec protection double-clic via `Set<pendingTransfers>`. Gestion d'erreur réseau : message visible sur échec

**Endpoint : DELETE /transfers/:id/reservations/:reservationId (annulation de réservation)**

- **Consommé par** : `shift-pilot-resa-web/js/app.js:67-86`, fonction `cancelReservation()` ; bouton "Annuler" affiché pour chaque transfert avec réservation active
- **Implémentation API** : `shift-pilot-resa-api/src/server.js:50-57`
- **Contrat** :
  - **Requête** : DELETE sur `/transfers/{id}/reservations/{reservationId}` (pas de corps)
  - **Validation de cohérence** : le `transferId` de l'URL doit correspondre au transfert propriétaire de la réservation (story SHIAAAAAAAAAAAAAAAAAAAAAAAA-353, sécurité)
  - **Réponse 200** : `{ seatsLeft }` (places libres après annulation)
  - **Erreurs** : 404 si réservation inexistante ou incohérence transferId
- **État de maturité** : Opérationnel côté API et frontend. Frontend utilise le `reservationId` retourné par POST /reserve, protège contre double-clic, et recharge le catalogue après succès. Gestion d'erreur réseau : message visible sur échec

### Aucune dépendance inverse

L'API n'appelle jamais le frontend. Le couplage est **unidirectionnel** (web → api).

## Flux transverses

### Flux principal : Affichage du catalogue (cross-workspace)

**Description métier** : Un utilisateur ouvre le frontend qui charge automatiquement et affiche le catalogue des transferts en interrogeant l'API en temps réel.

**Étapes** :

1. **Chargement HTML** (frontend) : Navigateur charge `index.html`, affiche titre et conteneur `<ul id="transfers-list">` vide
2. **Démarrage JS** (frontend) : `DOMContentLoaded` déclenche `loadTransfers()` (`app.js:3-12`)
3. **Résolution URL API** (frontend) : URL de base déterminée via `window.API_BASE_URL || "http://localhost:3100"` (`app.js:1`)
4. **Requête réseau** (frontend → api) : `fetch("${API_BASE_URL}/transfers")` lancée
5. **Réception et routage** (API) : `server.js:13` valide la route (`method === "GET"` && `pathname === "/transfers"`)
6. **Optionnel : filtrage disponibilité** (API) : si `?available=true`, applique `.filter(t => !isFull(t))` pour exclure transferts saturés (`server.js:14-15`)
7. **Calcul de disponibilité** (API) : pour chaque transfert, `seatsLeft = transfer.seats - transfer.sold` (`transfers.js:17-19`)
8. **Projection JSON** (API) : construits sous-ensemble `{ id, from, to, price, seatsLeft }` sans exposer `seats` ni `sold` (`server.js:16-22`)
9. **Réponse HTTP 200** (API → frontend) : tableau JSON sérialisé retourné
10. **Rendu DOM** (frontend) : boucle sur chaque transfert, crée `<li>` avec template `${from} → ${to} — ${price} XPF (${seatsLeft} places)` (`app.js:13-16`)
11. **Affichage utilisateur** : liste visible avec toutes données

**Preuves** :
- API : `PROJECT_CONTEXT.md` §Domaines clés, `CDC_FONCTIONNEL.md` §Parcours utilisateur principal §Parcours secondaire
- Frontend : `PROJECT_CONTEXT.md` §Domaines clés, `CDC_FONCTIONNEL.md` §Parcours fonctionnels §Flux principal

### Flux secondaire : Réservation de sièges (implémenté API et frontend)

**État** : L'endpoint POST /transfers/:id/reserve est **opérationnel et intégré au frontend** (`shift-pilot-resa-web/js/app.js:44-65`). La fonction `reserve(transferId)` envoie `{ seats: 1 }`, reçoit `reservationId`, stocke le mapping dans `Map<transferId, reservationId>`, et recharge le catalogue pour afficher le bouton "Annuler". Protection double-clic via `Set<pendingTransfers>` : si une opération est en cours sur ce transfert, l'appel est ignoré.

**Flux détaillé** :
1. Utilisateur clique sur bouton "Réserver" pour un transfert avec places disponibles (`seatsLeft > 0`)
2. Frontend ajoute transferId à `pendingTransfers`, envoie POST `/transfers/{id}/reserve { seats: 1 }`
3. API valide `seats` (entier ≥ 1), exécute `bookSeats()`, retourne `{ reservationId, transferId, seatsLeft }`
4. Frontend stocke `reservations.set(transferId, reservationId)`, retire de `pendingTransfers`, recharge catalogue
5. Catalogue réaffiche le transfert ; le bouton devient "Annuler" (car `reservations.has(t.id)` est vrai)
6. Sur erreur réseau ou API : message d'erreur affiché, réservation non stockée

### Flux tertiaire : Annulation de réservation (implémenté API et frontend)

**État** : L'endpoint DELETE /transfers/:id/reservations/:reservationId est **opérationnel et intégré au frontend** (`shift-pilot-resa-web/js/app.js:67-86`). La fonction `cancelReservation(transferId, reservationId)` envoie DELETE, supprime le mapping local, et recharge le catalogue pour afficher à nouveau le bouton "Réserver".

**Flux détaillé** :
1. Utilisateur clique sur bouton "Annuler" pour un transfert avec réservation active
2. Frontend récupère `reservationId` depuis `reservations.get(transferId)`, ajoute transferId à `pendingTransfers`
3. Envoie DELETE `/transfers/{transferId}/reservations/{reservationId}` (validation cohérence côté API, story SHIAAAAAAAAAAAAAAAAAAAAAAAA-353)
4. API valide la cohérence et retourne `{ seatsLeft }` (places libérées)
5. Frontend supprime `reservations.delete(transferId)`, retire de `pendingTransfers`, recharge catalogue
6. Catalogue réaffiche le transfert ; le bouton redevient "Réserver" (si places restantes)
7. Sur erreur réseau ou API : message d'erreur affiché, réservation conservée localement

## Couverture de test

### API (shift-pilot-resa-api)

**21 tests, tous passants** (`npm test` exécute `node --test test/*.test.js`) :
- 9 tests unitaires (`test/transfers.test.js`) couvrant primitives métier (`seatsLeft`, `isFull`, `listTransfers`) et opérations (`bookSeats`, `cancelReservation`)
- 12 tests d'intégration HTTP (`test/server.test.js`) couvrant les 3 endpoints (GET /transfers + filtre `?available=true`, POST /reserve, DELETE /reservations/:id) avec validations de codes HTTP (200/400/404/409), cohérence des données retournées, et cas limites de validation

**Détail** : audit complet dans `TESTING_AUDIT.md`

### Frontend (shift-pilot-resa-web)

**13 tests unitaires avec mocks, tous passants** (`npm test` exécute `node --test`) :
- 3 tests de chargement de catalogue (`loadTransfers`) : affichage réussi, gestion d'erreur HTTP (500), gestion d'erreur réseau
- 3 tests d'affichage des boutons : "Réserver" si places disponibles, absent si complet (seatsLeft = 0) ; "Annuler" si réservation active
- 2 tests de réservation (`reserve`) : envoi POST valide avec stockage `reservationId`, gestion d'erreur HTTP (409)
- 2 tests d'annulation (`cancelReservation`) : envoi DELETE valide avec nettoyage `reservationId`, gestion d'erreur HTTP (404)
- 3 tests de protection double-clic : `reserve` ignore second appel si opération en cours, `reserve` ignore si transfert déjà réservé dans `reservations`, `cancelReservation` ignore second appel si opération en cours

**Infrastructure de test** : mock DOM minimaliste simulant `document.getElementById()` et `fetch()`. Tests isolés de l'API réelle : `fetch` est complètement mocké, aucun test d'intégration API↔frontend n'existe. Validité limitée au comportement client en isolation.

---

## Questions ouvertes

### 1. **CORS bloquant en multi-domaine** (CRITIQUE POUR DÉPLOIEMENT)

**Énoncé** : L'API ne pose aucun header `Access-Control-Allow-Origin`. Si le frontend et l'API tournent sur des origines différentes, le navigateur bloquera l'appel `fetch()`.

**Risque** : Bloquant pour l'intégration développement/production si les services sont séparés.

**Preuve** : `shift-pilot-resa-api/PROJECT_CONTEXT.md` §Points d'attention critiques (Absence de CORS)

**Décision requise** : les deux services tourneront-ils derrière un proxy (même origine) ou faut-il ajouter CORS à l'API ?

### 2. **Configuration d'URL API non documentée** (DÉPLOIEMENT)

**Énoncé** : Le frontend injecte `window.API_BASE_URL` pour configurer l'URL de base de l'API. Le mécanisme d'injection en production n'est pas versionné.

**Preuve** : `shift-pilot-resa-web/js/app.js:1` (variable globale injectée de l'extérieur), `PROJECT_CONTEXT.md` §Points d'attention (Configuration d'URL non documentée)

**Décision requise** : comment la variable est-elle injectée en production ? via HTML hôte, build step, variables d'environnement ?

### 3. **Contrat de données non validé côté client** (ROBUSTESSE PILOTE)

**Énoncé** : Le frontend accède directement aux 4 champs (`from`, `to`, `price`, `seatsLeft`) sans validation. Un champ manquant produit `undefined` dans le rendu.

**Preuve** : `shift-pilot-resa-web/CDC_FONCTIONNEL.md` §Données consommées (Chacun est accédé directement sans validation), §Cas de bord (Transfert avec champ(s) manquant(s))

**Décision requise** : faut-il ajouter une validation client ou documenter le contrat comme convention ? Acceptable pour pilote, critique en production.

### 4. **Gestion d'erreur réseau implémentée** (ROBUSTESSE FRONTEND)

**Énoncé** : Le frontend capture toutes les erreurs réseau et d'API dans des blocs `try/catch` pour chaque opération (`loadTransfers()`, `reserve()`, `cancelReservation()`). En cas d'échec, un message lisible s'affiche dans la zone de liste. La réservation n'est stockée que si la réponse API est valide (`.ok === true`).

**Preuve** : 
- `loadTransfers()` : `app.js:12-41` — try/catch avec validation `.ok`, message d'erreur affiché
- `reserve()` : `app.js:44-65` — try/catch avec validation `.ok`, message visible sur échec
- `cancelReservation()` : `app.js:67-86` — try/catch avec validation `.ok`, message visible sur échec
- Message pattern : `"Impossible de [charger/réserver/annuler] : ${err.message}"` injecté en `.textContent` dans l'élément `<ul id="transfers-list">`

**État** : Bien couvert pour un pilote.

### 5. **Persistance des réservations** (ARCHITECTURE PRODUCTION)

**Énoncé** : L'API stocke réservations et `sold` en mémoire dans une Map. Un redémarrage du process les perd tous. Le champ `sold` revient aux valeurs hardcodées.

**Preuve** : `shift-pilot-resa-api/PROJECT_CONTEXT.md` §Données et persistance (Toute réservation... serait perdue dès le redémarrage), §Questions ouvertes (Persistance)

**Décision requise** : les réservations seront-elles persistées avant production ? via quelle technologie ?

### 6. **Filtrage de disponibilité exposé mais non consommé** (OPTIMISATION FUTURE)

**Énoncé** : L'API supporte `?available=true` pour filtrer les transferts saturés (story SHIAAAAAAAAAAAAAAAAAAAAAAAA-408, implémenté `server.js:14-15`). Le frontend charge toujours la liste complète via `GET /transfers` (sans paramètre), puis affiche boutons "Réserver" uniquement si `seatsLeft > 0`. Le filtrage serveur n'est pas utilisé.

**Preuve** : `shift-pilot-resa-web/js/app.js:13` (appel `fetch("${API_BASE_URL}/transfers")` sans param), `shift-pilot-resa-api/server.js:14-15` (filtrage implémenté mais pas appelé)

**Décision requise** : optimisation future — utiliser `?available=true` pour réduire la charge réseau si le catalogue devient volumineux. Actuellement sans impact sur la fonctionnalité.

---

## Synthèse

### Forces
- Couplage minimal et unidirectionnel, bien délimité
- Contrat API stable : 4 champs documentés, utilisés directement
- Trois flux métier implémentés côté API et frontend : consultation catalogue, réservation de sièges, annulation de réservation
- Gestion d'erreur réseau implémentée côté frontend (messages utilisateur, validation réponses)
- Protection double-clic côté frontend (via `pendingTransfers`)
- Tests passants dans chaque couche : 21 tests API (`npm test` dans shift-pilot-resa-api, couvrant unitaires et intégration HTTP) + 13 tests frontend unitaires (`npm test` dans shift-pilot-resa-web, avec mocks DOM et fetch)
- Rôles architecturaux bien délimités : chaque workspace est un dépôt Git indépendant avec son runtime et son cycle de test distinct
- **Aucun test d'intégration API↔frontend** : le frontend est testé en isolation avec `fetch` mocké ; la couche de communication réseau entre frontend et API n'a pas de couverture de test

### Risques persistants
1. **CORS bloquant** si origines différentes : API n'expose aucun header `Access-Control-Allow-Origin`
2. **Configuration injection non versionnée** : `window.API_BASE_URL` injectée dynamiquement, mécanisme de production non documenté
3. **Persistance inexistante** : toutes les réservations sont perdues au redémarrage API (stockage Map en mémoire)
4. **État local frontend non persisté** : rechargement de page = perte des réservations de l'utilisateur (Map `reservations`)
5. **Infrastructure de déploiement non documentée** : aucune config CI/CD, Dockerfile, ou processus de déploiement versionnée dans les deux repos. Déploiement indépendant possible (rôles architecturaux séparés), mais mécanisme non formalisé

### Prochaines étapes
1. **Avant déploiement multiserveur** : résoudre CORS (proxy unifié ou headers CORS sur API)
2. **Avant déploiement production** : documenter et versionner le mécanisme d'injection `window.API_BASE_URL`
3. **Avant production** : ajouter persistance (BDD, stockage persistant) pour réservations
4. **Optionnel** : persister état frontend (localStorage) pour conserver réservations entre rechargements
5. **Optionnel** : utiliser filtre `?available=true` pour optimiser les appels réseau si le catalogue croît

---

**Confiance globale : high** — les deux dépôts ont fait l'objet d'analyses exhaustives (domaines, workflows, audits). Les relations entre eux sont documentées et stables. Couverture de test confirmée : 21 tests API (tous passants, couvrant logique métier et endpoints HTTP) + 13 tests frontend (tous passants, tests unitaires avec mocks). **Lacune identifiée** : aucun test d'intégration API↔frontend n'existe — la couche de communication réseau n'est pas couverte. Les trois flux métier (consultation, réservation, annulation) sont implémentés dans le code mais validés uniquement en isolation côté API et côté frontend. Les questions ouvertes concernent des choix architecturaux (déploiement, persistance, gestion d'erreur) à trancher avant production.

