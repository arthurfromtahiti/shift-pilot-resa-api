# CARTOGRAPHIE CODE — shift-pilot-resa-api

> Mis à jour : 2026-08-05 (ajout bookSeats, POST /transfers/:id/reserve)

## Arborescence et fichiers clés

```
shift-pilot-resa-api/
├── src/
│   ├── server.js       ← Endpoints HTTP (GET /transfers, POST /transfers/:id/reserve)
│   └── transfers.js    ← Logique domaine (transferts, disponibilité, réservation)
├── test/
│   └── server.test.js  ← Tests d'intégration HTTP
├── package.json        ← Dépendances (Jest, test runner)
├── README.md           ← Quickstart local
├── documents/
│   └── ECOSYSTEME.md   ← Dépendances avec frontend
└── .onboarding/        ← Artefacts de documentation (this folder)
    ├── CARTE_DOMAINE.md
    ├── WORKFLOWS.md
    └── CARTOGRAPHIE_CODE.md (this file)
```

---

## src/transfers.js — Module de domaine

**Rôle** : logique métier pure (manipulation catalogue, calcul disponibilité, réservation)  
**Imports** : aucun  
**Exports** : { listTransfers, seatsLeft, isFull, bookSeats }

### Structuration

```javascript
// Data
const transfers = [ ... ]   // Catalogue hard-codé

// Public API
function listTransfers() { ... }     // Ligne 9-11
function seatsLeft(transfer) { ... } // Ligne 13-15
function isFull(transfer) { ... }    // Ligne 17-19
function bookSeats(...) { ... }      // Ligne 21-27 [NEW]

module.exports = { ... }
```

### Détail des fonctions

#### listTransfers() — Ligne 9-11
```javascript
function listTransfers() {
  return transfers;
}
```
- **Entrée** : aucune
- **Sortie** : transfer[] (référence directe au tableau)
- **Side-effect** : non
- **Usage** : appelée par server.js:14 (endpoint GET /transfers)

#### seatsLeft(transfer) — Ligne 13-15
```javascript
function seatsLeft(transfer) {
  return transfer.seats - transfer.sold;
}
```
- **Entrée** : transfer (objet du catalogue)
- **Sortie** : number (places restantes)
- **Calcul** : `seats (capacité totale) - sold (réservées)`
- **Side-effect** : non
- **Usage** : appelée par server.js:19 (projection GET /transfers), bookSeats:24 (validation)

#### isFull(transfer) — Ligne 17-19
```javascript
function isFull(transfer) {
  return seatsLeft(transfer) === 0;
}
```
- **Entrée** : transfer
- **Sortie** : boolean
- **Sémantique** : prédicat « transfert complet »
- **Side-effect** : non
- **Usage** : **aucun actuellement** (exporté pour future API, non appelé)

#### bookSeats(transferId, seats=1) — Ligne 21-27 [NEW SHIAAAAAAAAAAAAAAAAAAAAAAAA-61]
```javascript
function bookSeats(transferId, seats = 1) {
  const transfer = transfers.find((t) => t.id === transferId);
  if (!transfer) return { ok: false, reason: "not_found" };
  if (seatsLeft(transfer) < seats) return { ok: false, reason: "full" };
  transfer.sold += seats;
  return { ok: true, seatsLeft: seatsLeft(transfer) };
}
```
- **Entrée** :
  - `transferId` : number (ID à rechercher)
  - `seats` : number (places à réserver, défaut 1)
- **Sortie** : 
  ```
  { ok: true, seatsLeft: number }      // Succès
  { ok: false, reason: "not_found" }   // Transfert inexistant
  { ok: false, reason: "full" }        // Insuffisamment de places
  ```
- **Logique** :
  1. Recherche transfert par ID (line 22)
  2. Retourne erreur si NOT FOUND (line 23)
  3. Calcul places libres via `seatsLeft()` (line 24)
  4. Retourne erreur si insuffisant (line 24)
  5. Mute `transfer.sold` (line 25) — **SIDE-EFFECT INTENTIONNEL**
  6. Retourne succès avec places restantes (line 26)
- **Side-effect** : MÀJ `transfer.sold += seats` (mutation globale, pas réversible)
- **Usage** : appelée par server.js:36 (endpoint POST /transfers/:id/reserve)
- **Sécurité** : pas de validation seats ≤ 0 (comportement défini : aucun contrôle)

### Données — Catalogue initial

```javascript
const transfers = [
  { id: 1, from: "Papeete", to: "Moorea", seats: 40, sold: 12, price: 3500 },
  { id: 2, from: "Papeete", to: "Bora Bora", seats: 60, sold: 60, price: 21000 },
  { id: 3, from: "Raiatea", to: "Tahaa", seats: 20, sold: 5, price: 1800 },
];
```

**Propriétés** :
- **Immuabilité** : tableau assigné une fois, jamais réassigné
- **Mutation** : objets internes mutables (seats.sold changé par bookSeats)
- **Scalabilité** : données hard-codées, pas de chargement externe
- **Persistance** : en mémoire, perte au restart

---

## src/server.js — Layer HTTP/Présentation

**Rôle** : parsing HTTP, validation route, mapping réponse, pas de logique métier  
**Imports** : `http`, `URL`, fonctions du module transfers  
**Port** : 3100 (env.PORT ou défaut)

### Structuration

```javascript
// Imports
const http = require("node:http");
const { URL } = require("node:url");
const { listTransfers, seatsLeft, bookSeats } = require("./transfers");  // [UPDATED]

// Helper
function sendJson(res, status, body) { ... }  // Ligne 5-8

// Serveur
const server = http.createServer((req, res) => { ... });  // Ligne 10-45

// Export
module.exports = server;
```

### Détail des sections

#### Imports — Ligne 1-3
```javascript
const { listTransfers, seatsLeft, bookSeats } = require("./transfers");
```
- Importe 4 fonctions du module transfers (bookSeats ajouté en SHIAAAAAAAAAAAAAAAAAAAAAAAA-61)
- isFull non importée (non utilisée)

#### Helper sendJson() — Ligne 5-8
```javascript
function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}
```
- **Entrée** : réponse HTTP, statut, objet JS
- **Sortie** : écrit en réponse HTTP
- **Rôle** : factoriser Content-Type + sérialisation JSON
- **Usage** : appelée 4x (GET 200, POST 200, POST 404, POST 409)

#### Route : GET /transfers — Ligne 13-21
```javascript
if (url.pathname === "/transfers" && req.method === "GET") {
  return sendJson(res, 200, listTransfers().map((t) => ({
    id: t.id,
    from: t.from,
    to: t.to,
    price: t.price,
    seatsLeft: seatsLeft(t),
  })));
}
```
- **Condition** : exact match "/" + méthode GET
- **Traitement** :
  1. Appel `listTransfers()` → catalogue brut
  2. Map projection `{ id, from, to, price, seatsLeft }`
  3. Appel `seatsLeft(t)` pour chaque (calcul in-transit)
  4. Sérialise en JSON + 200
- **Réponse** : toujours 200 (pas d'erreur prévue)
- **Projection masque** : `seats`, `sold` (données internes)

#### Route : POST /transfers/:id/reserve — Ligne 23-42 [NEW]
```javascript
const reserveMatch = url.pathname.match(/^\/transfers\/(\d+)\/reserve$/);
if (reserveMatch && req.method === "POST") {
  const id = parseInt(reserveMatch[1], 10);
  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => {
    let seats;
    try {
      const parsed = body ? JSON.parse(body) : {};
      seats = parsed.seats;
    } catch {
      seats = undefined;
    }
    const result = bookSeats(id, seats ?? 1);
    if (result.reason === "not_found") return sendJson(res, 404, { error: "Transfer not found" });
    if (result.reason === "full") return sendJson(res, 409, { error: "Transfer full" });
    return sendJson(res, 200, { transferId: id, seatsLeft: result.seatsLeft });
  });
  return;
}
```

**Ligne 23 — Regex route** :
```javascript
url.pathname.match(/^\/transfers\/(\d+)\/reserve$/)
```
- Pattern : `/transfers/` + un ou plusieurs chiffres + `/reserve`
- Capture groupe 1 : l'ID (extrait et parsé ligne 25)
- Non-match → dépasse cette branche

**Ligne 24-25 — Extraction ID** :
```javascript
const id = parseInt(reserveMatch[1], 10);
```
- Radix 10 (décimal explicite)
- Pas de validation `id > 0` (accepte tous les entiers valides)

**Ligne 26-27 — Collection du body** :
```javascript
let body = "";
req.on("data", (chunk) => { body += chunk; });
```
- Streaming : accumule les chunks d'entrée
- Pas de limite taille (vulnérabilité potentielle, OK en pilote)

**Ligne 28-34 — Parsing JSON** :
```javascript
req.on("end", () => {
  let seats;
  try {
    const parsed = body ? JSON.parse(body) : {};
    seats = parsed.seats;
  } catch {
    seats = undefined;
  }
```
- Corps vide → `{}` (fallback)
- JSON invalide → exception capturée, `seats = undefined`
- `seats = parsed.seats` (peut être `undefined` si absent ou non-nombre)
- Pas de validation type (seats accepte `true`, `"hello"`, etc.)

**Ligne 35-39 — Appel logique + mapping réponse** :
```javascript
  const result = bookSeats(id, seats ?? 1);
  if (result.reason === "not_found") return sendJson(res, 404, { error: "Transfer not found" });
  if (result.reason === "full") return sendJson(res, 409, { error: "Transfer full" });
  return sendJson(res, 200, { transferId: id, seatsLeft: result.seatsLeft });
```
- Applique défaut `seats ?? 1` (nullish coalescing)
- Mappe réponse logique → HTTP :
  - `reason: "not_found"` → 404
  - `reason: "full"` → 409
  - `ok: true` → 200
- Pas de gestion `reason: undefined` (cas ok:false sans reason, ne se produit pas actuellement)

**Ligne 41 — Termina** :
```javascript
  return;
}
```
- Termine précocement après avoir écrit la réponse (évite de continuer après)

#### Route catch-all — Ligne 44
```javascript
sendJson(res, 404, { error: "Not found" });
```
- Toute URL non-match → 404 générique
- Pas de différenciation GET vs POST non matchées

#### Serveur et port — Ligne 47-50
```javascript
const PORT = process.env.PORT || 3100;
if (require.main === module) {
  server.listen(PORT, () => console.log(`resa-api on :${PORT}`));
}
```
- Écoute sur PORT (env ou 3100)
- Démarrage conditionnel : direct avec `node src/server.js`, silent si require()
- Log simple (pas de timestamp, pas de structuré)

---

## test/server.test.js — Tests d'intégration HTTP

**Rôle** : vérifier que les endpoints HTTP répondent correctement  
**Framework** : Jest + HTTP natif  
**Couverture** : 3 cas nouveaux (SHIAAAAAAAAAAAAAAAAAAAAAAAA-61)

### Tests ajoutés

| Test | Description | Assertion |
|------|-------------|-----------|
| POST 200 | Réservation de 2 places réussit | status 200, body { transferId: 1, seatsLeft: 26 } |
| POST 404 | Transfert inexistant | status 404, error "Transfer not found" |
| POST 409 | Transfert complet | status 409, error "Transfer full" |

**Exemple structure** (pseudo-code)
```javascript
describe('POST /transfers/:id/reserve', () => {
  test('reserves seats successfully', async () => {
    const res = await request(server)
      .post('/transfers/1/reserve')
      .send({ seats: 2 });
    expect(res.status).toBe(200);
    expect(res.body.seatsLeft).toBe(26);  // 28 - 2
  });

  test('returns 404 for nonexistent transfer', async () => {
    const res = await request(server)
      .post('/transfers/999/reserve')
      .send({ seats: 1 });
    expect(res.status).toBe(404);
  });

  test('returns 409 for full transfer', async () => {
    const res = await request(server)
      .post('/transfers/2/reserve')  // Transfert 2 = 60/60, sold
      .send({ seats: 1 });
    expect(res.status).toBe(409);
  });
});
```

---

## Dépendances externes

### Modules Node.js natifs
- `http` — serveur HTTP
- `url` — parsing URL
- `node:` prefix — explicit native modules (ES2020+)

### Dépendances projet
```json
{
  "devDependencies": {
    "jest": "*",
    "supertest": "*"
  }
}
```
- **Jest** : test runner
- **Supertest** : helper HTTP requests dans les tests

### Aucune dépendance métier
- Pas de framework (Express, Fastify)
- Pas de base de données (pas d'ORM, driver DB)
- Pas de validation (pas de Joi, Yup)

---

## Points d'interaction clé

### Mutation d'état : bookSeats → transfer.sold
**Location** : transfers.js:25 (`transfer.sold += seats`)  
**Appelant** : server.js:36 (`bookSeats(id, seats ?? 1)`)  
**Effet** : modifie catalogue global en mémoire  
**Implication** : GET /transfers suivant verra places réduites immédiatement

### Calcul de disponibilité : seatsLeft
**Appelants** :
1. server.js:19 — projection GET /transfers
2. transfers.js:24 — validation bookSeats
3. transfers.js:26 — retour réservation

**Formule** : `seats - sold` (toujours cohérent si seul bookSeats mute)

### Projection GET /transfers
**Masque** : `seats`, `sold` (détails internes)  
**Expose** : `id`, `from`, `to`, `price`, `seatsLeft`  
**Note** : divergence avec frontend qui s'attend à `availableSeats` (voir ECOSYSTEME.md)

---

## Chemins critiques et validations

### Validation dans bookSeats
✓ Transfert exists (par ID)  
✓ Enough seats (seatsLeft ≥ N)  
✗ No check `seats > 0` (accepte zéro, nombres négatifs)  
✗ No check `seats` est nombre (accepte `undefined` → défaut 1)

### Validation dans server.js
✓ Route regex (valide ID format)  
✓ JSON parse (try/catch)  
✗ No Content-Length check (upload illimité possible)  
✗ No charset validation (accepte UTF-8 + autres)  
✗ No auth/permission (tout le monde peut réserver)

---

## Références

- **Full code** : src/transfers.js, src/server.js, test/server.test.js
- **Imports/Exports** : module.exports en fin de chaque fichier
- **Workflows** : voir WORKFLOWS.md
- **Domaine** : voir CARTE_DOMAINE.md
