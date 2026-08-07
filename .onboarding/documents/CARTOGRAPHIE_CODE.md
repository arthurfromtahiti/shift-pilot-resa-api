# CARTOGRAPHIE CODE — shift-pilot-resa-api

> Mis à jour : 2026-08-06 (ajout cancelReservation, DELETE route, registre Map de réservations)

## Arborescence et fichiers clés

```
shift-pilot-resa-api/
├── src/
│   ├── server.js       ← Endpoints HTTP (GET /transfers, POST /transfers/:id/reserve)
│   └── transfers.js    ← Logique domaine (transferts, disponibilité, réservation)
├── test/
│   └── server.test.js  ← Tests d'intégration HTTP
├── package.json        ← Configuration (node:test natif, pas de dépendances)
├── README.md           ← Quickstart local
├── documents/
│   └── ECOSYSTEME.md   ← Dépendances avec frontend
└── .onboarding/        ← Artefacts de documentation (this folder)
    ├── domaines/CARTE_DES_DOMAINES.md
    ├── workflows/WORKFLOW_*.md
    └── documents/CARTOGRAPHIE_CODE.md (this file)
```

---

## src/transfers.js — Module de domaine

**Rôle** : logique métier pure (manipulation catalogue, calcul disponibilité, réservation, annulation)  
**Imports** : `node:crypto` (randomUUID)  
**Exports** : { listTransfers, seatsLeft, isFull, bookSeats, cancelReservation }

### Structuration

```javascript
// Imports
const { randomUUID } = require("node:crypto");

// Data
const transfers = [ ... ]     // Catalogue hard-codé
const reservations = new Map() // Registre des réservations [NEW]

// Public API
function listTransfers() { ... }        // Ligne 13-15
function seatsLeft(transfer) { ... }    // Ligne 17-19
function isFull(transfer) { ... }       // Ligne 21-23
function bookSeats(...) { ... }         // Ligne 25-34 [UPDATED - retourne reservationId]
function cancelReservation(...) { ... } // Ligne 36-43 [NEW]

module.exports = { ... }
```

### Détail des fonctions

#### listTransfers() — Ligne 13-15
```javascript
function listTransfers() {
  return transfers;
}
```
- **Entrée** : aucune
- **Sortie** : transfer[] (référence directe au tableau)
- **Side-effect** : non
- **Usage** : appelée par server.js:15 (endpoint GET /transfers)

#### seatsLeft(transfer) — Ligne 17-19
```javascript
function seatsLeft(transfer) {
  return transfer.seats - transfer.sold;
}
```
- **Entrée** : transfer (objet du catalogue)
- **Sortie** : number (places restantes)
- **Calcul** : `seats (capacité totale) - sold (réservées)`
- **Side-effect** : non
- **Usage** : appelée par server.js:21 (projection GET /transfers), bookSeats:29 (validation)

#### isFull(transfer) — Ligne 21-23
```javascript
function isFull(transfer) {
  return seatsLeft(transfer) === 0;
}
```
- **Entrée** : transfer
- **Sortie** : boolean
- **Sémantique** : prédicat « transfert complet »
- **Side-effect** : non
- **Usage** : importée et utilisée dans server.js:15 — filtrage optionnel `GET /transfers?available=true` ([SHIAAAAAAAAAAAAAAAAAAAAAAAA-408])

#### bookSeats(transferId, seats=1) — Ligne 25-34 [UPDATED SHIAAAAAAAAAAAAAAAAAAAAAAAA-353]
```javascript
function bookSeats(transferId, seats = 1) {
  if (!Number.isInteger(seats) || seats < 1) return { ok: false, reason: "invalid_seats" };
  const transfer = transfers.find((t) => t.id === transferId);
  if (!transfer) return { ok: false, reason: "not_found" };
  if (seatsLeft(transfer) < seats) return { ok: false, reason: "full" };
  transfer.sold += seats;
  const reservationId = randomUUID();
  reservations.set(reservationId, { transferId, seats });
  return { ok: true, reservationId, seatsLeft: seatsLeft(transfer) };
}
```
- **Entrée** :
  - `transferId` : number (ID à rechercher)
  - `seats` : number (places à réserver, défaut 1)
- **Sortie** : 
  ```
  { ok: true, reservationId: string, seatsLeft: number }      // Succès
  { ok: false, reason: "invalid_seats" }                     // Validation échouée
  { ok: false, reason: "not_found" }                         // Transfert inexistant
  { ok: false, reason: "full" }                              // Insuffisamment de places
  ```
- **Logique** :
  1. Valide que seats est un entier positif (ligne 26) — **[NEW]**
  2. Recherche transfert par ID (ligne 27)
  3. Retourne erreur si NOT FOUND (ligne 28)
  4. Calcul places libres via `seatsLeft()` (ligne 29)
  5. Retourne erreur si insuffisant (ligne 29)
  6. Mute `transfer.sold` (ligne 30) — **SIDE-EFFECT INTENTIONNEL**
  7. Génère `reservationId` via `randomUUID()` (ligne 31) — **[NEW]**
  8. Enregistre la réservation dans la Map `reservations[reservationId] = { transferId, seats }` (ligne 32) — **[NEW]**
  9. Retourne succès avec `reservationId` et places restantes (ligne 33) — **[UPDATED]**
- **Side-effect** : 
  - MÀJ `transfer.sold += seats` (mutation globale)
  - Ajout entrée dans `reservations` Map (permet annulation ultérieure)
- **Usage** : appelée par server.js:42 (endpoint POST /transfers/:id/reserve)
- **Validation** : `seats > 0` et `Number.isInteger(seats)` (rejet si zéro ou négatif)

#### cancelReservation(reservationId, transferId) — Ligne 36-44 [NEW SHIAAAAAAAAAAAAAAAAAAAAAAAA-353, UPDATED SHIA-396]
```javascript
function cancelReservation(reservationId, transferId) {
  const reservation = reservations.get(reservationId);
  if (!reservation) return { ok: false, reason: "not_found" };
  if (reservation.transferId !== transferId) return { ok: false, reason: "not_found" };
  const transfer = transfers.find((t) => t.id === reservation.transferId);
  transfer.sold -= reservation.seats;
  reservations.delete(reservationId);
  return { ok: true, seatsLeft: seatsLeft(transfer) };
}
```
- **Entrée** :
  - `reservationId` : string (UUID de la réservation à annuler)
  - `transferId` : number (ID du transfert, pour validation de cohérence)
- **Sortie** :
  ```
  { ok: true, seatsLeft: number }      // Annulation réussie
  { ok: false, reason: "not_found" }   // Réservation inexistante OU transferId incohérent
  ```
- **Logique** :
  1. Recherche réservation dans la Map (line 37)
  2. Retourne erreur si NOT FOUND (line 38)
  3. **Valide cohérence** : vérifie que `reservation.transferId === transferId` (line 39) — **[SHIA-396]** rejette si incohérent
  4. Récupère le transfert associé (line 40)
  5. Libère les places : `transfer.sold -= reservation.seats` (line 41) — **INVERSE de bookSeats**
  6. Supprime l'entrée de la Map (line 42)
  7. Retourne succès avec places restantes après libération (line 43)
- **Side-effect** :
  - MÀJ `transfer.sold -= reservation.seats` (restaure l'état)
  - Suppression entrée dans `reservations` Map
- **Usage** : appelée par server.js:54 (endpoint DELETE /transfers/:id/reservations/:reservationId)
- **Sémantique** : opération inverse et réversible de `bookSeats()` ; la garde transferId empêche l'annulation d'une réservation via un mauvais transfert

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
const { listTransfers, seatsLeft, bookSeats, cancelReservation } = require("./transfers");  // [UPDATED]

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
const { listTransfers, seatsLeft, isFull, bookSeats, cancelReservation } = require("./transfers");
```
- Importe 5 fonctions du module transfers
  - `listTransfers`, `seatsLeft`, `isFull` : lecture, calcul disponibilité et filtrage (ajout SHIAAAAAAAAAAAAAAAAAAAAAAAA-408)
  - `bookSeats` : réservation (ajout SHIAAAAAAAAAAAAAAAAAAAAAAAA-61)
  - `cancelReservation` : annulation (ajout SHIAAAAAAAAAAAAAAAAAAAAAAAA-353)

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
- **Usage** : appelée 8x (GET 200 ligne 16, POST 400 ligne 40, POST 404 ligne 43, POST 409 ligne 44, POST 200 ligne 45, DELETE 404 ligne 55, DELETE 200 ligne 56, catch-all 404 ligne 59)

#### Route : GET /transfers — Ligne 13-23 [UPDATED SHIAAAAAAAAAAAAAAAAAAAAAAAA-408]
```javascript
if (url.pathname === "/transfers" && req.method === "GET") {
  const availableOnly = url.searchParams.get("available") === "true";
  const list = availableOnly ? listTransfers().filter((t) => !isFull(t)) : listTransfers();
  return sendJson(res, 200, list.map((t) => ({
    id: t.id,
    from: t.from,
    to: t.to,
    price: t.price,
    seatsLeft: seatsLeft(t),
  })));
}
```
- **Condition** : exact match "/transfers" + méthode GET
- **Paramètre optionnel** : `?available=true` (défaut : tous les transferts)
- **Traitement** :
  1. Extrait paramètre `available` : `url.searchParams.get("available") === "true"` (ligne 14)
  2. Appel `listTransfers()` → catalogue brut (ligne 15)
  3. Si `available === true` : filtre `.filter(t => !isFull(t))` pour garder seulement les transferts avec places disponibles (ligne 15)
  4. Map projection `{ id, from, to, price, seatsLeft }` (lignes 16-22)
  5. Appel `seatsLeft(t)` pour chaque (calcul in-transit, ligne 21)
  6. Sérialise en JSON + 200
- **Réponse** : toujours 200 (pas d'erreur prévue)
- **Projection masque** : `seats`, `sold` (données internes)
- **Sémantique du filtre** : `isFull()` retourne true quand `seatsLeft === 0`, donc `!isFull()` sélectionne les transferts avec `seatsLeft > 0`

#### Route : POST /transfers/:id/reserve — Ligne 25-48
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
    const seatsValue = seats ?? 1;
    if (!Number.isInteger(seatsValue) || seatsValue < 1) {
      return sendJson(res, 400, { error: "seats must be a positive integer" });
    }
    const result = bookSeats(id, seatsValue);
    if (result.reason === "not_found") return sendJson(res, 404, { error: "Transfer not found" });
    if (result.reason === "full") return sendJson(res, 409, { error: "Transfer full" });
    return sendJson(res, 200, { reservationId: result.reservationId, transferId: id, seatsLeft: result.seatsLeft });
  });
  return;
}
```

**Ligne 25 — Regex route** :
```javascript
url.pathname.match(/^\/transfers\/(\d+)\/reserve$/)
```
- Pattern : `/transfers/` + un ou plusieurs chiffres + `/reserve`
- Capture groupe 1 : l'ID (extrait et parsé ligne 27)
- Non-match → dépasse cette branche

**Ligne 27 — Extraction ID** :
```javascript
const id = parseInt(reserveMatch[1], 10);
```
- Radix 10 (décimal explicite)
- Pas de validation `id > 0` (accepte tous les entiers valides)

**Ligne 28-29 — Collection du body** :
```javascript
let body = "";
req.on("data", (chunk) => { body += chunk; });
```
- Streaming : accumule les chunks d'entrée
- Pas de limite taille (vulnérabilité potentielle, OK en pilote)

**Ligne 30-36 — Parsing JSON** :
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
- Validation type effectuée ultérieurement en ligne 39-40 (vérifie `Number.isInteger()` et `seats >= 1`)

**Ligne 42-45 — Appel logique + mapping réponse** :
```javascript
  const result = bookSeats(id, seatsValue);
  if (result.reason === "not_found") return sendJson(res, 404, { error: "Transfer not found" });
  if (result.reason === "full") return sendJson(res, 409, { error: "Transfer full" });
  return sendJson(res, 200, { reservationId: result.reservationId, transferId: id, seatsLeft: result.seatsLeft });
```
- Applique défaut `seats ?? 1` (nullish coalescing, ligne 38)
- Mappe réponse logique → HTTP :
  - `reason: "not_found"` → 404
  - `reason: "full"` → 409
  - `ok: true` → 200 **avec `reservationId` dans le corps** [UPDATED]
- Gestion `reason: "invalid_seats"` effectuée en ligne 39-40 avant appel à bookSeats (validation supplémentaire au niveau HTTP)

**Ligne 47 — Termina** :
```javascript
  return;
}
```
- Termine précocement après avoir écrit la réponse (évite de continuer après)

#### Route : DELETE /transfers/:id/reservations/:reservationId — Ligne 50-57 [NEW SHIAAAAAAAAAAAAAAAAAAAAAAAA-353, UPDATED SHIA-396]
```javascript
const cancelMatch = url.pathname.match(/^\/transfers\/(\d+)\/reservations\/([^/]+)$/);
if (cancelMatch && req.method === "DELETE") {
  const transferId = parseInt(cancelMatch[1], 10);
  const reservationId = cancelMatch[2];
  const result = cancelReservation(reservationId, transferId);
  if (!result.ok) return sendJson(res, 404, { error: "Reservation not found" });
  return sendJson(res, 200, { seatsLeft: result.seatsLeft });
}
```

**Ligne 50 — Regex route** :
```javascript
url.pathname.match(/^\/transfers\/(\d+)\/reservations\/([^/]+)$/)
```
- Pattern : `/transfers/` + chiffres + `/reservations/` + tout ce qui n'est pas `/`
- Capture groupe 1 : ID transfert (extrait et parsé ligne 52)
- Capture groupe 2 : `reservationId` (UUID, extrait ligne 53)
- Non-match → dépasse cette branche

**Ligne 52-53 — Extraction** :
```javascript
const transferId = parseInt(cancelMatch[1], 10);
const reservationId = cancelMatch[2];
```
- `transferId` : groupe 1 parsé en décimal, utilisé pour cohérence [SHIA-396]
- `reservationId` : groupe 2 récupéré directement (chaîne)

**Ligne 54 — Appel métier** :
```javascript
const result = cancelReservation(reservationId, transferId);
```
- Appelle `cancelReservation()` avec **les deux** paramètres
- La fonction valide que la réservation trouvée correspond bien au transferId (ligne 39 de transfers.js)
- Si incohérent, retourne `{ ok: false, reason: "not_found" }` [SHIA-396]

**Ligne 55-56 — Mappage résultat** :
```javascript
if (!result.ok) return sendJson(res, 404, { error: "Reservation not found" });
return sendJson(res, 200, { seatsLeft: result.seatsLeft });
```
- `ok: false` (réservation inexistante OU transferId incohérent) → 404
- `ok: true` → 200 avec `seatsLeft` calculé après libération

**Sémantique** : annule une réservation, libère ses sièges, retourne la disponibilité résultante

#### Route catch-all — Ligne 58
```javascript
sendJson(res, 404, { error: "Not found" });
```
- Toute URL non-match → 404 générique (GET/POST/DELETE non matchées)

#### Serveur et port — Ligne 61-65
```javascript
const PORT = process.env.PORT || 3100;
if (require.main === module) {
  server.listen(PORT, () => console.log(`resa-api on :${PORT}`));
}
module.exports = server;
```
- Écoute sur PORT (env ou 3100)
- Démarrage conditionnel : direct avec `node src/server.js`, silent si require()
- Log simple (pas de timestamp, pas de structuré)
- Export du serveur pour utilisation dans tests

---

## test/server.test.js — Tests d'intégration HTTP

**Rôle** : vérifier que les endpoints HTTP répondent correctement  
**Framework** : node:test (test runner natif Node.js) + http natif  
**Couverture** : tests POST /reserve (SHIAAAAAAAAAAAAAAAAAAAAAAAA-61) et DELETE /reservations (SHIAAAAAAAAAAAAAAAAAAAAAAAA-353)

### Tests ajoutés (SHIAAAAAAAAAAAAAAAAAAAAAAAA-61 & SHIAAAAAAAAAAAAAAAAAAAAAAAA-353)

| Test | Description | Assertion |
|------|-------------|-----------|
| POST 200 | Réservation d'1 place réussit | status 200, body `{ reservationId: <uuid>, transferId: 1, seatsLeft: 27 }` [UPDATED] |
| POST 404 | Transfert inexistant | status 404, error "Transfer not found" |
| POST 409 | Transfert complet | status 409, error "Transfer full" |
| DELETE 200 | Annulation d'une réservation | status 200, body `{ seatsLeft: 28 }` (siège libéré) [NEW] |
| DELETE 404 | Réservation inexistante | status 404, error "Reservation not found" [NEW] |

**Exemple structure** (node:test natif)
```javascript
const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const server = require("../src/server");

function postJson(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(`http://localhost:3100${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.write(payload);
    req.end();
  });
}

test("POST /transfers/1/reserve → 200, seatsLeft diminue de 1", async () => {
  const res = await postJson("/transfers/1/reserve", {});
  assert.equal(res.status, 200);
  assert.equal(res.body.seatsLeft, 27);  // 40 - 12 - 1 = 27
});

test("POST /transfers/999/reserve → 404 inexistant", async () => {
  const res = await postJson("/transfers/999/reserve", {});
  assert.equal(res.status, 404);
  assert.equal(res.body.error, "Transfer not found");
});

test("POST /transfers/2/reserve → 409 complet", async () => {
  const res = await postJson("/transfers/2/reserve", {});
  assert.equal(res.status, 409);
  assert.equal(res.body.error, "Transfer full");
});
```

---

## Dépendances externes

### Modules Node.js natifs
- `http` — serveur HTTP
- `url` — parsing URL
- `node:` prefix — explicit native modules (ES2020+)

### Aucune dépendance projet
- Pas de dépendance de test (node:test et node:assert sont natifs)
- Pas de framework (Express, Fastify)
- Pas de base de données (pas d'ORM, driver DB)
- Pas de validation (pas de Joi, Yup)

---

## Points d'interaction clé

### Registre des réservations — reservations Map
**Location** : transfers.js:11 (`const reservations = new Map()`)  
**Contenu** : `reservationId (string/UUID) → { transferId: number, seats: number }`  
**Mutations** :
  - Ajout par `bookSeats()` (ligne 32)
  - Suppression par `cancelReservation()` (ligne 41)
**Implication** : suivi du cycle de vie d'une réservation (création → éventuellement annulation)

### Mutation d'état : bookSeats → transfer.sold
**Location** : transfers.js:30 (`transfer.sold += seats`)  
**Appelant** : server.js:42 (`bookSeats(id, seatsValue)`)  
**Effet** : modifie catalogue global en mémoire  
**Implication** : GET /transfers suivant verra places réduites immédiatement

### Mutation d'état : cancelReservation → transfer.sold
**Location** : transfers.js:41 (`transfer.sold -= reservation.seats`)  
**Appelant** : server.js:54 (`cancelReservation(reservationId, transferId)`)  
**Effet** : inverse la mutation de bookSeats, libère places  
**Implication** : GET /transfers suivant verra places restaurées immédiatement

### Calcul de disponibilité : seatsLeft
**Appelants** :
1. server.js:21 — projection GET /transfers
2. transfers.js:29 — validation bookSeats
3. transfers.js:33 — retour réservation
4. transfers.js:43 — retour annulation

**Formule** : `seats - sold` (toujours cohérent si seul bookSeats/cancelReservation mutent)

### Projection GET /transfers
**Masque** : `seats`, `sold` (détails internes)  
**Expose** : `id`, `from`, `to`, `price`, `seatsLeft`  
**Note** : divergence avec frontend qui s'attend à `availableSeats` (voir ECOSYSTEME.md)

---

## Chemins critiques et validations

### Validation dans bookSeats (transferts.js:26)
✓ Transfert exists (par ID)  
✓ Enough seats (seatsLeft ≥ N)  
✓ Seats > 0 et Number.isInteger() (validé ligne 26)  
✓ Validation supplémentaire au niveau HTTP (server.js:39-40 double-vérifie)

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
