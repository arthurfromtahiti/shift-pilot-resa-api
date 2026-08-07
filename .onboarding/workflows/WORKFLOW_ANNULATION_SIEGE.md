# WORKFLOW_ANNULATION_SIEGE — Annuler une réservation existante

## Classification
- **Type** : `api_flow`
- **Sous-type** : écriture avec mutation d'état inverse, libération de ressource
- **Visibilité** : `external_user` — consommé par un frontend web exposé à l'utilisateur final
- **Acteur principal** : Frontend Web (`shift-pilot-resa-web`, dépôt séparé)
- **Acteurs** : Frontend Web (consommateur HTTP) · API Backend (`shift-pilot-resa-api`, ce dépôt)
- **Criticité** : Moyenne-haute — chemin secondaire mais critique pour la commodité utilisateur (droit à l'erreur)
- **Confiance** : high
- **Justification** : Le code source est intégralement lu (`src/server.js:50-56`, `src/transfers.js:36-43`) et couvert par tests d'intégration HTTP. Toutes les affirmations sont `VÉRIFIÉ_CODE`. La mutation in-memory est observable ligne à ligne. Le comportement côté frontend n'est pas observable dans ce workspace.
- **Parent** : WORKFLOW_RESERVATION_SIEGE — l'annulation inverse une réservation précédemment effectuée

## Objectif

Permettre à un client web d'annuler une réservation précédemment acceptée, identifiée par son UUID `reservationId`. Le service vérifie que la réservation existe (en cherchant dans le registre Map), puis libère les places correspondantes et supprime l'enregistrement. C'est l'opération inverse et réversible de `bookSeats()`.

## Acteurs

- **Frontend Web** (`shift-pilot-resa-web`, dépôt séparé, hors périmètre) — soumet le DELETE avec l'UUID reçu de la réservation
- **API Backend** (`src/server.js`, `src/transfers.js`) — valide, libère les places, répond
- Aucun utilisateur humain n'interagit directement avec cette route (pas d'UI propre à l'API)

## Points d'entrée

- `DELETE /transfers/:id/reservations/:reservationId` — `src/server.js:48-55` (regex `/^\/transfers\/(\d+)\/reservations\/([^/]+)$/`, méthode DELETE)
- Paramètre d'URL `:id` : entier capturé par `(\d+)` (transferId), extrait et passé à `cancelReservation()` pour validation de cohérence
- Paramètre d'URL `:reservationId` : UUID capturé par `([^/]+)` (groupe 2), passé à `cancelReservation()` pour lookup

## Étapes principales

1. Le serveur HTTP `http.createServer` reçoit la requête (`src/server.js:10`).
2. L'URL est parsée : `new URL(req.url, "http://" + req.headers.host)` (`src/server.js:11`).
3. Le routage teste le regex `/^\/transfers\/(\d+)\/reservations\/([^/]+)$/` sur `url.pathname` **et** `req.method === "DELETE"` (`src/server.js:49`). Si les deux conditions échouent, la requête tombe dans le 404 par défaut (`src/server.js:57`).
4. Extraction des paramètres : `transferId` (groupe 1) et `reservationId` (groupe 2) (`src/server.js:50-51`).
5. `cancelReservation(reservationId, transferId)` est appelé **avec les deux paramètres** (`src/server.js:52`).
6. Dans `cancelReservation(reservationId, transferId)` (`src/transfers.js:36-44`) [SHIA-396] :
   - Recherche `reservations.get(reservationId)` pour retrouver la réservation (ligne 37)
   - Si non trouvée : retourne `{ ok: false, reason: "not_found" }`
   - **Valide cohérence** : vérifie que `reservation.transferId === transferId` (ligne 39) — rejette si incohérent (protection contre appels avec IDs mal appairés)
   - Récupère le transfert associé : `transfers.find(t => t.id === reservation.transferId)` (ligne 40)
   - **Libère les places** : `transfer.sold -= reservation.seats` (ligne 41) — opération **inverse** de bookSeats
   - Supprime l'entrée du registre : `reservations.delete(reservationId)` (ligne 42)
   - Retourne `{ ok: true, seatsLeft: seatsLeft(transfer) }` (ligne 43)
7. Mappage résultat → réponse HTTP (`src/server.js:53-54`) :
   - `ok: false` (réservation inexistante OU transferId incohérent) → `sendJson(res, 404, { error: "Reservation not found" })`
   - `ok: true` → `sendJson(res, 200, { seatsLeft: result.seatsLeft })`

## Règles métier

- **Existence de la réservation** : si `reservations.get(reservationId)` retourne `undefined`, la réservation n'existe pas (jamais existé, ou déjà annulée) → rejet 404 (`src/transfers.js:37-38`).
- **Transfert associé** : supposé exister (le registre détient `transferId` valide). Si un redémarrage supprime le catalogue, ce cas ne se produit pas car le registre est aussi vide au redémarrage.
- **Libération inverse et exacte** : `transfer.sold -= reservation.seats` restaure précisément le nombre de places réservées lors de la création. Pas de perte, pas d'excès (`src/transfers.js:40`).
- **Mutation immédiate et synchrone** : `transfer.sold` est modifié et l'entrée supprimée du registre dans le même tick — aucun délai, aucune confirmation différée (`src/transfers.js:40-41`).
- **Absence de piste d'audit** : l'annulation n'est pas loguée (pas de timestamp, pas d'identité client). Une requête d'annulation dupliquée retourne 404 la deuxième fois (pas d'idempotence).
- **Annulation totale, pas partielle** : on ne peut pas annuler « 2 sièges sur 5 réservés ». L'annulation supprime la réservation entière.

## Données

- **`reservation`** : structure `{ transferId: number, seats: number }` stockée dans `reservations Map` (clé = UUID)
- **`transfer.sold`** : restauré de `seats` (inverse de la réservation), ramené à sa valeur pré-réservation
- **Entrée** : aucune (le reservationId est dans l'URL)
- **Réponse 200** : `{ seatsLeft: number }` (places disponibles après libération)
- **Réponse 404** : `{ error: "Reservation not found" }`

## Intégrations

Aucune intégration externe explicite visible. Toute la logique est in-process et in-memory. L'écosystème (`shift-pilot-resa-web`) est hors périmètre de ce workspace.

## Risques

- **Double annulation** (`HYPOTHÈSE — mode client uniquement`) : si le frontend appelle DELETE deux fois avec le même UUID (ex. par accident, ou race condition côté client), la première réussit (200), la deuxième retourne 404. Le système n'est pas idempotent : deux requêtes identiques ne produisent pas le même état observé.
- **Perte totale de données au redémarrage** (`VÉRIFIÉ_CODE`) : `reservations` Map est in-memory (`src/transfers.js:11`). Un redémarrage du process la vide complètement. Les UUIDs générés lors des réservations précédentes deviennent invalides.
- **Pas d'authentification** : n'importe quel appelant HTTP peut annuler n'importe quelle réservation s'il connaît son UUID. Aucun lien entre le client et la réservation ; l'UUID est l'unique secret.
- **Validité de l'UUID au redémarrage** : si le client stocke un UUID et redémarre l'API entre la réservation et l'annulation, l'UUID est perdu. Une tentative d'annulation retourne 404.
- **Validation de cohérence `transferId/reservationId`** (`SHIA-396 guard`) : le paramètre `:id` dans l'URL est validé contre la réservation. La fonction `cancelReservation(reservationId, transferId)` vérifie que la réservation trouvée appartient bien au transfert désigné (ligne 39 de transfers.js). Un appel `DELETE /transfers/1/reservations/<uuid-d'un-autre-transfert>` retourne 404 (pas 200), protégeant contre les appels avec IDs mal appairés.

## Questions ouvertes

- La double annulation (idempotence) est-elle un cas à supporter ? Faut-il retourner 200 (succès idempotent) ou 404 (non trouvé) ?
- L'absence de lien client→réservation est-elle intentionnelle ? Faut-il demander un token/identifiant au moment de l'annulation pour vérifier l'ownership ?
- En cas de redémarrage du process, comment le frontend récupère-t-il une réservation perdue (dont l'UUID n'a plus de sens) ? Existe-t-il un fallback ?

## Preuves

- `src/server.js:48-55` — routage DELETE, extraction IDs, appel `cancelReservation`, mappage résultats → statuts HTTP
- `src/transfers.js:36-44` — `cancelReservation(reservationId, transferId)` : recherche Map, validation cohérence, libération `transfer.sold`, suppression Map, retour
- `src/transfers.js:11` — `reservations` Map (registre de suivi)
- `src/transfers.js:17-19` — `seatsLeft(transfer)` (utilisé pour calculer le retour)
- `src/transfers.js:5-9` — tableau `transfers` (dont `sold` est restauré)
- `test/server.test.js` — tests DELETE /transfers/:id/reservations/:reservationId (200/404)
- `test/transfers.test.js` — tests unitaires `cancelReservation()`
