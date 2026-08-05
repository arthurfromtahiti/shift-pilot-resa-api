# Points chauds du code — Audit

> Confiance : high

## Compréhension globale

Le projet est trop petit (deux fichiers source, 53 lignes de code effectif) pour présenter des points chauds au sens classique du terme (fichiers de 500 lignes, couplages profonds, classes dieu). L'audit porte ici sur les zones qui **concentrent plusieurs responsabilités** ou qui seraient les premiers points de changement et de risque lors d'une évolution — et non sur des pathologies actuelles.

## Résumé exécutif

Le seul point chaud identifiable est le callback de `http.createServer` dans `src/server.js:10-23`. En 14 lignes, il accomplit : réception de la requête, parsing de l'URL, routage par pathname et méthode HTTP, appel à la couche données, projection du modèle interne vers la réponse API, sérialisation JSON, et cas par défaut 404. Pour une route unique, c'est lisible. C'est le point de croissance naturelle de l'application : chaque nouvelle route, nouveau cas d'erreur ou nouveau comportement transversal (logging, authentification) s'y accumule.

`src/transfers.js:3-7` est le second point de changement : tout ajout de donnée, de champ ou de trajet y passe. Son risque est limité par la nature statique du tableau.

Il n'y a pas de fichier gros, pas de classe complexe, pas de couplage profond, pas de fonction sans tests — à l'exception de `sendJson` et du handler HTTP complet. Les deux fichiers source sont correctement scopés.

## Constats détaillés

**`src/server.js:10-23` — le callback de routage polyvalent — VÉRIFIÉ_CODE.** Ce bloc de 14 lignes porte les responsabilités suivantes : (1) parsing de l'URL (`new URL(req.url, ...)`), (2) routage (`if url.pathname === "/transfers" && req.method === "GET"`), (3) appel à `listTransfers()`, (4) projection `.map()` vers le format de réponse API, (5) appel à `seatsLeft(t)` pour chaque transfert, (6) sérialisation via `sendJson`, et (7) cas 404 par défaut. C'est le carrefour de toute la logique applicative. Dans le code actuel, ce bloc est lisible d'un coup d'œil ; il deviendra difficile à maintenir dès la troisième ou quatrième route.

**`src/transfers.js:3-7` — la donnée centrale — VÉRIFIÉ_CODE.** Le tableau `transfers` est le seul état de l'application. Toute modification (ajout d'un transfert, changement de prix, correction d'un `sold`) passe par ce fichier. Ce n'est pas une complexité dangereuse dans l'état actuel, mais c'est l'unique point de couplage entre les données et tous leurs consommateurs (`listTransfers`, `seatsLeft`, `isFull`, les tests).

**`src/server.js:5-8` — `sendJson` — VÉRIFIÉ_CODE.** Cette fonction utilitaire de 4 lignes est le seul point de sérialisation HTTP de l'API. Elle n'est pas testée directement (voir `TESTING_AUDIT.md`). Elle est utilisée à deux endroits : route `GET /transfers` (`src/server.js:14`) et handler 404 (`src/server.js:23`). Elle n'est pas importable/partageable sans passer par `server.js`. Son périmètre est minimal.

**Aucun fichier « gros » — VÉRIFIÉ_CODE.** `src/server.js` : 31 lignes. `src/transfers.js` : 22 lignes. `test/transfers.test.js` : 17 lignes. Aucun des seuils classiques (> 200 lignes, > 10 fonctions, > 5 paramètres) n'est atteint.

**Couplage entre `src/server.js` et `src/transfers.js` — VÉRIFIÉ_CODE.** `src/server.js:3` importe `{ listTransfers, seatsLeft }` depuis `./transfers`. C'est le seul couplage inter-fichier du projet. Il est minimal, explicite, et ne crée pas de dépendance circulaire.

**`isFull` — fonction orpheline à risque de confusion — VÉRIFIÉ_CODE.** `src/transfers.js:17-19` exporte `isFull` ; `src/server.js:3` ne l'importe pas. `test/transfers.test.js:3` l'importe pour les tests. Cette dissymétrie entre l'API HTTP (qui n'expose pas `isFull`) et les tests (qui la valident) peut induire en erreur un nouveau développeur qui chercherait à supprimer la fonction « inutilisée » ou, à l'inverse, à s'appuyer dessus pour filtrer les transferts disponibles sans réaliser qu'elle n'est pas exposée.

## Forces

- **Fichiers petits et scopés** : aucun fichier ne dépasse 31 lignes. (`src/server.js:1-31`, `src/transfers.js:1-22`)
- **Un seul couplage inter-fichier, explicite** : `require("./transfers")` à `src/server.js:3`.
- **Fonctions pures dans la couche métier** : `seatsLeft` et `isFull` (`src/transfers.js:13-19`) n'ont pas d'effets de bord et sont testables isolément.
- **Guard `require.main`** : permet à `src/server.js` d'être importé sans lancer le serveur (`src/server.js:27`), ce qui empêche des effets de bord accidentels lors des imports.

## Dettes techniques

- **Projection et logique de route non séparées** : le mapping du modèle interne vers la réponse API est inline dans le handler (`src/server.js:14-20`), non extractible ni testable indépendamment sans modifier le handler.
- **`isFull` exportée mais non câblée** (`src/transfers.js:17-21`) : fonction testée mais morte côté HTTP — risque de confusion sur son statut (à conserver, à supprimer, à exposer ?).

## Zones critiques

- **`src/server.js:10-23`** : c'est l'unique point de croissance de l'application. Un senior regarderait ce bloc en premier lors de tout ajout de route, car c'est là que s'accumuleront les responsabilités.
- **`src/transfers.js:3-7`** : le tableau de données. Toute migration vers une base persistante passe par une réécriture de ce fichier et de ses consommateurs.

## Risques

- **Accumulation de logique dans le callback** : sans extraction du routage et de la projection, la maintenabilité du handler se dégrade linéairement avec le nombre de routes. À 3 routes, il deviendra difficile à lire ; à 5, risqué à modifier sans régression. Preuve de l'état actuel : `src/server.js:10-23`.
- **Fonction `isFull` mal comprise** : un nouveau développeur pourrait la supprimer (elle ne sert à rien en production) et casser les tests, ou l'ajouter à une route sans réaliser que le filtre n'a pas été pensé côté API. Preuve : `src/transfers.js:17-21` vs `src/server.js:3`.

## Recommandations priorisées

1. **Extraire la projection** — créer `formatTransfer(t)` dans `src/transfers.js` ou un fichier `src/formatters.js` — pour rendre la transformation modèle→API testable et réutilisable. — `src/server.js:14-20`
2. **Clarifier le statut de `isFull`** — soit la câbler à la route (`?available=true`), soit la retirer de l'export public et la garder en utilitaire interne non exporté — pour éviter la confusion. — `src/transfers.js:17-21`, `src/server.js:3`
3. **Préparer une abstraction de routage** avant la deuxième route — un `Map<string, handler>` ou un tableau de `{ method, pathname, handler }` — pour que la logique de dispatch ne s'accumule pas dans le callback. — `src/server.js:13-23`

## Questions ouvertes

- `isFull` est-elle destinée à être exposée via une route de filtrage (`GET /transfers?available=true`) dans le backlog ? Son existence et ses tests laissent penser que oui — mais aucune route ne l'utilise.
- La projection `{ id, from, to, price, seatsLeft }` est-elle stable ? Si `shift-pilot-resa-web` s'y est adapté, tout changement de champ est un breaking change d'API.
