# WORKFLOW_RESERVATION_SIEGE — Réserver des sièges sur un transfert

## Classification
- **Type** : `api_flow`
- **Sous-type** : écriture avec mutation d'état, avec retour du résultat immédiat
- **Visibilité** : `external_user` — consommé par un frontend web exposé à l'utilisateur final
- **Acteur principal** : Frontend Web (`shift-pilot-resa-web`, dépôt séparé)
- **Acteurs** : Frontend Web (consommateur HTTP) · API Backend (`shift-pilot-resa-api`, ce dépôt)
- **Criticité** : Haute — seul chemin d'écriture du service ; c'est le cœur fonctionnel de la promesse « resa » du produit
- **Confiance** : high
- **Justification** : Le code source est intégralement lu (`src/server.js:23-42`, `src/transfers.js:21-27`) et couvert par 3 tests d'intégration HTTP (`test/server.test.js:34-52`). Toutes les affirmations sont `VÉRIFIÉ_CODE`. La mutation in-memory est observable ligne à ligne. Le comportement côté frontend n'est pas observable dans ce workspace.

## Objectif

Permettre à un client web de réserver N sièges (défaut : 1) sur un transfert spécifique identifié par son ID. Le service vérifie que le transfert existe et que la capacité est suffisante, puis décrémente les places disponibles en mémoire de manière immédiate et retourne le nouveau stock. C'est le seul chemin qui mute l'état du service.

## Acteurs

- **Frontend Web** (`shift-pilot-resa-web`, dépôt séparé, hors périmètre) — soumet le POST avec un corps JSON optionnel `{ seats: N }`
- **API Backend** (`src/server.js`, `src/transfers.js`) — valide, mute l'état, répond
- Aucun utilisateur humain n'interagit directement avec cette route (pas d'UI propre à l'API)

## Points d'entrée

- `POST /transfers/:id/reserve` — `src/server.js:23-24` (regex `/^\/transfers\/(\d+)\/reserve$/`, méthode POST)
- Paramètre d'URL `:id` : entier capturé par `(\d+)`, parsé avec `parseInt(..., 10)` (`src/server.js:25`)

## Étapes principales

1. Le serveur HTTP `http.createServer` reçoit la requête (`src/server.js:10`).
2. L'URL est parsée : `new URL(req.url, "http://" + req.headers.host)` (`src/server.js:11`).
3. Le routage teste le regex `/^\/transfers\/(\d+)\/reserve$/` sur `url.pathname` **et** `req.method === "POST"` (`src/server.js:23-24`). Si les deux conditions échouent, la requête tombe dans le 404 par défaut (`src/server.js:44`).
4. L'ID est extrait et converti : `parseInt(reserveMatch[1], 10)` (`src/server.js:25`).
5. Le corps HTTP est accumulé chunk par chunk : `req.on("data", chunk => body += chunk)` (`src/server.js:27-28`).
6. À la fin du corps (`req.on("end", ...)`), le JSON est parsé avec `body ? JSON.parse(body) : {}` enveloppé dans un `try/catch` — un corps vide ou malformé produit `seats = undefined` sans erreur visible (`src/server.js:28-35`).
7. `bookSeats(id, seats ?? 1)` est appelé : si `seats` est `undefined` (corps absent ou malformé), le défaut 1 est appliqué via `??` (`src/server.js:36`).
8. Dans `bookSeats(transferId, seats=1)` :
   - Recherche `transfers.find(t => t.id === transferId)` (`src/transfers.js:22`).
   - Si non trouvé : retourne `{ ok: false, reason: "not_found" }` (`src/transfers.js:23`).
   - Si `seatsLeft(transfer) < seats` : retourne `{ ok: false, reason: "full" }` (`src/transfers.js:24`).
   - Sinon : **mute** `transfer.sold += seats` et retourne `{ ok: true, seatsLeft: seatsLeft(transfer) }` (`src/transfers.js:25-26`).
9. Mappage résultat → réponse HTTP (`src/server.js:37-39`) :
   - `reason: "not_found"` → `sendJson(res, 404, { error: "Transfer not found" })`
   - `reason: "full"` → `sendJson(res, 409, { error: "Transfer full" })`
   - `ok: true` → `sendJson(res, 200, { transferId: id, seatsLeft: result.seatsLeft })`

## Règles métier

- **Défaut `seats = 1`** : si le corps est absent, vide, malformé ou si `seats` n'est pas dans le JSON, on réserve 1 siège via `seats ?? 1` (`src/server.js:36`). Le paramètre `seats` dans la signature de `bookSeats` a aussi un défaut `= 1` (`src/transfers.js:21`), mais c'est le `??` de l'appelant qui s'applique en premier.
- **Garde de capacité** : `seatsLeft(transfer) < seats` → rejet 409 (`src/transfers.js:24`). La condition est stricte (`<`), donc réserver exactement les places restantes est accepté (`seatsLeft === seats` passe).
- **Existence du transfert** : si `transfers.find()` retourne `undefined`, le transfert n'existe pas → rejet 404 (`src/transfers.js:22-23`).
- **Mutation immédiate et synchrone** : `transfer.sold += seats` est exécuté dans le même tick — aucun délai, aucune confirmation différée (`src/transfers.js:25`).
- **Absence de validation sur `seats ≤ 0`** : aucun garde sur la valeur de `seats`. Une valeur `seats=0` passe la garde (`seatsLeft >= 0` est toujours vrai) et retourne 200 sans muter `sold`. Une valeur **négative** passe aussi (`seatsLeft < -N` est toujours faux pour N>0) et décrémente `sold` (`transfer.sold += -N`), augmentant le stock disponible au-delà de la capacité initiale. Ni `src/server.js` ni `src/transfers.js` n'ont de validation `seats > 0`.
- **Corps JSON malformé silencieusement ignoré** : le `try/catch` de `src/server.js:30-35` avale toute exception de parsing ; `seats` prend `undefined`, puis le `??` applique 1. L'erreur n'est ni loguée ni remontée au client.

## Données

- **`transfer.sold`** : seul champ muté dans tout le service (`src/transfers.js:25`). Incrémenté de `seats` à chaque réservation acceptée. Réinitialisé aux valeurs codées en dur au redémarrage du process.
- **Entrée** : `{ seats?: number }` dans le corps JSON (optionnel, défaut 1)
- **Réponse 200** : `{ transferId: number, seatsLeft: number }`
- **Réponse 404** : `{ error: "Transfer not found" }`
- **Réponse 409** : `{ error: "Transfer full" }`

## Intégrations

Aucune intégration externe explicite visible. Toute la logique est in-process et in-memory. L'écosystème (`shift-pilot-resa-web`) est hors périmètre de ce workspace.

## Risques

- **Race condition sur le dernier siège** (`HYPOTHÈSE — mode cluster uniquement`) : dans la configuration actuelle (process Node.js unique), la garde `seatsLeft(transfer) < seats` et la mutation `transfer.sold += seats` sont exécutées de manière **synchrone** dans le même callback `req.on("end", ...)`, sans `await` ni I/O entre elles (`src/server.js:28-39`, `src/transfers.js:21-27`). Le modèle single-threaded de Node.js garantit qu'aucun autre callback ne peut s'intercaler entre la garde et la mutation : la race condition est **impossible en process unique**. Elle deviendrait réelle uniquement en mode cluster Node.js (plusieurs workers partageant un état commun), qui n'est ni configuré ni documenté dans ce dépôt.
- **Perte totale de données au redémarrage** (`VÉRIFIÉ_CODE`) : `transfer.sold` est in-memory (`src/transfers.js:3-7`). Un redémarrage du process réinitialise le catalogue à ses valeurs codées en dur. Aucune persistance sur disque ni base de données.
- **Pas d'authentification** : n'importe quel appelant HTTP peut réserver des sièges, potentiellement autant de fois qu'il veut, sans identité ni quota. La contrainte est uniquement la capacité totale du transfert.
- **Valeur `seats` négative ou nulle non rejetée** (`VÉRIFIÉ_CODE`) : `bookSeats(id, -5)` passe la garde `seatsLeft < -5` (toujours faux) et applique `transfer.sold += -5`, augmentant le stock fictif au-delà de la capacité initiale (`src/transfers.js:24-25`). `bookSeats(id, 0)` réussit sans muter l'état. Aucune validation de borne inférieure dans `src/server.js` ni dans `src/transfers.js`.
- **Absence de notification asynchrone** : la réservation est confirmée par la réponse 200, mais aucun mail, SMS ou webhook n'est déclenché. L'utilisateur final ne reçoit aucune confirmation hors de l'interface web.

## Questions ouvertes

- La valeur `seats` reçue doit-elle être rejetée si elle est ≤ 0 ? Le comportement actuel (accepter `seats=0`, accepter les valeurs négatives) est-il intentionnel ou un oubli ?
- Le corps JSON malformé doit-il retourner 400 plutôt que silencieusement tomber sur `seats=1` ? (`src/server.js:33-35`)
- La race condition est-elle un risque accepté si un déploiement multi-process (cluster Node.js, conteneurs multiples) est envisagé ? En process unique, aucun interleaving n'est possible ; mais si plusieurs workers accèdent au même état, un mécanisme d'exclusion mutuelle (verrou applicatif, opération atomique, base de données partagée) sera nécessaire.
- Aucun endpoint d'annulation n'existe (`DELETE` ou `POST /cancel`). Est-il prévu ?
- Le frontend `shift-pilot-resa-web` appelle-t-il déjà cette route ou est-elle encore en attente d'intégration côté web ?

## Preuves

- `src/server.js:23-41` — routage POST, parsing ID, accumulation corps, parse JSON (try/catch), appel `bookSeats`, mappage résultats → statuts HTTP
- `src/transfers.js:21-27` — `bookSeats()` : recherche, gardes, mutation `transfer.sold`, retour
- `src/transfers.js:13-15` — `seatsLeft(transfer)` (utilisé dans `bookSeats`)
- `src/transfers.js:3-7` — tableau `transfers` (état muté)
- `test/server.test.js:34-39` — test 200 : POST /transfers/1/reserve → seatsLeft=27
- `test/server.test.js:42-46` — test 409 : POST /transfers/2/reserve (complet) → "Transfer full"
- `test/server.test.js:48-52` — test 404 : POST /transfers/999/reserve (inexistant) → "Transfer not found"
