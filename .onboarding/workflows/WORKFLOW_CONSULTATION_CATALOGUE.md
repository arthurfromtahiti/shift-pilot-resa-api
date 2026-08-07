# WORKFLOW_CONSULTATION_CATALOGUE — Consulter le catalogue des transferts disponibles

## Classification
- **Type** : `api_flow`
- **Sous-type** : lecture publique, sans authentification
- **Visibilité** : `external_user` — consommé par un frontend web exposé à l'utilisateur final
- **Acteur principal** : Frontend Web (`shift-pilot-resa-web`, dépôt séparé)
- **Acteurs** : Frontend Web (consommateur HTTP) · API Backend (`shift-pilot-resa-api`, ce dépôt)
- **Criticité** : Haute — seul point d'entrée de lecture du catalogue ; sans lui, le frontend n'a rien à afficher ni à réserver
- **Confiance** : high
- **Justification** : Les quatre fichiers source lus (`src/server.js`, `src/transfers.js`, `test/transfers.test.js`, `test/server.test.js`) couvrent la totalité de ce flux (< 30 lignes actives). Toutes les affirmations sont `VÉRIFIÉ_CODE`. Aucune partie du code n'est inaccessible à la lecture. Le comportement du frontend (`shift-pilot-resa-web`) n'est **pas observable dans ce workspace** — toute mention du frontend est issue de `README.md:3-4` et constitue du contexte écosystème, pas une preuve code.

## Objectif

Permettre à un client web de récupérer la liste des transferts inter-îles — avec leur prix et leur nombre de places restantes — afin de les afficher à l'utilisateur. Ce flux couvre l'intégralité de la lecture du catalogue : un appel HTTP unique retourne l'ensemble des transferts (ou une liste filtrée selon un paramètre optionnel) sans pagination, sans authentification. C'est la seule route de lecture du service. Le filtrage optionnel par disponibilité (`?available=true`) permet de retourner uniquement les transferts avec places libres.

## Acteurs

- **Frontend Web** (`shift-pilot-resa-web`, dépôt séparé, hors périmètre) — émet le GET, consomme la réponse JSON
- **API Backend** (`src/server.js`) — reçoit, traite, répond
- Aucun utilisateur humain n'interagit directement avec cette route (pas d'UI propre à l'API)

## Points d'entrée

- `GET /transfers` — `src/server.js:13` (`url.pathname === "/transfers" && req.method === "GET"`)

## Étapes principales

1. Le serveur HTTP `http.createServer` reçoit la requête (`src/server.js:10`).
2. L'URL est parsée : `new URL(req.url, \`http://${req.headers.host}\`)` (`src/server.js:11`).
3. Le routage compare `url.pathname === "/transfers"` et `req.method === "GET"` (`src/server.js:13`).
4. Le paramètre de requête `available` est extraite : `url.searchParams.get("available") === "true"` (`src/server.js:14`).
5. `listTransfers()` est appelée et retourne le tableau `transfers` brut (les 3 transferts en mémoire, `src/transfers.js:13-15`).
6. Si `availableOnly` est vrai, le tableau est filtré par `.filter((t) => !isFull(t))` pour ne conserver que les transferts avec places disponibles (`src/server.js:15`).
7. Le tableau (complet ou filtré) est projeté via `.map(t => ({ id: t.id, from: t.from, to: t.to, price: t.price, seatsLeft: seatsLeft(t) }))` — `seats` et `sold` sont **masqués** (`src/server.js:16-22`).
8. Pour chaque transfert, `seatsLeft(t) = t.seats - t.sold` est calculé (`src/transfers.js:17-19`).
9. `sendJson(res, 200, body)` sérialise en JSON et répond avec `Content-Type: application/json` et statut 200 (`src/server.js:5-8`).

## Règles métier

- **Filtrage optionnel côté serveur** ([SHIAAAAAAAAAAAAAAAAAAAAAAAA-408](SHIAAAAAAAAAAAAAAAAAAAAAAAA-408)) : le paramètre de requête `?available=true` (optionnel) filtre le catalogue pour ne retourner que les transferts **non-saturés** (`isFull(t) === false`). Sans ce paramètre, le catalogue complet est retourné, y compris les transferts avec `seatsLeft: 0` (`src/server.js:14-15`). Le filtrage est appliqué après `listTransfers()` et avant la projection JSON.
- **Projection publique obligatoire** : les champs `seats` (capacité brute) et `sold` (places déjà vendues) sont **exclus** de la réponse ; seul `seatsLeft` (calculé) est exposé (`src/server.js:16-22`). Cela masque l'historique de remplissage.
- **Réponse toujours 200** : aucun cas d'erreur possible sur ce flux — le catalogue existe toujours en mémoire. La route ne peut retourner qu'un 200.
- **Calcul `seatsLeft` à chaque appel** : `seatsLeft(t) = t.seats - t.sold` est recalculé dynamiquement ; si `bookSeats()` a muté `sold` entre-temps, la valeur reflète immédiatement l'état courant (`src/transfers.js:17-19`).

## Données

- **`transfers[]`** : tableau statique en mémoire — source unique du catalogue (`src/transfers.js:3-7`). **Lu sans mutation** dans ce workflow.
- **Réponse JSON** : `Array<{ id: number, from: string, to: string, price: number, seatsLeft: number }>` — projection des 3 transferts initiaux.
- **Catalogue initial codé en dur** (valeurs à la démarrage du process) :
  - `id:1` Papeete→Moorea, 40 sièges, 12 vendus → `seatsLeft:28`, prix 3500 XPF
  - `id:2` Papeete→Bora Bora, 60 sièges, 60 vendus → `seatsLeft:0`, prix 21000 XPF
  - `id:3` Raiatea→Tahaa, 20 sièges, 5 vendus → `seatsLeft:15`, prix 1800 XPF
  - (`src/transfers.js:3-7`)

## Intégrations

- **`shift-pilot-resa-web`** (dépôt séparé, même projet Paperclip) — consomme `GET /transfers` (`README.md:3-4`). Hors périmètre de ce workspace. Aucune autre intégration externe visible.

## Risques

- **Divergence de nom de champ avec le frontend** (`HYPOTHÈSE`) : l'API retourne `seatsLeft` (`src/server.js:19`) ; selon `documents/ECOSYSTEME.md:14-22`, le frontend `shift-pilot-resa-web` accède à `t.availableSeats`, champ absent de la réponse API. Les places s'afficheraient `undefined` côté client. Le code frontend (`shift-pilot-resa-web`) n'est pas dans ce workspace — cette information est issue d'un artefact écosystème (`documents/ECOSYSTEME.md`), pas d'une lecture directe du code frontend.
- **Absence de pagination** : `listTransfers()` retourne l'intégralité du tableau sans limite (`src/transfers.js:9-11`). Si le catalogue venait à grossir (ajout de lignes dans le tableau), la réponse grossit proportionnellement sans contrôle.
- **Pas de test HTTP pour `GET /transfers`** : `test/server.test.js` ne couvre que les 3 cas POST (`test/server.test.js:34-52`). Un test de la route GET n'existe pas — une régression silencieuse est possible.
- **Aucun cache** : chaque appel relit le tableau en mémoire et recalcule `seatsLeft` pour chaque transfert. Acceptable à ce volume (3 éléments), à revisiter si le catalogue s'élargit.

## Questions ouvertes

- Le frontend `shift-pilot-resa-web` utilise-t-il `seatsLeft` ou `availableSeats` ? `documents/ECOSYSTEME.md:14-22` signale que le frontend accède à `t.availableSeats`, mais le code frontend n'est pas dans ce workspace — la divergence reste à confirmer sur le dépôt `shift-pilot-resa-web`.
- Aucun test HTTP n'existe pour `GET /transfers`. Un test de non-régression est-il prévu ?

## Preuves

- `src/server.js:5-8` — helper `sendJson`
- `src/server.js:10-21` — serveur, parsing URL, routage GET /transfers, map + sendJson
- `src/transfers.js:3-7` — tableau `transfers` (catalogue initial)
- `src/transfers.js:9-11` — `listTransfers()`
- `src/transfers.js:13-15` — `seatsLeft(transfer)`
- `src/transfers.js:21-23` — `isFull()` (exporté, utilisé pour filtrer les transferts saturés, `src/server.js:15`)
- `test/transfers.test.js:5-7` — test unitaire de `seatsLeft`
- `test/transfers.test.js:14-16` — test unitaire de `listTransfers` (3 éléments)
- `README.md:3-4` — mention de `shift-pilot-resa-web` comme consommateur (contexte écosystème, pas preuve code)
