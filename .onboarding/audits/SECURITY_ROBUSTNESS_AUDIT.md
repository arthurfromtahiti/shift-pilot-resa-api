# Sécurité & Robustesse — Audit

> Confiance : high

## Compréhension globale

Le service est un pilote de démonstration sans aucune couche de sécurité. Les risques sont réels mais assumés pour ce contexte. Le constat le plus sérieux est un **bug fonctionnel avec impact sécurité** : le paramètre `seats` n'est pas validé comme entier positif, ce qui permet de créer des places de nulle part en passant une valeur négative. Ce bug est démontrable par lecture du code seul, sans exécution.

## Résumé exécutif

L'audit identifie cinq points de risque. Un seul est un **bug reproductible immédiatement** : `seats` peut être négatif, ce qui bypasse la garde de capacité et diminue le compteur `sold` (`src/transfers.js:24-25`). Les quatre autres sont des limitations de conception qui sont documentées comme intentionnelles pour un pilote : absence d'authentification, absence de CORS, race condition sur les réservations concurrentes, et parsing JSON silencieux. Le bug sur `seats` négatif est le seul qui devrait être corrigé avant tout accès externe au service, même en phase de test, car il permet à un appelant de manipuler le stock à sa guise.

## Constats détaillés

**Bug : `seats` non validé comme entier positif (`VÉRIFIÉ_CODE`)** : Dans `src/transfers.js:21-27`, `bookSeats(transferId, seats=1)` reçoit `seats` depuis l'appelant. La seule garde en place est `if (seatsLeft(transfer) < seats)` (ligne 24). Si `seats = -1` : `seatsLeft(transfer)` vaut par exemple 28, et `28 < -1` est `false` → la garde ne se déclenche pas. Ensuite, `transfer.sold += seats` exécute `transfer.sold += -1`, **diminuant** le compteur de sièges vendus. La fonction retourne `{ ok: true, seatsLeft: seatsLeft(transfer) }` avec une valeur de `seatsLeft` augmentée. Effet : un appelant malveillant peut créer des places inexistantes en boucle, jusqu'à ramener `sold` à zéro ou en dessous. Le même raisonnement s'applique à `seats = 0` (opération nulle, retourne 200 sans effets mais sans erreur) et `seats = 0.5` (mutation non entière du compteur). La valeur `seats` arrive de l'appelant HTTP via `src/server.js:36` : `bookSeats(id, seats ?? 1)` où `seats` est issu du JSON parsé sans validation de type (`src/server.js:29-35`).

**Absence d'authentification (`VÉRIFIÉ_CODE`)** : `POST /transfers/:id/reserve` (`src/server.js:23-42`) n'exige aucun token, aucune session, aucun header d'autorisation. N'importe quel client peut réserver autant de sièges qu'il le souhaite, autant de fois qu'il le souhaite, sans identité. Sur un pilote de démonstration à accès restreint, c'est acceptable ; sur un environnement accessible via réseau, c'est une surface d'abus directe.

**Absence de headers CORS (`VÉRIFIÉ_CODE`)** : `src/server.js` ne pose aucun header `Access-Control-Allow-Origin`. Le frontend (`shift-pilot-resa-web`) tourne sur un domaine différent (un serveur de fichiers statiques ou un port différent). Par conséquent, tout appel `fetch()` cross-origin depuis le navigateur sera bloqué par la politique CORS du navigateur — le workflow de consultation du catalogue ne peut pas fonctionner tel quel depuis le web, sauf si API et frontend sont servis à la même origine. Ce n'est pas un risque de sécurité stricto sensu (bloquer une requête cross-origin est le comportement attendu), mais c'est un **bug fonctionnel** pour l'intégration frontend.

**Race condition sur les réservations concurrentes (`HYPOTHÈSE — mode cluster uniquement`)** : `bookSeats` dans `src/transfers.js:21-27` lit `seatsLeft(transfer)` (ligne 24), puis mute `transfer.sold` (ligne 25), en deux opérations non atomiques. Cependant, `bookSeats` est entièrement synchrone (aucun `await`, aucun I/O dans son corps) et Node.js est single-threaded : une fois que le callback `req.on("end")` est déclenché, il s'exécute jusqu'à son retour sans jamais rendre la main à l'event loop. Deux requêtes POST simultanées sont donc traitées séquentiellement par l'event loop — leurs callbacks ne peuvent pas s'interleaver. La race condition est **impossible en process unique dans l'état actuel**. Elle ne deviendrait réelle qu'en présence d'appels asynchrones dans `bookSeats` (lecture en base de données, `await`) ou en mode cluster (plusieurs instances Node.js partageant les mêmes données). `HYPOTHÈSE — mode cluster uniquement` : risque conditionnel à une évolution de l'architecture, pas dans l'état synchrone actuel.

**Parsing JSON silencieux (`VÉRIFIÉ_CODE`)** : `src/server.js:30-35` : si le corps de la requête est vide ou malformé, `JSON.parse` lève une exception catchée silencieusement, et `seats` est positionné à `undefined`. Le fallback `seats ?? 1` dans `src/server.js:36` assure alors la réservation d'un siège. Ce comportement peut masquer des bugs côté client (client qui envoie un JSON invalide voit sa requête traitée comme une réservation d'un siège, sans avertissement).

**En-tête `Host` utilisé dans la construction d'URL (`VÉRIFIÉ_CODE`)** : `new URL(req.url, \`http://${req.headers.host}\`)` (`src/server.js:11`). La valeur `req.headers.host` provient du client et n'est pas validée. En pratique, l'URL est uniquement utilisée pour extraire `url.pathname`, donc l'impact est limité à une éventuelle exception si le header `Host` est absent ou malformé. Ce n'est pas une injection exploitable dans ce contexte, mais c'est une mauvaise pratique sur un code qui voudrait être durci.

## Forces

- **Séparation des données exposées** : `GET /transfers` ne retourne pas les champs internes `seats` et `sold` (`src/server.js:14-20`), uniquement la projection publique `{ id, from, to, price, seatsLeft }`. Pas d'exposition accidentelle de la structure interne.
- **Aucune dépendance externe** : surface d'attaque via la supply chain nulle (pas de `node_modules`).

## Dettes techniques

- **`seats` non validé** : absence de toute vérification que `seats` est un entier ≥ 1 (`src/server.js:29-35`, `src/transfers.js:21-27`). La fonction `bookSeats` reçoit des valeurs qu'elle ne devrait pas accepter.
- **Absence de headers de sécurité HTTP** : pas de `CORS`, pas de `X-Content-Type-Options`, pas de `Content-Security-Policy`. Pour un pilote de démonstration, c'est hors périmètre ; pour toute exposition publique, ce serait un prérequis.

## Zones critiques

- **`src/transfers.js:21-27` (`bookSeats`)** : c'est ici que le bug `seats` négatif se concrétise. La garde de capacité `seatsLeft < seats` est la seule protection contre des mutations aberrantes du stock — et elle est insuffisante.
- **`src/server.js:29-36`** (parsing et propagation de `seats`) : c'est le point d'entrée de la valeur non validée.

## Risques

- **Bug immédiatement exploitable : `seats` négatif ou nul** — un appelant passe `{ "seats": -1 }` en body POST, la réservation aboutit avec 200, et `transfer.sold` décroît de 1 (libérant un siège inexistant). Reproduisible par lecture du code (`src/transfers.js:24-25`). Impact : manipulation du stock à volonté par n'importe quel appelant. Gravité : **critique pour toute exposition réseau**, même dans un pilote.
- **Absence de CORS bloquant l'intégration frontend** : le frontend web ne peut pas appeler l'API depuis un domaine/port différent sans que le navigateur bloque la requête. Fonctionnalité actuellement non utilisable depuis le web. Impact fonctionnel, pas de sécurité.
- **Réservations illimitées sans authentification** : accès anonyme à la mutation de stock — `VÉRIFIÉ_CODE`, assumé pour le pilote.

## Recommandations priorisées

1. **Valider `seats` dans `bookSeats` ou dans `src/server.js`** avant tout accès externe, même de test : ajouter `if (typeof seats !== 'number' || !Number.isInteger(seats) || seats < 1)` et retourner une erreur 400 — `src/server.js:29-36` ou `src/transfers.js:21`. Priorité : **haute** (bug, pas choix de conception).
2. **Ajouter les headers CORS** (`Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`) dans `sendJson` ou dans un middleware dédié — `src/server.js:5-8`. Priorité : haute (bloque l'intégration frontend).
3. **Authentification** avant toute montée en charge ou accès public — hors périmètre pilote, mais doit figurer dans la roadmap.

## Questions ouvertes

- Quel est le niveau d'isolation réseau du pilote ? Si l'API n'est accessible qu'en intranet/localhost, le bug `seats` négatif est moins urgent qu'en exposition Internet.
- La politique CORS cible-t-elle un domaine précis ou wildcard `*` ? Décision board.
