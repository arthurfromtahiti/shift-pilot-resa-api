# WORKFLOW_LISTE_TRANSFERTS — Lister les transferts inter-îles avec disponibilité en temps réel

## Classification
- **Type** : `api_flow`
- **Sous-type** : lecture / consultation publique
- **Visibilité** : `external_user`
- **Acteur principal** : Client HTTP externe (navigateur, application mobile, autre service)
- **Acteurs** : Client HTTP, Serveur Node.js (`src/server.js`)
- **Criticité** : Haute — seul point d'entrée HTTP fonctionnel du service ; son indisponibilité rend le service entier inaccessible
- **Confiance** : high
- **Justification** : `src/server.js` (30 lignes) et `src/transfers.js` (21 lignes) lus en intégralité. Chaque affirmation est vérifiable ligne à ligne. Aucune ambiguïté sur le flux principal.

## Objectif
Permettre à un client HTTP d'obtenir la liste complète des transferts inter-îles disponibles, avec pour chaque trajet le nombre de places restantes calculé à la volée. Le client reçoit uniquement les données utiles à l'affichage (sans exposer les données brutes de vente), ce qui lui permet de présenter les offres et leur disponibilité instantanée.

## Acteurs
- **Client HTTP externe** : déclenche la requête `GET /transfers`
- **Serveur Node.js** (`src/server.js`) : reçoit, route et répond
- **Module `transfers`** (`src/transfers.js`) : fournit les données et le calcul de disponibilité

## Points d'entrée
- `GET /transfers` — `src/server.js:13`

## Étapes principales
1. Le serveur reçoit la requête HTTP et parse l'URL (`src/server.js:11` : `new URL(req.url, ...)`).
2. Le routeur teste `url.pathname === "/transfers" && req.method === "GET"` (`src/server.js:13`).
3. `listTransfers()` est appelé (`src/server.js:14`, `src/transfers.js:9-11`) — retourne le tableau en mémoire des 3 transferts (Papeete→Moorea, Papeete→Bora Bora, Raiatea→Tahaa).
4. Pour chaque transfert, une projection est construite : `{ id, from, to, price, seatsLeft: seatsLeft(t) }` (`src/server.js:14-20`). Le champ `seatsLeft` est calculé par `t.seats - t.sold` (`src/transfers.js:13-15`).
5. La réponse JSON est sérialisée et envoyée avec statut `200` via `sendJson()` (`src/server.js:5-8`).
6. Toute URL non reconnue (y compris tout autre verbe sur `/transfers`) reçoit `{ error: "Not found" }` en `404` (`src/server.js:23`).

## Règles métier
- **Places restantes = capacité totale − places vendues** : `seatsLeft(t) = t.seats - t.sold` (`src/transfers.js:14`). Valeur statique car `sold` n'est jamais incrémenté dans le code source.
- **Projection client sans données brutes de vente** : les champs `seats` et `sold` ne sont pas exposés dans la réponse HTTP (`src/server.js:14-20`) — seul `seatsLeft` (valeur calculée) est transmis.
- **Aucun filtrage** : tous les transferts sont retournés, y compris les transferts complets (ex. id 2, `seatsLeft: 0`, `src/transfers.js:5`).
- **Aucune authentification ni autorisation** : l'endpoint est public, sans vérification d'identité (`src/server.js` — aucun middleware de sécurité visible).
- **Aucune pagination** : la liste entière est toujours retournée (`src/server.js:14`).

## Données
- **Tableau `transfers`** : 3 objets en mémoire, champs `id / from / to / seats / sold / price` (`src/transfers.js:3-7`). Données codées en dur, non persistées.
- **Projection exposée** : `id, from, to, price, seatsLeft` — subset calculé, sans `seats` ni `sold` (`src/server.js:14-20`).

## Intégrations
Aucune intégration externe explicite visible. Données en mémoire, aucune base de données, aucun appel HTTP sortant (`package.json` : zéro dépendance externe).

## Risques
- **Données non persistées** : un redémarrage du serveur réinitialise les valeurs de `sold` à leurs valeurs codées en dur (`src/transfers.js:3-7`). Toute réservation éventuelle serait perdue.
- **`sold` jamais incrémenté** : `seatsLeft` reflète une valeur statique (fixée à l'initialisation) et non l'état réel de vente — aucun `POST`, `PUT` ni `PATCH` dans `src/` ne modifie ce champ (grep de `src/` : zéro hit pour `sold =` ou `sold +=`). Le service ne peut donc pas refléter une réservation réelle.
- **Transferts complets visibles sans signal** : le transfert id 2 (`sold: 60 = seats: 60`) apparaît dans la liste avec `seatsLeft: 0` sans qu'aucune indication de saturation ne soit transmise au client (pas de champ `isFull`, `available`, etc. dans la projection).
- **Aucune protection contre la surcharge** : pas de rate-limiting, de timeout, ni de contrôle de concurrence visible (`src/server.js`).

## Questions ouvertes
- La fonction `isFull()` est définie et exportée (`src/transfers.js:17-19, 21`) mais non importée dans `src/server.js` (`src/server.js:3` : seuls `listTransfers` et `seatsLeft` sont importés). Est-elle destinée à filtrer les transferts complets dans une future version, ou à bloquer les réservations ?
- Le champ `sold` sera-t-il incrémenté par un endpoint de réservation à venir (ex. `POST /bookings`) ou par une synchronisation avec un système externe ?
- Un filtre de disponibilité (`?available=true`) est-il prévu pour masquer les transferts complets de la liste ?
- Absence d'authentification : est-ce intentionnel pour un pilote public, ou une contrainte à lever avant passage en production ?

## Preuves
- `src/server.js` — lu en intégralité (30 lignes)
- `src/transfers.js` — lu en intégralité (21 lignes)
- `package.json` — lu en intégralité (7 lignes) : zéro dépendance externe confirmée
