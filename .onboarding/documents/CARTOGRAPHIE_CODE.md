# CARTOGRAPHIE_CODE — shift-pilot-resa-api

Cartographie technique : structure de domaine, fichiers, points d'entrée, zones critiques.

> Confiance : high

## Vue d'ensemble

Deux fichiers source (~51 lignes), une architecture bipartite :
- `src/server.js` (30 lignes) — transport HTTP, routage, sérialisation JSON.
- `src/transfers.js` (21 lignes) — logique métier, catalogue de données.

Pas de framework, pas de ORM, pas de middleware. Séparation volontaire des responsabilités ; testabilité préservée via `require.main === module`.

---

## Domaines et fichiers

### Domaine 1 : Transport HTTP et routage

**Responsabilité** : recevoir requêtes HTTP, les valider, les router, et retourner des réponses JSON.

**Fichiers** :
- `src/server.js` (30 lignes) — unique fichier du domaine.

**Exports** :
- `server` (objet `http.Server`) — exporté via `module.exports` (ligne 30) ; utilisé par les tests et le runtime.

**Imports** :
- `listTransfers, seatsLeft` depuis `./transfers` (ligne 3) — fonctions métier consommées.
- `http.createServer` depuis `node:http` (ligne 1) — module Node natif.
- `URL` depuis `node:url` (ligne 2) — parsing d'URL.

**Points critiques** :
- Ligne 11 : `new URL(req.url, \`http://${req.headers.host}\`)` — parsing sans try/catch. Risque crash.
- Ligne 13 : routage inline sur `url.pathname === "/transfers" && req.method === "GET"`. Pas scalable au-delà de 2-3 routes.
- Ligne 5-8 : fonction `sendJson(res, status, body)` — centralise la sérialisation JSON et l'en-tête `Content-Type: application/json`.

**Zones à ne pas casser** :
- La séparation entre le routing logic et le business logic (import de `listTransfers` et `seatsLeft` seulement).
- L'export de `server` lui-même (utilisé par les tests pour importer et tester le serveur).
- Le guard `require.main === module` (ligne 27) qui permet une testabilité modulaire.

---

### Domaine 2 : Logique métier et données

**Responsabilité** : fournir primitives de calcul (`seatsLeft`, `isFull`) et accès au catalogue de transferts (`listTransfers`).

**Fichiers** :
- `src/transfers.js` (21 lignes) — unique fichier du domaine.

**Données** :
- `transfers` (ligne 3-7) — tableau littéral en mémoire, 3 objets (`id, from, to, seats, sold, price`).
  - id 1 : Papeete→Moorea, 40 places, 12 vendues, 3500 XPF → `seatsLeft: 28`.
  - id 2 : Papeete→Bora Bora, 60 places, 60 vendues, 21000 XPF → `seatsLeft: 0` (saturé).
  - id 3 : Raiatea→Tahaa, 20 places, 5 vendues, 1800 XPF → `seatsLeft: 15`.

**Exports** :
- `listTransfers` (ligne 9-11) — retourne `transfers` directement (pas de copie).
- `seatsLeft` (ligne 13-15) — calcule places restantes (`seats - sold`).
- `isFull` (ligne 17-19) — prédicat de saturation (`seatsLeft === 0`).

**Imports** : aucun. Module autonome.

**Points critiques** :
- Ligne 10 : `return transfers` — retourne référence interne, pas une copie. Vecteur de mutation accidentelle.
- Ligne 14 : `transfer.seats - transfer.sold` — aucune validation que `sold ≤ seats`. Peut retourner un nombre négatif silencieusement.
- Ligne 18 : `seatsLeft(transfer) === 0` — appelle `seatsLeft` ; pas de duplication de la règle, réutilisation correcte.
- Ligne 21 : `isFull` exportée mais non importée dans `server.js` (voir ligne 3 : seuls `listTransfers` et `seatsLeft` importés).

**Zones à ne pas casser** :
- La fonction `seatsLeft(t)` : elle est la source unique de la règle de calcul de disponibilité. Toute évolution doit passer par elle.
- L'existence du tableau `transfers` à l'adresse `src/transfers.js:3-7` (les tests y font référence indirectement via `listTransfers()`).
- L'export de `isFull` : même si non câblé actuellement, son existence est observée dans `test/transfers.test.js:3`.

---

## Points d'entrée du service

### HTTP
- **Route** : `GET /transfers` (`server.js:13`)
- **Logique** : appelle `listTransfers()` (`server.js:14`), puis projette chaque transfert (`server.js:14-20`) en appelant `seatsLeft(t)` pour calculer la disponibilité.
- **Réponse** : JSON array de 3 objets projetés, statut 200.
- **Fallback** : tout autre verbe/route retourne 404 (`server.js:23`).

### Démarrage du process
- **Entry** : `node src/server.js` (lancé si `require.main === module` à la ligne 27)
- **Port** : défaut 3100, surchargeable via env var `PORT` (`server.js:26`)
- **Output** : log console `"resa-api on :3100"` (`server.js:28`)

### Tests
- **Runner** : `npm test` → `node --test test/` (`package.json:6`)
- **Fichier test** : `test/transfers.test.js` (16 lignes)
- **Importe** : `{ listTransfers, seatsLeft, isFull }` depuis `../src/transfers` (ligne 3)
- **Ne teste que** : `listTransfers()`, `seatsLeft()`, `isFull()`. Zéro test HTTP du serveur.

---

## Flux d'une requête HTTP

```
Client HTTP → new request
       ↓
   server.js:10 (createServer callback)
       ↓
   server.js:11 (parse URL) ← RISQUE CRASH (no try/catch)
       ↓
   server.js:13 (test pathname === "/transfers" && method === "GET")
       ├─ YES → server.js:14-20
       │        ├─ listTransfers() [transfers.js:9-11]
       │        │  └─ returns [t1, t2, t3]
       │        ├─ for each t: map to projection
       │        │  └─ seatsLeft(t) [transfers.js:13-15]
       │        │     └─ return t.seats - t.sold
       │        ├─ sendJson(res, 200, projectedArray) [server.js:5-8]
       │        │  └─ res.writeHead(200, { "Content-Type": "application/json" })
       │        │  └─ res.end(JSON.stringify(...))
       │        └─ return (end of handler)
       │
       ├─ NO → server.js:23
       │       └─ sendJson(res, 404, { error: "Not found" })
       │          └─ return
       ↓
   Response sent to client
```

---

## Dépendances internes

```
server.js
  ├── imports from transfers.js: listTransfers, seatsLeft
  └── node:http, node:url (stdlib)

transfers.js
  └── (no imports; self-contained)

test/transfers.test.js
  ├── imports from ../src/transfers: listTransfers, seatsLeft, isFull
  ├── node:test, node:assert/strict (stdlib)
  └── (never imports server.js)
```

Pas de dépendance circulaire. Architecture acyclique.

---

## Zones critiques — dettes et risques

### Hotspot 1 : URL Parsing sans protection (`server.js:11`)
```javascript
const url = new URL(req.url, `http://${req.headers.host}`);
```
**Risque** : `TypeError: Invalid URL` sur requête malformée (HTTP/0.9, proxy CONNECT, fuzzer) → crash de process.
**Impact** : service entier inaccessible.
**Recommandation** : entourer dans `try/catch`, retourner `400 Bad Request` sur exception.

### Hotspot 2 : Référence mutable exposée (`transfers.js:10`)
```javascript
function listTransfers() {
  return transfers;  // direct reference, not a copy
}
```
**Risque** : futur code qui muterait un objet du tableau retourné (`listTransfers()[0].sold = 999`) mute l'état global du module, silencieusement, sans log.
**Impact** : corruption d'état observable à l'insu des autres requêtes.
**Recommandation** : retourner `[...transfers]` ou `transfers.slice()` pour une copie shallow.

### Hotspot 3 : `isFull` orpheline (`transfers.js:17-21`)
```javascript
function isFull(transfer) {
  return seatsLeft(transfer) === 0;
}
module.exports = { listTransfers, seatsLeft, isFull };  // exported
```
**Réalité** : `isFull` est exportée mais **non importée** par `server.js` (ligne 3 : seuls `listTransfers` et `seatsLeft`).

**Risque** : un développeur qui ajoute un filtre « transferts complets » ou un blocage de réservation sur saturé peut réécrire la règle `seatsLeft(t) === 0` indépendamment, créant une divergence silencieuse.
**Recommandation** : importer et câbler `isFull` si elle est destinée à filtrer ou bloquer ; sinon, ajouter un commentaire JSDoc expliquant son rôle préparatoire.

### Risque latent : Données mutables via `listTransfers()`
À ne pas casser : si `listTransfers()` commence à être appelé par un futur endpoint de réservation qui veut incrémenter `sold`, l'absence de copie défensive devient une vulnérabilité d'état global. Une migration vers une BD ou un cache synchronisé sera plus facile si `listTransfers()` retourne déjà une copie (contrat d'API clairement défini).

---

## Fichiers de support

### Configuration et démarrage
- `package.json` (7 lignes) — définit dépendances (zéro), test script, engine Node ≥18.
  - **Script** : `test` = `node --test test/`
  - **Défaut** : pas de script `start` ; démarrage manuel requis.
  
- `README.md` (8 lignes) — description et stack du projet.

### Fichier de test
- `test/transfers.test.js` (16 lignes) — 3 tests unitaires des fonctions pures.
  - Zéro test HTTP (serveur non testé).

---

## Arborescence complète

```
shift-pilot-resa-api/
├── src/
│   ├── server.js         (30 lines) ← Transport HTTP, routage
│   └── transfers.js      (21 lines) ← Logique métier, données
├── test/
│   └── transfers.test.js (16 lines) ← Tests unitaires (pas de test HTTP)
├── package.json          (7 lines)  ← Config, dépendances (zéro), scripts
├── README.md             (8 lines)  ← Description du projet
└── .onboarding/
    ├── workflows/        ← Audit des workflows (amont)
    ├── audits/           ← Audits complets (amont)
    └── (documents de synthèse ← YOU ARE HERE)
```

---

## Modules Node.js utilisés

- `node:http` — `http.createServer()` (`server.js:1`) pour écouter le port HTTP.
- `node:url` — `URL` constructor (`server.js:2`) pour parser les URLs de requête.
- `node:test` — test runner natif (`package.json:6`, `test/transfers.test.js:1`).
- `node:assert/strict` — assertions strictes (`test/transfers.test.js:2`).

**Zéro dépendance externe** (`package.json:7` vide).

---

## Bonnes pratiques et anti-patterns

### Bonnes pratiques observées
- Séparation transport/domaine claire.
- Fonctions pures (logique métier sans I/O ni state mutation).
- Guard `require.main === module` → testabilité par construction.
- Centralization de `sendJson` (une seule source de vérité pour la sérialisation HTTP).

### Anti-patterns visibles
- **Routing inline** : `if/else` dans le handler (`server.js:13-23`). Non scalable.
- **Pas de copie défensive** : `listTransfers()` expose la référence interne.
- **Aucune validation de schéma** : le contrat des objets `transfer` est implicite.
- **Pas de error handling** : URL parsing, requête malformée → crash du process.

---

## Évolutions prévisibles et points d'accroche

### Ajout d'un endpoint de réservation
Requiert :
1. Modifier `server.js` pour router `POST /bookings` (ou autre).
2. Créer une nouvelle fonction métier qui incrémente `sold` (`seatsLeft` en dépend déjà).
3. **Critique** : décider si `sold` est muté en mémoire ou via une BD/cache externe.
4. Importer et utiliser `isFull` pour bloquer les réservations sur transferts saturés.
5. Ajouter tests HTTP pour la réservation.

### Passage en base de données
Requiert :
1. Remplacer le tableau littéral `transfers` par un appel DB.
2. Possiblement ajouter un pool de connexion/cache.
3. Adapter `listTransfers()` pour retourner une promesse (changement d'API).
4. Ré-examiner le risque de référence mutable (moins critique si BD read-only).

### Ajout d'authentification
Requiert :
1. Middleware ou guard pour vérifier un token/session avant chaque endpoint mutable.
2. Laisser `GET /transfers` public ou restreindre aussi (à décider).

---

## Confiance et vérification

- **Code source** : 100% relu ligne à ligne.
- **Workflows** : 2 workflows couvrent les cas d'usage (LISTE_TRANSFERTS, CALCUL_DISPONIBILITE).
- **Audits** : 6 audits complets (FUNCTIONAL, ARCHITECTURE, DATA_MODEL, SECURITY, CODE_HOTSPOTS, TESTING).
- **Cohérence** : aucune divergence entre code et documentation observée.

**Résultat** : Vue technique exhaustive et fiable pour naviguer le codebase et le modifier en toute confiance.
