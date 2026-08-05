# WORKFLOW_GET_TRANSFERS — Consultation du catalogue de transferts disponibles

## Classification
- **Type** : `api_flow`
- **Sous-type** : lecture / projection
- **Visibilité** : external_user
- **Acteur principal** : Client HTTP (`shift-pilot-resa-web`)
- **Acteurs** : Client HTTP externe ; serveur Node.js (`src/server.js`)
- **Criticité** : Haute — c'est l'unique route exposée par l'API ; sans elle, le service n'a aucune fonctionnalité.
- **Confiance** : high
- **Justification** : Point d'entrée, traitements et réponse intégralement visibles dans les deux fichiers source lus (`src/server.js` et `src/transfers.js`). Aucune couche cachée, aucun appel asynchrone, aucune dépendance externe. L'import de `seatsLeft` sans `isFull` dans `src/server.js:3` a été vérifié ligne par ligne.

## Objectif
Permettre à un client web de récupérer la liste complète des transferts inter-îles avec leur prix et le nombre de places restantes. C'est le seul service rendu par l'API dans son état actuel (pilote de démonstration). La réponse exclut délibérément les champs de stock interne (`seats`, `sold`) au profit d'une valeur calculée (`seatsLeft`).

## Acteurs
- **Client HTTP** : `shift-pilot-resa-web` (désigné consommateur dans `README.md:3-4` ; dépôt séparé, hors périmètre)
- **Serveur Node.js** : `src/server.js` (routage, sérialisation) + `src/transfers.js` (données, calcul)

## Points d'entrée
- `GET /transfers` (`src/server.js:13`)

## Étapes principales
1. Le serveur reçoit la requête via le callback de `http.createServer` (`src/server.js:10`).
2. L'URL est parsée : `new URL(req.url, 'http://' + req.headers.host)` (`src/server.js:11`).
3. Le routage vérifie `url.pathname === "/transfers" && req.method === "GET"` (`src/server.js:13`). Toute autre combinaison (mauvais chemin ou mauvaise méthode) tombe dans le cas par défaut et retourne `404 { error: "Not found" }` (`src/server.js:23`).
4. `listTransfers()` est appelée : retourne le tableau `transfers` brut (3 objets codés en dur en mémoire) (`src/transfers.js:9-11`).
5. La réponse est construite par `.map()` : pour chaque transfert `t`, `seatsLeft(t)` est calculé (`src/transfers.js:13-15`) et les champs `seats` et `sold` sont exclus. Projection retenue : `{ id, from, to, price, seatsLeft }` (`src/server.js:14-20`).
6. `sendJson(res, 200, …)` fixe le header `Content-Type: application/json` et sérialise via `JSON.stringify` (`src/server.js:5-8`).

## Règles métier
- **Places restantes = seats − sold** : `seatsLeft(transfer) = transfer.seats - transfer.sold` (`src/transfers.js:13-15`). Recalculé à chaque requête, non mis en cache ni persisté.
- **Les champs `seats` et `sold` ne sont pas exposés** : la projection `.map()` ne retient que `{ id, from, to, price, seatsLeft }` (`src/server.js:14-20`). Le remplissage interne reste opaque pour le client.
- **`isFull()` non câblée à cette route** : la fonction existe et est exportée (`src/transfers.js:17-21`) mais n'est pas importée dans `src/server.js` (`src/server.js:3`) et n'apparaît pas dans la projection. Le filtre « transferts complets » n'est pas exposé en HTTP.
- **Données statiques** : le tableau `transfers` est initialisé au démarrage du processus, codé en dur (`src/transfers.js:3-7`). Aucun appel de base, aucun appel externe.
- **Toujours 3 résultats retournés** : la réponse couvre systématiquement les 3 trajets (Papeete→Moorea, Papeete→Bora Bora, Raiatea→Tahaa). Aucun filtre, aucune pagination.

## Données
- `transfers` (tableau en mémoire, `src/transfers.js:3-7`) : 3 objets `{ id, from, to, seats, sold, price }` — Papeete→Moorea (seats:40, sold:12, price:3500), Papeete→Bora Bora (seats:60, sold:60, price:21000), Raiatea→Tahaa (seats:20, sold:5, price:1800).
- `seatsLeft(t)` (`src/transfers.js:13-15`) : valeur calculée à la volée, jamais persistée.

## Intégrations
Aucune intégration externe explicite visible. Données entièrement en mémoire ; aucune base, aucun cache, aucun appel tiers. `shift-pilot-resa-web` est consommateur (désigné dans `README.md:3-4`) mais est un dépôt séparé hors périmètre de ce workspace.

## Risques
- **Stock figé** : le champ `sold` n'est jamais incrémenté par aucune route (`grep -niE "post|put|delete|patch|book|reserv" src/` → aucun résultat). `seatsLeft` reflète un état initial statique : Bora Bora est « complet » (sold:60 = seats:60) dès le démarrage sans qu'aucune réservation ait eu lieu. Risque métier si le pilote évolue vers une vraie prise de réservation sans implémenter l'écriture.
- **Perte au redémarrage** : tout changement éventuel de `sold` en mémoire est perdu au redémarrage (données non persistées, aucune base). Cohérent avec le statut pilote, mais à surveiller dès qu'une route d'écriture est ajoutée.
- **Aucun filtre / tri / pagination** : la réponse retourne systématiquement les 3 transferts dans l'ordre du tableau (`src/transfers.js:3-7`). Un catalogue plus grand poserait un problème de performance et d'utilisabilité — non applicable au pilote actuel mais signal d'évolution à anticiper.
- **Aucune gestion des erreurs métier** : la route n'a aucun `try/catch` ; une exception non gérée dans `listTransfers()` ou `.map()` ferait planter le handler sans réponse structurée au client.

## Questions ouvertes
- Le champ `sold` sera-t-il mis à jour lors d'une vraie prise de réservation ? L'implémentation manque entièrement dans ce dépôt (`src/transfers.js` et `src/server.js` relus en intégralité). La réponse est peut-être dans `shift-pilot-resa-web`.
- `isFull(transfer)` est exporté (`src/transfers.js:21`) et testé (`test/transfers.test.js:9-12`) mais jamais câblé à une route. Une route `/transfers?available=true` ou un filtre côté réponse est-il prévu ?
- Le format de prix (entier brut `3500`, `21000`, `1800`) correspond-il à des XPF (francs Pacifique) ? Aucune devise ni format explicite dans le code.

## Preuves
- `src/transfers.js` — lu en intégralité (lignes 1-22)
- `src/server.js` — lu en intégralité (lignes 1-31)
