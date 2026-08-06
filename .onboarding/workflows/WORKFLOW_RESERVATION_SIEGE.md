# WORKFLOW_RESERVATION_SIEGE — Réserver des sièges sur un transfert

## Classification
- **Type** : `api_flow`
- **Sous-type** : écriture avec mutation d'état, avec retour du résultat immédiat (UUID de réservation)
- **Visibilité** : `external_user` — consommé par un frontend web exposé à l'utilisateur final
- **Acteur principal** : Frontend Web (`shift-pilot-resa-web`, dépôt séparé)
- **Acteurs** : Frontend Web (consommateur HTTP) · API Backend (`shift-pilot-resa-api`, ce dépôt)
- **Criticité** : Haute — seul chemin de prise d'une réservation ; c'est le cœur fonctionnel de la promesse « resa » du produit
- **Confiance** : high
- **Justification** : Le code source est intégralement lu (`src/server.js:23-45`, `src/transfers.js:25-34`) et couvert par 3 tests d'intégration HTTP. Toutes les affirmations sont `VÉRIFIÉ_CODE`. La mutation in-memory est observable ligne à ligne. Le comportement côté frontend n'est pas observable dans ce workspace.
- **Follow-up** : Voir WORKFLOW_ANNULATION_SIEGE.md pour l'annulation d'une réservation

## Objectif

Permettre à un client web de réserver N sièges (défaut : 1) sur un transfert spécifique identifié par son ID. Le service vérifie que le transfert existe et que la capacité est suffisante, puis décrémente les places disponibles en mémoire de manière immédiate et retourne le nouveau stock. C'est le seul chemin qui mute l'état du service.

## Acteurs

- **Frontend Web** (`shift-pilot-resa-web`, dépôt séparé, hors périmètre) — soumet le POST avec un corps JSON optionnel `{ seats: N }`
- **API Backend** (`src/server.js`, `src/transfers.js`) — valide, mute l'état, répond
- Aucun utilisateur humain n'interagit directement avec cette route (pas d'UI propre à l'API)

## Points d'entrée

- `POST /transfers/:id/reserve` — `src/server.js:23-24` (regex `/^\/transfers\/(\d+)\/reserve$/`, méthode POST)
- Paramètre d'URL `:id` : entier capturé par `(\d+)`, parsé avec `parseInt(..., 10)` (`src/server.js:25`)
- Corps JSON optionnel : `{ seats?: number }` (défaut 1)

## Étapes principales

1. Le serveur HTTP `http.createServer` reçoit la requête (`src/server.js:10`).
2. L'URL est parsée : `new URL(req.url, "http://" + req.headers.host)` (`src/server.js:11`).
3. Le routage teste le regex `/^\/transfers\/(\d+)\/reserve$/` sur `url.pathname` **et** `req.method === "POST"` (`src/server.js:23-24`). Si les deux conditions échouent, la requête tombe dans le 404 par défaut (`src/server.js:44`).
4. L'ID est extrait et converti : `parseInt(reserveMatch[1], 10)` (`src/server.js:25`).
5. Le corps HTTP est accumulé chunk par chunk : `req.on("data", chunk => body += chunk)` (`src/server.js:27-28`).
6. À la fin du corps (`req.on("end", ...)`), le JSON est parsé avec `body ? JSON.parse(body) : {}` enveloppé dans un `try/catch` — un corps vide ou malformé produit `seats = undefined` sans erreur visible (`src/server.js:28-35`).
7. Le serveur valide que `seats` est un entier positif (ligne 37-39), rejette avec 400 si invalid.
8. `bookSeats(id, seatsValue)` est appelé (`src/server.js:40`).
9. Dans `bookSeats(transferId, seats)` (`src/transfers.js:25-34`) :
   - Valide que `seats > 0` et `Number.isInteger(seats)` (ligne 26)
   - Si invalid : retourne `{ ok: false, reason: "invalid_seats" }`
   - Recherche `transfers.find(t => t.id === transferId)` (ligne 27)
   - Si non trouvé : retourne `{ ok: false, reason: "not_found" }`
   - Calcule `seatsLeft(transfer)` et teste (ligne 29)
   - Si `seatsLeft < seats` : retourne `{ ok: false, reason: "full" }`
   - Sinon : **mute** `transfer.sold += seats` (ligne 30)
   - Génère `reservationId = randomUUID()` (ligne 31)
   - Enregistre `reservations.set(reservationId, { transferId, seats })` (ligne 32)
   - Retourne `{ ok: true, reservationId, seatsLeft: seatsLeft(transfer) }` (ligne 33)
10. Mappage résultat → réponse HTTP (`src/server.js:41-43`) :
   - `reason: "not_found"` → `sendJson(res, 404, { error: "Transfer not found" })`
   - `reason: "full"` → `sendJson(res, 409, { error: "Transfer full" })`
   - `ok: true` → `sendJson(res, 200, { reservationId: result.reservationId, transferId: id, seatsLeft: result.seatsLeft })`

## Règles métier

- **Validation stricte de `seats`** : `seats` doit être un entier positif (`Number.isInteger(seats) && seats >= 1`), sinon rejet 400 (`src/server.js:37-39` et `src/transfers.js:26`). Validation dupliquée (prototypage).
- **Garde de capacité** : `seatsLeft(transfer) < seats` → rejet 409 (`src/transfers.js:29`). La condition est stricte (`<`), donc réserver exactement les places restantes est accepté (`seatsLeft === seats` passe).
- **Existence du transfert** : si `transfers.find()` retourne `undefined`, le transfert n'existe pas → rejet 404 (`src/transfers.js:27-28`).
- **Génération UUID** : chaque réservation acceptée génère un UUID unique via `crypto.randomUUID()` (ligne 31). L'UUID est retourné au client et stocké dans le registre.
- **Mutation immédiate et synchrone** : `transfer.sold += seats` et `reservations.set(...)` s'exécutent dans le même tick — aucun délai, aucune confirmation différée (`src/transfers.js:30-32`).
- **Mutation réversible** : le registre `reservations` permet une annulation ultérieure via `cancelReservation()` en retrouvant les seats à libérer. Voir WORKFLOW_ANNULATION_SIEGE.md.
- **Corps JSON malformé retourne 400** : si le corps JSON ne parse pas ou `seats` n'est pas un entier positif, le serveur retourne 400 (ligne 37-39), pas une valeur par défaut silencieuse.

## Données

- **`transfer.sold`** : champ muté lors de réservation (`src/transfers.js:30`), restauré lors d'annulation. Réinitialisé aux valeurs codées en dur au redémarrage du process.
- **`reservations` Map** : registre en mémoire `reservationId (UUID) → { transferId, seats }` (`src/transfers.js:11`). Peuplée par `bookSeats()`, purgée par `cancelReservation()`.
- **Entrée** : `{ seats?: number }` dans le corps JSON (optionnel)
- **Réponse 200** : `{ reservationId: string (UUID), transferId: number, seatsLeft: number }` [UPDATED]
- **Réponse 400** : `{ error: "seats must be a positive integer" }` [NEW]
- **Réponse 404** : `{ error: "Transfer not found" }`
- **Réponse 409** : `{ error: "Transfer full" }`

## Intégrations

Aucune intégration externe explicite visible. Toute la logique est in-process et in-memory. L'écosystème (`shift-pilot-resa-web`) est hors périmètre de ce workspace.

## Risques

- **Race condition sur le dernier siège** (`HYPOTHÈSE — mode cluster uniquement`) : dans la configuration actuelle (process Node.js unique), la garde `seatsLeft(transfer) < seats` et la mutation `transfer.sold += seats` sont exécutées de manière **synchrone** dans le même callback `req.on("end", ...)`, sans `await` ni I/O entre elles (`src/server.js:28-39`, `src/transfers.js:25-34`). Le modèle single-threaded de Node.js garantit qu'aucun autre callback ne peut s'intercaler entre la garde et la mutation : la race condition est **impossible en process unique**. Elle deviendrait réelle uniquement en mode cluster Node.js (plusieurs workers partageant un état commun), qui n'est ni configuré ni documenté dans ce dépôt.
- **Perte totale de données au redémarrage** (`VÉRIFIÉ_CODE`) : `transfer.sold` est in-memory (`src/transfers.js:5-9`). Un redémarrage du process réinitialise le catalogue à ses valeurs codées en dur. Aucune persistance sur disque ni base de données.
- **Pas d'authentification** : n'importe quel appelant HTTP peut réserver des sièges, potentiellement autant de fois qu'il veut, sans identité ni quota. La contrainte est uniquement la capacité totale du transfert.
- **Absence de notification asynchrone** : la réservation est confirmée par la réponse 200, mais aucun mail, SMS ou webhook n'est déclenché. L'utilisateur final ne reçoit aucune confirmation hors de l'interface web.

## Questions ouvertes

- La race condition est-elle un risque accepté si un déploiement multi-process (cluster Node.js, conteneurs multiples) est envisagé ? En process unique, aucun interleaving n'est possible ; mais si plusieurs workers accèdent au même état, un mécanisme d'exclusion mutuelle (verrou applicatif, opération atomique, base de données partagée) sera nécessaire.
- Comment le frontend `shift-pilot-resa-web` stocke-t-il l'UUID `reservationId` retourné ? En session client ? En localStorage ? En état applicatif ?
- Pourquoi la validation `seats > 0` est-elle dupliquée (serveur + transfers.js) ? Une validation unique suffirait en production.

## Preuves

- `src/server.js:23-45` — routage POST, validation ID, parsing JSON, validation seats, appel `bookSeats`, mappage résultats → statuts HTTP
- `src/transfers.js:25-34` — `bookSeats()` : validation, recherche, gardes, mutation `transfer.sold`, génération UUID, enregistrement Map, retour
- `src/transfers.js:11` — `reservations` Map (registre de suivi)
- `src/transfers.js:17-19` — `seatsLeft(transfer)` (utilisé dans `bookSeats`)
- `src/transfers.js:5-9` — tableau `transfers` (état muté)
- `test/server.test.js` — tests POST /transfers/:id/reserve (200/400/404/409)
- `test/transfers.test.js` — tests unitaires `bookSeats()`
