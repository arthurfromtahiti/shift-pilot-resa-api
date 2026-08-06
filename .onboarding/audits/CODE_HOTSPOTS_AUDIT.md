# Points chauds du code — Audit

> Confiance : high

## Compréhension globale

Le codebase est très petit (~80 lignes de code de production, ~70 lignes de tests). Il n'y a pas de fichier volumineux ni de couplage complexe. Les zones à surveiller sont celles qui concentrent à la fois la logique critique et l'absence de protections — dans un si petit projet, les points chauds sont moins des fichiers que des blocs de code précis.

## Résumé exécutif

Deux fichiers constituent tout le code de production, et un seul d'entre eux (`src/server.js`) porte plusieurs responsabilités entremêlées. Le bloc le plus risqué est la zone de traitement des requêtes POST (`src/server.js:23-42`) : il concentre la validation (absente), le parsing du corps JSON, l'appel métier, et le mappage des réponses HTTP — tout en gérant un callback asynchrone `req.on("end")` au milieu d'une fonction de dispatching synchrone. C'est sur cette zone qu'un bug, un changement de comportement ou une extension future aura le plus d'impact. La fonction `bookSeats` (`src/transfers.js:21-27`) est l'autre point chaud : c'est le seul endroit où l'état global est muté, et la garde de capacité y est à la fois le mécanisme de protection et sa seule implémentation.

## Constats détaillés

**`src/server.js:23-42` — zone de traitement POST, la plus couplée (`VÉRIFIÉ_CODE`)** : en 20 lignes, ce bloc effectue le matching de route (`url.pathname.match`), l'extraction et le cast du paramètre `id`, la collecte asynchrone du corps (`req.on("data")`), le parsing JSON avec fallback silencieux, l'extraction de `seats`, l'appel à `bookSeats`, et le mappage de tous les cas de réponse (200, 404, 409). Ces responsabilités multiples dans un même bloc rendent le code dense — chaque modification (ajouter une validation, changer le fallback, ajouter un nouveau statut HTTP) touche le même endroit et peut dégrader les autres comportements. Le traitement asynchrone (`req.on("end", () => {...})`) est correct mais augmente la profondeur d'imbrication et rend la lecture non linéaire.

**`src/transfers.js:21-27` — `bookSeats`, seule mutation d'état global (`VÉRIFIÉ_CODE`)** : cette fonction de 7 lignes est le seul point de mutation de l'état du service. Elle porte à la fois la recherche du transfert, la garde de capacité, la mutation de `transfer.sold`, et la construction de la réponse. C'est une fonction courte et lisible dans son état actuel. La validation de `seats` est désormais en place (ligne 26 : `!Number.isInteger(seats) || seats < 1`) — la dette de sécurité initiale sur ce point a été résolue. Les risques résiduels sont la race condition (hypothétique, mode cluster uniquement) et la borne inférieure sur `cancelReservation` (hors périmètre de `bookSeats`).

**`isFull` exporté mais mort en production (`VÉRIFIÉ_CODE`)** : `src/transfers.js:17-19` exporte `isFull` qui n'est importée nulle part dans `src/server.js:3` et n'est pas utilisée dans le chemin de réservation. La garde de complétude en production passe par `seatsLeft(transfer) < seats` dans `bookSeats`, pas par `isFull`. `isFull` n'est utilisé que dans `test/transfers.test.js:9-11`. C'est du code mort en production — pas un bug, mais un signal que le design initial prévoyait `isFull` comme garde principale et que l'implémentation a divergé sans nettoyage.

**Routage manuel sans table de routes (`VÉRIFIÉ_CODE`)** : `src/server.js:13` et `23` contiennent deux blocs de dispatching (`if (url.pathname === "/transfers" && req.method === "GET")` et `if (reserveMatch && req.method === "POST")`). L'ordre de ces blocs est significatif : la route GET est testée en premier, la route POST en second. Un troisième endpoint introduit un troisième bloc dont l'ordre relatif aux deux premiers doit être choisi consciemment. Il n'existe pas de protection contre les ambiguïtés de pattern.

**Absence de timeout sur la lecture du corps de requête (`VÉRIFIÉ_CODE`)** : `src/server.js:26-28` agrège le corps avec `req.on("data")` et attend `req.on("end")`. Un client qui envoie un corps très lentement (ou ne le termine jamais) gardera la connexion ouverte indéfiniment — le serveur ne pose pas de timeout. Pour un pilote à usage unique, c'est négligeable ; pour un service exposé, c'est un vecteur de Slowloris basique.

## Forces

- **Petite taille absolue** : la totalité du code de production tient en 80 lignes sur 2 fichiers — n'importe quel développeur peut lire tout le code en 5 minutes. Le point chaud le plus complexe (`src/server.js:23-42`) reste dans une portée mentale gérable.
- **`bookSeats` est la seule mutation** : une seule fonction mute l'état, ce qui rend le code raisonnable à auditer et à corriger. Pas de mutation dispersée ou cachée.
- **Pas de code mort volumineux** : hormis `isFull` (3 lignes), tout le code est utilisé dans un chemin réel.

## Dettes techniques

- **`isFull` exporté et non utilisé en production** : fonction de 3 lignes inutile dans `src/server.js`, présente dans les exports (`src/transfers.js:17-19`, `module.exports` ligne 29). Non dangereuse, mais source de confusion : pourquoi est-elle là si `bookSeats` ne l'appelle pas ?
- **Zone POST trop dense** (`src/server.js:23-42`) : validation, parsing, logique métier, réponse HTTP — dans un seul bloc. Toute extension (header de réponse, validation supplémentaire) s'y ajoute et augmente la densité.

## Zones critiques

- **`src/server.js:23-42`** : zone la plus risquée car elle mélange des responsabilités et gère l'asynchrone inline. C'est ici qu'un senior regarderait en premier lors d'un bug de réservation ou d'une extension de l'API.
- **`src/transfers.js:21-27`** (`bookSeats`) : seule porte de mutation de l'état global. Toute correction de sécurité ou de robustesse passe par cette fonction.

## Risques

- **Extension de l'API via la zone POST** : tout ajout de feature dans la gestion du corps de requête (limite de taille, header `Content-Type`, validation de `seats`) augmente la densité d'un bloc déjà dense. Risque de régression par effet de bord — `HYPOTHÈSE` (pas encore de troisième endpoint, risque potentiel).
- **Mutation dans `bookSeats` — validation désormais en place** (`CORRIGÉ`) : la validation de `seats` est en place dans `src/transfers.js:26` et `src/server.js:37-39` — toute valeur non entière ou `< 1` est rejetée avant que `transfer.sold += seats` (`src/transfers.js:30`) ne soit atteint. La mutation reste irréversible sans redémarrage du process, mais ne peut plus être déclenchée avec une valeur aberrante.
- **Timeout absent sur la lecture du body** : connexion maintenue indéfiniment si un client n'envoie jamais `end` — `VÉRIFIÉ_CODE`, risque minimal en pilote, non négligeable en exposition réseau.

## Recommandations priorisées

1. **Ajouter la validation de `seats` dans `bookSeats` ou avant l'appel** — **`FAIT`** : validation en place dans `src/transfers.js:26` et `src/server.js:37-39` — voir audit sécurité.
2. **Extraire le parsing du body POST en fonction dédiée** hors de la zone `src/server.js:23-42` : une fonction `parseBody(req)` qui retourne une Promise réduit la profondeur d'imbrication et isole le parsing des autres responsabilités. Priorité : basse (amélioration de lisibilité, pas de bug).
3. **Supprimer ou intégrer `isFull`** dans la logique de `bookSeats` : soit la supprimer (`src/transfers.js:17-19`) si elle n'a pas de rôle futur planifié, soit l'utiliser explicitement dans `bookSeats` à la place de la comparaison inline. Priorité : basse (code mort sans impact fonctionnel).

## Questions ouvertes

- Y a-t-il un plan pour introduire un routeur (`express`, `fastify`) avant l'ajout du troisième endpoint ? Cette décision changerait profondément `src/server.js`.
- `isFull` est-elle conservée pour une future route `GET /transfers/:id` qui exposerait le statut de disponibilité individuelle ? Si oui, sa présence est intentionnelle et mérite un commentaire.
