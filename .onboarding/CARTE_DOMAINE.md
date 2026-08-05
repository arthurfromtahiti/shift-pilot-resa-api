# CARTE DOMAINE — shift-pilot-resa-api

> Confiance : medium | Mise à jour : 2026-08-05 (ajout POST /transfers/:id/reserve)

## Vue d'ensemble

API backend Node.js minimaliste exposant un catalogue de transferts inter-îles avec calcul de disponibilité et **réservation (NEW)** en temps réel.

**Domaine métier covert** : gestion de transferts (affichage disponibilité, réservation de sièges)

**Portée technologique** : 
- Langage : JavaScript (Node.js, sans framework — HTTP natif)
- Serveur : HTTP minimaliste (`http.createServer`)
- Données : données en mémoire (tableau statique + mutations in-memory)
- Tests : Jest + requêtes HTTP d'intégration

---

## Modèle de données

### Transfert (transfer)

Représente un trajet inter-îles avec capacité et réservations en cours.

| Champ | Type | Rôle | Mutabilité |
|-------|------|------|-----------|
| `id` | number | Identifiant unique | Immuable |
| `from` | string | Île de départ | Immuable |
| `to` | string | Île d'arrivée | Immuable |
| `seats` | number | Capacité totale | Immuable (design) |
| `sold` | number | Sièges réservés | **Muté par `bookSeats()`** |
| `price` | number | Tarif (XPF) | Immuable |

**Invariant** : `seatsLeft(transfer) = transfer.seats - transfer.sold ≥ 0` (garanti par `bookSeats()`)

**Catalogue initial** (hard-codé) :
```
1. Papeete → Moorea,  40 sièges (12 vendus) — 3500 XPF
2. Papeete → Bora Bora, 60 sièges (60 vendus) — 21000 XPF
3. Raiatea → Tahaa, 20 sièges (5 vendus) — 1800 XPF
```

---

## Fonctions du domaine

### `listTransfers()`
**Fichier** : `src/transfers.js:9-11`  
**Signature** : `() → transfer[]`  
**Sémantique** : retourne le catalogue brut sans filtrage  
**Mutation** : none

### `seatsLeft(transfer)`
**Fichier** : `src/transfers.js:13-15`  
**Signature** : `(transfer) → number`  
**Sémantique** : calcule le nombre de places libres pour un transfert  
**Calcul** : `transfer.seats - transfer.sold`  
**Mutation** : none

### `isFull(transfer)`
**Fichier** : `src/transfers.js:17-19`  
**Signature** : `(transfer) → boolean`  
**Sémantique** : prédicat « ce transfert est complet »  
**Mutation** : none  
**Usage** : non utilisé actuellement (exporté pour API future)

### `bookSeats(transferId, seats=1)` — **NEW**
**Fichier** : `src/transfers.js:21-27`  
**Signature** : `(transferId: number, seats?: number) → { ok: boolean, reason?: string, seatsLeft?: number }`  
**Sémantique** : reserve N sièges (défaut 1) sur un transfert  
**Effets de bord** : mute `transfer.sold` si réservation acceptée  
**Cas de retour** :
- `{ ok: true, seatsLeft: number }` — réservation acceptée, places restantes
- `{ ok: false, reason: "not_found" }` — transfert n'existe pas
- `{ ok: false, reason: "full" }` — pas assez de places libres

**Validation** : 
- Transfert doit exister (par ID)
- `seatsLeft(transfer) ≥ seats` requis

---

## Endpoints HTTP

### `GET /transfers`
**Implémentation** : `src/server.js:13-21`  
**Méthode** : GET  
**Chemin** : `/transfers`  
**Paramètres** : none  
**Corps de requête** : ignoré  

**Réponse 200** (toujours):
```json
[
  {
    "id": 1,
    "from": "Papeete",
    "to": "Moorea",
    "price": 3500,
    "seatsLeft": 28
  },
  ...
]
```

**Notes** :
- Projection publique (masque `seats`, `sold`)
- **Divergence connue** : le front web consomme `availableSeats`, pas `seatsLeft` (voir ECOSYSTEME.md)

---

### `POST /transfers/:id/reserve` — **NEW (SHIAAAAAAAAAAAAAAAAAAAAAAAA-61)**
**Implémentation** : `src/server.js:23-42`  
**Méthode** : POST  
**Chemin** : `/transfers/{id}/reserve` (id = entier)  
**Paramètres d'URL** : `id` (entier, parsed avec regex)  

**Corps de requête** (JSON, optionnel) :
```json
{
  "seats": 2
}
```
- `seats` : nombre de sièges à réserver (défaut 1 si omis ou invalide)

**Réponse 200** (succès) :
```json
{
  "transferId": 1,
  "seatsLeft": 26
}
```

**Réponse 404** (transfert non trouvé) :
```json
{
  "error": "Transfer not found"
}
```

**Réponse 409** (transfert complet ou pas assez de places) :
```json
{
  "error": "Transfer full"
}
```

**Détails d'implémentation** :
- Parse le corps JSON en `{ seats }` (fallback `{} → seats = undefined`)
- Appelle `bookSeats(id, seats ?? 1)` avec défaut 1
- Mappe `reason: "not_found"` → 404, `reason: "full"` → 409
- Retourne `seatsLeft` issu du résultat de `bookSeats()`

**Test couverture** : 3 tests HTTP dans `test/server.test.js` (200, 404, 409)

---

## Architecture interne

### Séparation des couches
- **Domaine** (`src/transfers.js`) : logique pure, manipulation du catalogue, pas d'HTTP
- **Présentation HTTP** (`src/server.js`) : parsing requête, mappage statut/réponse, pas de logique métier

### Immuabilité des données
- Le catalogue est un tableau mutant in-memory (`const transfers = [...]`)
- Seul `bookSeats()` a le droit de muter (`transfer.sold += seats`)
- Lecture seule partout ailleurs

---

## Flux critiques

### Flux : Consultation du catalogue (GET /transfers)
```
GET /transfers
  ↓ (route matching + GET validation)
listTransfers()
  ↓
map(transfer → { id, from, to, price, seatsLeft(transfer) })
  ↓
JSON.stringify()
  ↓
200 application/json
```

### Flux : Réservation de places (POST /transfers/:id/reserve) — **NEW**
```
POST /transfers/{id}/reserve body={ seats: N }
  ↓ (route matching + POST validation + JSON parse)
bookSeats(id, N ?? 1)
  ↓ (recherche transfer par id)
  ├─ not_found → 404 { error: "Transfer not found" }
  ├─ seatsLeft < seats → 409 { error: "Transfer full" }
  └─ ok → mute transfer.sold, 200 { transferId: id, seatsLeft }
```

---

## Questions ouvertes

1. **Persistance des réservations**  
   Les réservations vivent en mémoire ; process crash = tout réinitialise. OK pour pilote, à revisiter.

2. **Authentification des réservations**  
   Qui peut réserver ? Aucune validation identity/token. Acceptable en pilote de démonstration.

3. **Annulation de réservation**  
   Pas d'endpoint de DELETE/annulation. À implémenter si demande utilisateur.

4. **Contrat asymétrique `seatsLeft` / `availableSeats`**  
   GET /transfers retourne `seatsLeft` ; le front web s'attend à `availableSeats`. À harmoniser.

5. **Robustesse du parsing JSON**  
   Le JSON malformé est silencieusement ignoré (fallback `seats = undefined`). Correct ou log d'erreur?

---

## Références

- **Code** : `src/transfers.js`, `src/server.js`
- **Tests** : `test/server.test.js` (ajout 3 cas POST /transfers/:id/reserve)
- **Contexte projet** : voir `documents/ECOSYSTEME.md` pour les dépendances avec le front
