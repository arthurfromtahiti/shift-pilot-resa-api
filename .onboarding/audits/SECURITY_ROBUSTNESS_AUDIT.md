# Sécurité & Robustesse — Audit

> Confiance : high

## Compréhension globale

Le service est un pilote de démonstration sans aucune couche de sécurité. Les risques sont réels mais assumés pour ce contexte. L'audit initial avait identifié un **bug fonctionnel avec impact sécurité** : le paramètre `seats` non validé permettait de créer des places inexistantes en passant une valeur négative. **Ce bug a depuis été corrigé** : une validation double couche (`Number.isInteger` et `>= 1`) est maintenant en place dans `src/server.js:37-39` et `src/transfers.js:26`. Les risques résiduels (authentification, CORS, race condition) sont des limitations de conception assumées pour ce pilote.

## Résumé exécutif

L'audit a identifié cinq points de risque. **Le bug critique — `seats` pouvant être négatif, bypassant la garde de capacité et décrémentant `sold` — a depuis été corrigé** : `src/server.js:37-39` et `src/transfers.js:26` valident désormais `seats` comme entier ≥ 1 dans les deux couches, avec retour 400 (HTTP) ou `{ ok: false, reason: "invalid_seats" }` (métier) pour toute valeur invalide. Les quatre autres points restent des limitations de conception documentées comme intentionnelles pour un pilote : absence d'authentification, absence de CORS, race condition sur les réservations concurrentes, et parsing JSON silencieux.

## Constats détaillés

**`seats` validé comme entier positif (`CORRIGÉ`)** : Ce bug a été corrigé. Une double validation est désormais en place : `src/server.js:37-39` (`!Number.isInteger(seatsValue) || seatsValue < 1`) retourne un 400 avant tout appel métier, et `src/transfers.js:26` (`!Number.isInteger(seats) || seats < 1`) retourne `{ ok: false, reason: "invalid_seats" }` comme garde de secours. Les valeurs `seats = -1`, `seats = 0` et `seats = 0.5` sont toutes rejetées dans les deux couches. *Contexte historique :* la seule garde initiale était `if (seatsLeft(transfer) < seats)` dans `bookSeats` — insuffisante car `28 < -1` est `false`, permettant `transfer.sold += -1` et la création de places inexistantes.

**Absence d'authentification (`VÉRIFIÉ_CODE`)** : `POST /transfers/:id/reserve` (`src/server.js:23-42`) n'exige aucun token, aucune session, aucun header d'autorisation. N'importe quel client peut réserver autant de sièges qu'il le souhaite, autant de fois qu'il le souhaite, sans identité. Sur un pilote de démonstration à accès restreint, c'est acceptable ; sur un environnement accessible via réseau, c'est une surface d'abus directe.

**Absence de headers CORS (`VÉRIFIÉ_CODE`)** : `src/server.js` ne pose aucun header `Access-Control-Allow-Origin`. Le frontend (`shift-pilot-resa-web`) tourne sur un domaine différent (un serveur de fichiers statiques ou un port différent). Par conséquent, tout appel `fetch()` cross-origin depuis le navigateur sera bloqué par la politique CORS du navigateur — le workflow de consultation du catalogue ne peut pas fonctionner tel quel depuis le web, sauf si API et frontend sont servis à la même origine. Ce n'est pas un risque de sécurité stricto sensu (bloquer une requête cross-origin est le comportement attendu), mais c'est un **bug fonctionnel** pour l'intégration frontend.

**Race condition sur les réservations concurrentes (`HYPOTHÈSE — mode cluster uniquement`)** : `bookSeats` dans `src/transfers.js:21-27` lit `seatsLeft(transfer)` (ligne 24), puis mute `transfer.sold` (ligne 25), en deux opérations non atomiques. Cependant, `bookSeats` est entièrement synchrone (aucun `await`, aucun I/O dans son corps) et Node.js est single-threaded : une fois que le callback `req.on("end")` est déclenché, il s'exécute jusqu'à son retour sans jamais rendre la main à l'event loop. Deux requêtes POST simultanées sont donc traitées séquentiellement par l'event loop — leurs callbacks ne peuvent pas s'interleaver. La race condition est **impossible en process unique dans l'état actuel**. Elle ne deviendrait réelle qu'en présence d'appels asynchrones dans `bookSeats` (lecture en base de données, `await`) ou en mode cluster (plusieurs instances Node.js partageant les mêmes données). `HYPOTHÈSE — mode cluster uniquement` : risque conditionnel à une évolution de l'architecture, pas dans l'état synchrone actuel.

**Parsing JSON silencieux (`VÉRIFIÉ_CODE`)** : `src/server.js:30-35` : si le corps de la requête est vide ou malformé, `JSON.parse` lève une exception catchée silencieusement, et `seats` est positionné à `undefined`. Le fallback `seats ?? 1` dans `src/server.js:36` assure alors la réservation d'un siège. Ce comportement peut masquer des bugs côté client (client qui envoie un JSON invalide voit sa requête traitée comme une réservation d'un siège, sans avertissement).

**En-tête `Host` utilisé dans la construction d'URL (`VÉRIFIÉ_CODE`)** : `new URL(req.url, \`http://${req.headers.host}\`)` (`src/server.js:11`). La valeur `req.headers.host` provient du client et n'est pas validée. En pratique, l'URL est uniquement utilisée pour extraire `url.pathname`, donc l'impact est limité à une éventuelle exception si le header `Host` est absent ou malformé. Ce n'est pas une injection exploitable dans ce contexte, mais c'est une mauvaise pratique sur un code qui voudrait être durci.

## Forces

- **Séparation des données exposées** : `GET /transfers` ne retourne pas les champs internes `seats` et `sold` (`src/server.js:14-20`), uniquement la projection publique `{ id, from, to, price, seatsLeft }`. Pas d'exposition accidentelle de la structure interne.
- **Aucune dépendance externe** : surface d'attaque via la supply chain nulle (pas de `node_modules`).

## Dettes techniques

- **`seats` validé** (`CORRIGÉ`) : la vérification `Number.isInteger` et `>= 1` est en place dans `src/server.js:37-39` et `src/transfers.js:26`. La dette technique initiale sur ce point a été résolue.
- **Absence de headers de sécurité HTTP** : pas de `CORS`, pas de `X-Content-Type-Options`, pas de `Content-Security-Policy`. Pour un pilote de démonstration, c'est hors périmètre ; pour toute exposition publique, ce serait un prérequis.

## Zones critiques

- **`src/transfers.js:21-27` (`bookSeats`)** : la validation de `seats` est désormais assurée en ligne 26 (`!Number.isInteger(seats) || seats < 1`). La garde de capacité `seatsLeft < seats` (ligne 29) constitue la protection suivante contre les débordements normaux.
- **`src/server.js:37-39`** (validation de `seats` en couche HTTP) : la validation est appliquée avant tout appel à `bookSeats` ; toute valeur non entière ou inférieure à 1 retourne immédiatement un 400.

## Risques

- **`seats` négatif ou nul — `CORRIGÉ`** : ce risque a été éliminé. `src/server.js:37-39` et `src/transfers.js:26` rejettent désormais toute valeur non entière ou inférieure à 1 — un appelant passant `{ "seats": -1 }` reçoit un 400 et `transfer.sold` n'est pas muté.
- **Absence de CORS bloquant l'intégration frontend** : le frontend web ne peut pas appeler l'API depuis un domaine/port différent sans que le navigateur bloque la requête. Fonctionnalité actuellement non utilisable depuis le web. Impact fonctionnel, pas de sécurité.
- **Réservations illimitées sans authentification** : accès anonyme à la mutation de stock — `VÉRIFIÉ_CODE`, assumé pour le pilote.

## Recommandations priorisées

1. **Valider `seats` dans `bookSeats` ou dans `src/server.js`** — **`FAIT`** : `src/server.js:37-39` retourne un 400 pour toute valeur non entière ou `< 1`, et `src/transfers.js:26` applique la même contrainte en couche métier.
2. **Ajouter les headers CORS** (`Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`) dans `sendJson` ou dans un middleware dédié — `src/server.js:5-8`. Priorité : haute (bloque l'intégration frontend).
3. **Authentification** avant toute montée en charge ou accès public — hors périmètre pilote, mais doit figurer dans la roadmap.

## Questions ouvertes

- Quel est le niveau d'isolation réseau du pilote ? Si l'API n'est accessible qu'en intranet/localhost, le bug `seats` négatif est moins urgent qu'en exposition Internet.
- La politique CORS cible-t-elle un domaine précis ou wildcard `*` ? Décision board.
