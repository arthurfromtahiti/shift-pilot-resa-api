# WORKFLOW_CONSULTATION_CATALOGUE — Consulter le catalogue des transferts disponibles

## Classification
- **Type** : `api_flow`
- **Sous-type** : lecture publique, sans authentification, avec filtre optionnel de disponibilité
- **Visibilité** : `external_user` — consommé par un frontend web exposé à l'utilisateur final
- **Acteur principal** : Frontend Web (`shift-pilot-resa-web`, dépôt séparé)
- **Acteurs** : Frontend Web (consommateur HTTP) · API Backend (`shift-pilot-resa-api`, ce dépôt)
- **Criticité** : Haute — seul point d'entrée de lecture du catalogue ; sans lui, le frontend n'a rien à afficher
- **Confiance** : high
- **Justification** : Les quatre fichiers source lus (`src/server.js`, `src/transfers.js`, `test/transfers.test.js`, `test/server.test.js`) couvrent la totalité de ce flux (< 30 lignes actives). Toutes les affirmations sont `VÉRIFIÉ_CODE`. Le filtre `?available=true` (SHIA-408) est intégralement câblé côté runtime et couvert par `test/server.test.js:135-140`. Le comportement du frontend (`shift-pilot-resa-web`) n'est **pas observable dans ce workspace** — toute mention du frontend est issue de `README.md:3-4` et constitue du contexte écosystème, pas une preuve code.
- **Journal de réconciliation** : [SHIA-408] Ajout du filtre `?available=true` — objectif, étapes, règles, risques et questions ouvertes mis à jour pour refléter la route enrichie.

## Objectif

Permettre à un client web de récupérer le catalogue des transferts inter-îles — avec leur prix et leur nombre de places restantes — afin de les afficher à l'utilisateur. En mode non filtré (appel sans paramètre), la liste complète des transferts est retournée. En mode filtré (`?available=true`), seuls les transferts pour lesquels `isFull(t) === false` (i.e. `seatsLeft(t) !== 0` — `isFull` teste l'égalité stricte à 0, `src/transfers.js:21-23`) sont retournés ; un transfert sur-vendu avec `seatsLeft < 0` passerait ce filtre. C'est la seule route de lecture du service.

## Acteurs

- **Frontend Web** (`shift-pilot-resa-web`, dépôt séparé, hors périmètre) — émet le GET, consomme la réponse JSON
- **API Backend** (`src/server.js`) — reçoit, traite, répond
- Aucun utilisateur humain n'interagit directement avec cette route (pas d'UI propre à l'API)

## Points d'entrée

- `GET /transfers` — `src/server.js:13` (`url.pathname === "/transfers" && req.method === "GET"`)
- Paramètre de requête optionnel : `?available=true` — active le filtre de disponibilité (`src/server.js:14`)

## Étapes principales

1. Le serveur HTTP `http.createServer` reçoit la requête (`src/server.js:10`).
2. L'URL est parsée : `new URL(req.url, \`http://${req.headers.host}\`)` (`src/server.js:11`).
3. Le routage compare `url.pathname === "/transfers"` et `req.method === "GET"` (`src/server.js:13`).
4. Le paramètre de filtre est lu : `const availableOnly = url.searchParams.get("available") === "true"` (`src/server.js:14`).
5. La liste est construite conditionnellement (`src/server.js:15`) :
   - Si `availableOnly === true` : `listTransfers().filter(t => !isFull(t))` — exclut les transferts pour lesquels `seatsLeft === 0`
   - Sinon : `listTransfers()` retourne le tableau `transfers` complet (les 3 transferts en mémoire, `src/transfers.js:5-9`)
6. Le tableau résultant est projeté via `.map(t => ({ id: t.id, from: t.from, to: t.to, price: t.price, seatsLeft: seatsLeft(t) }))` — `seats` et `sold` sont **masqués** (`src/server.js:16-22`).
7. Pour chaque transfert, `seatsLeft(t) = t.seats - t.sold` est calculé (`src/transfers.js:17-19`).
8. `sendJson(res, 200, body)` sérialise en JSON et répond avec `Content-Type: application/json` et statut 200 (`src/server.js:5-8`).

## Règles métier

- **Filtre de disponibilité optionnel** : si `url.searchParams.get("available") === "true"`, seuls les transferts pour lesquels `isFull(t)` est `false` (i.e. `seatsLeft(t) !== 0`, car `isFull` teste l'égalité stricte à 0 — `src/transfers.js:21-23`) sont retenus (`src/server.js:14-15`). Un transfert sur-vendu avec `seatsLeft < 0` serait inclus par ce filtre. Sans ce paramètre, la liste est complète.
- **Projection** : les champs `seats` (capacité brute) et `sold` (places déjà vendues) sont **exclus** de la réponse ; seul `seatsLeft` (calculé) est exposé (`src/server.js:16-22`). Cela masque l'historique de remplissage.
- **Réponse toujours 200** : aucun cas d'erreur possible sur ce flux — le catalogue existe toujours en mémoire. Même si le filtre produit une liste vide, le statut est 200 avec un tableau vide.
- **Calcul `seatsLeft` à chaque appel** : `seatsLeft(t) = t.seats - t.sold` est recalculé dynamiquement ; si `bookSeats()` a muté `sold` entre-temps, la valeur reflète immédiatement l'état courant (`src/transfers.js:17-19`).

## Données

- **`transfers[]`** : tableau statique en mémoire — source unique du catalogue (`src/transfers.js:5-9`). **Lu sans mutation** dans ce workflow.
- **Réponse JSON** : `Array<{ id: number, from: string, to: string, price: number, seatsLeft: number }>` — projection filtrée ou complète des transferts.
- **Catalogue initial codé en dur** (valeurs à la démarrage du process) :
  - `id:1` Papeete→Moorea, 40 sièges, 12 vendus → `seatsLeft:28`, prix 3500 XPF
  - `id:2` Papeete→Bora Bora, 60 sièges, 60 vendus → `seatsLeft:0`, prix 21000 XPF (**complet** — exclu par `?available=true`)
  - `id:3` Raiatea→Tahaa, 20 sièges, 5 vendus → `seatsLeft:15`, prix 1800 XPF
  - (`src/transfers.js:5-9`)

## Intégrations

- **`shift-pilot-resa-web`** (dépôt séparé, même projet Paperclip) — consomme `GET /transfers` (`README.md:3-4`). Hors périmètre de ce workspace. Aucune autre intégration externe visible.

## Risques

- **Divergence de nom de champ avec le frontend** (`HYPOTHÈSE`) : l'API retourne `seatsLeft` (`src/server.js:21`) ; selon `.onboarding/documents/ECOSYSTEME.md:14-22`, le frontend `shift-pilot-resa-web` accède à `t.availableSeats`, champ absent de la réponse API. Les places s'afficheraient `undefined` côté client. Le code frontend (`shift-pilot-resa-web`) n'est pas dans ce workspace — cette information est issue d'un artefact écosystème (`.onboarding/documents/ECOSYSTEME.md`), pas d'une lecture directe du code frontend.
- **Absence de pagination** : `listTransfers()` retourne l'intégralité du tableau sans limite (`src/transfers.js:13-15`). Si le catalogue venait à grossir (ajout de lignes dans le tableau), la réponse grossit proportionnellement sans contrôle.
- **Aucun cache** : chaque appel relit le tableau en mémoire et recalcule `seatsLeft` pour chaque transfert. Acceptable à ce volume (3 éléments), à revisiter si le catalogue s'élargit.

## Questions ouvertes

- Le frontend `shift-pilot-resa-web` utilise-t-il `seatsLeft` ou `availableSeats` ? `.onboarding/documents/ECOSYSTEME.md:14-22` signale que le frontend accède à `t.availableSeats`, mais le code frontend n'est pas dans ce workspace — la divergence reste à confirmer sur le dépôt `shift-pilot-resa-web`.

## Preuves

- `src/server.js:5-8` — helper `sendJson`
- `src/server.js:11` — parsing d'URL
- `src/server.js:13` — condition de routage GET /transfers
- `src/server.js:14-15` — lecture de `?available`, filtrage conditionnel via `isFull`
- `src/server.js:16-22` — map de projection (masquage `seats`/`sold`, exposition `seatsLeft`)
- `src/transfers.js:5-9` — tableau `transfers` (catalogue initial)
- `src/transfers.js:13-15` — `listTransfers()`
- `src/transfers.js:17-19` — `seatsLeft(transfer)`
- `src/transfers.js:21-23` — `isFull(transfer)` (utilisé pour le filtre)
- `test/transfers.test.js:5-7` — test unitaire de `seatsLeft`
- `test/transfers.test.js:9-12` — test unitaire de `isFull`
- `test/transfers.test.js:14-16` — test unitaire de `listTransfers` (3 éléments)
- `test/server.test.js:128-133` — test d'intégration HTTP `GET /transfers` → 200, 3 éléments, `seatsLeft` numérique
- `test/server.test.js:135-140` — test d'intégration HTTP `GET /transfers?available=true` → exclusion du transfert complet (id:2)
- `README.md:3-4` — mention de `shift-pilot-resa-web` comme consommateur (contexte écosystème, pas preuve code)
