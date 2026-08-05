# WORKFLOWS — shift-pilot-resa-api

> Mis à jour : 2026-08-05 (ajout workflow réservation)

## Workflow 1 : Consultation du catalogue (GET /transfers)

**Acteurs** : Voyageur (utilisateur final) → Frontend Web → API Backend  
**Cas d'usage** : Afficher la liste des transferts disponibles avec tarifs et places  
**Criticité** : HAUTE (seul cas d'usage actuel au lancement)

### Déroulement

```
┌─ Voyageur accède index.html du frontend
│
├─ Frontend charge js/app.js
│  ├─ Configure URL API (window.API_BASE_URL ou fallback localhost:3100)
│  └─ Attach listener DOMContentLoaded
│
├─ DOM prêt, exécute fetch(API_BASE_URL + '/transfers')
│
├─ API backend reçoit GET /transfers
│  ├─ Route match /transfers + méthode GET ✓
│  ├─ Appel listTransfers() → catalogue brut
│  ├─ Map chaque transfer → { id, from, to, price, seatsLeft }
│  │  (appel seatsLeft(transfer) pour chaque)
│  └─ JSON.stringify + Content-Type application/json
│
├─ Retourne 200 + body JSON
│
├─ Frontend désérialise la réponse
│
├─ Boucle sur transfers[], crée <li> pour chaque
│  └─ Affichage : "Papeete → Moorea — 3500 XPF (28 places)"
│
└─ Voyageur lit la liste à l'écran
```

### États et transitions

| Étape | État | Notes |
|-------|------|-------|
| Frontend bootup | Idle | js/app.js chargé, listener prêt |
| Après DOMContentLoaded | Fetching | fetch() lancé, aucune réponse encore |
| API traite requête | Processing | listTransfers() en cours |
| Avant JSON.stringify | Serialized | Tableau d'objets prêt |
| Réponse envoyée | Done (200 OK) | Frontend peut désérialiser |
| Rendu DOM | Displayed | Utilisateur voit la liste |

### Points critiques

- **Risque : URL API injoignable**  
  Si `window.API_BASE_URL` mal configuré ou API down, `fetch()` rejette — frontend n'a pas de `try/catch`, utilisateur voit liste vide.  
  **Impact** : confusion avec catalogue réellement vide.

- **Risque : Divergence noms de champs**  
  API retourne `seatsLeft` ; frontend s'attend à `availableSeats`.  
  **Impact** : places affichées comme `undefined` (divergence confirmée, voir ECOSYSTEME.md).

- **Risque : JSON invalide/incomplet**  
  Si API retourne objet au lieu de tableau, ou Nullité, réaction `frontend` n'est pas définie (pas de `Array.isArray()` check).

### Conditions de succès

✓ API en ligne et répond  
✓ Format JSON respecté : tableau d'objets avec `{ id, from, to, price, seatsLeft }`  
✓ Frontend désérialise sans erreur  
✓ Utilisateur voit au moins : origines, destinations, prix

---

## Workflow 2 : Réservation de places (POST /transfers/:id/reserve) — **NEW**

**Acteurs** : Voyageur → Frontend Web (formulaire) → API Backend  
**Cas d'usage** : Réserver N sièges sur un transfert spécifique  
**Criticité** : HAUTE (cas d'usage principal, new in 2026-08-05)  
**Statut implémentation** : ✓ Complet (épique SHIAAAAAAAAAAAAAAAAAAAAAAAA-60, PR SHIAAAAAAAAAAAAAAAAAAAAAAAA-61 merged)

### Déroulement

```
┌─ Voyageur accède la page de réservation (frontend)
│  (Implémentation : TODO, pas encore dans le code du frontend)
│
├─ Saisit le nombre de places (défaut 1 si non spécifié)
│
├─ Clique "Réserver"
│
├─ Frontend prépare POST /transfers/{id}/reserve body={ seats: N }
│  (où id = ID du transfert sélectionné, N = nombre de places)
│
├─ API backend reçoit POST
│  ├─ Route match /transfers/{id}/reserve + POST ✓
│  ├─ Parse ID depuis URL (parseInt regex)
│  ├─ Parse JSON body (fallback vide si malformé)
│  ├─ Extrait seats de { seats: N } (fallback 1 si absent/invalide)
│  │
│  ├─ Appel bookSeats(id, seats)
│  │  ├─ Recherche transfer par id
│  │  │  ├─ NOT FOUND → { ok: false, reason: "not_found" }
│  │  │  └─ FOUND
│  │  │      ├─ Calcul seatsLeft = transfer.seats - transfer.sold
│  │  │      ├─ Check seatsLeft ≥ seats
│  │  │      │  ├─ Insuffisant → { ok: false, reason: "full" }
│  │  │      │  └─ Suffisant → Mute transfer.sold += seats
│  │  │      │              → { ok: true, seatsLeft: newSeatsLeft }
│  │
│  ├─ Mappe réponse logique → statut HTTP + body JSON
│  │  ├─ reason: "not_found" → 404 { error: "Transfer not found" }
│  │  ├─ reason: "full" → 409 { error: "Transfer full" }
│  │  └─ ok: true → 200 { transferId: id, seatsLeft: newSeatsLeft }
│  │
│  └─ Envoie réponse
│
├─ Frontend reçoit réponse HTTP
│
├─ Selon statut :
│  ├─ 200 (succès)
│  │  ├─ Affiche "Réservation confirmée, places restantes : X"
│  │  ├─ Miseà jour liste (optionnel : rafraîchir GET /transfers)
│  │  └─ Redirection confirmation
│  │
│  ├─ 404 (transfert inexistant)
│  │  └─ Affiche "Transfert non trouvé"
│  │
│  └─ 409 (complet)
│      └─ Affiche "Pas assez de places disponibles"
│
└─ Voyageur informe du résultat
```

### États de données

**Avant réservation** (Transfert 1, Papeete → Moorea) :
```
{
  id: 1,
  from: "Papeete",
  to: "Moorea",
  seats: 40,
  sold: 12,          ← avant
  price: 3500
}
seatsLeft = 40 - 12 = 28
```

**Après réservation de 2 sièges** :
```
{
  id: 1,
  from: "Papeete",
  to: "Moorea",
  seats: 40,
  sold: 14,          ← après (12 + 2)
  price: 3500
}
seatsLeft = 40 - 14 = 26
```

### Scénarios de test

| ID | Cas | Input | Expected Output | Status |
|----|----|-------|-----------------|--------|
| T1 | Réservation réussie | POST /transfers/1/reserve body={ seats: 2 } | 200 { transferId: 1, seatsLeft: 26 } | ✓ |
| T2 | Transfert inexistant | POST /transfers/999/reserve body={ seats: 1 } | 404 { error: "Transfer not found" } | ✓ |
| T3 | Transfert complet | POST /transfers/2/reserve body={ seats: 1 } | 409 { error: "Transfer full" } | ✓ |
| T4 | Réservation sans body JSON | POST /transfers/1/reserve body=`` | 200 (seats=1 par défaut) | ✓ |
| T5 | Réservation malformée | POST /transfers/1/reserve body=`{xyz}` | 200 (seats=1 par défaut) | ✓ |

Tous les cas T1-T5 sont couverts par `test/server.test.js` (SHIAAAAAAAAAAAAAAAAAAAAAAAA-61).

### Points critiques

- **Mutation d'état global**  
  `bookSeats()` mute `transfer.sold` directement. Pas de transaction, pas de rollback.  
  **Impact** : si deux requêtes concurrent demandent le dernier siège, les deux peuvent le réserver (race condition).  
  **Mitigation en pilote** : acceptable (traffic faible, test single-thread), à revisiter en production.

- **Persistance en mémoire**  
  Process crash → perte de toutes les réservations.  
  **Impact** : données non durables.  
  **Mitigation** : OK pour pilote de démonstration, database requise après.

- **Pas d'authentification**  
  Tout le monde peut réserver, plusieurs fois, sans identité.  
  **Impact** : abuse possible (même voyageur réserve tous les sièges).  
  **Mitigation** : OK pour pilote, ajouter auth + quotas après.

- **Pas de confirmation asynchrone**  
  Réservation immédiate, pas de mail/SMS.  
  **Impact** : utilisateur ignore si réservation "vraiment" prise.  
  **Mitigation** : OK pour pilote, notification asynchrone requise après.

---

## Interactions entre workflows

**Séquence typique utilisateur** :

```
1. Consultation (GET /transfers) — "Quels sont les transferts disponibles?"
   └─ Affichage du catalogue avec places restantes

2. Clic sur un transfert — "Je veux réserver sur celui-là"
   └─ Saisie du nombre de places (si UI à ajouter)

3. Soumission du formulaire → Réservation (POST /transfers/:id/reserve)
   └─ Succès (200) ou erreur (404/409)

4. Confirmation — "Ma réservation est confirmée?"
   └─ Optionnel : rafraîchir catalogue (GET /transfers x2) pour voir places mises à jour
```

**Cohérence observée** :
- Après réservation réussie, `seatsLeft` baisse immédiatement (pas de délai)
- Prochain GET /transfers verra les places réduites (effet immédiat)
- Si frontend cache le résultat, décalage possible entre affichage et réalité

---

## Évolutions futures envisagées

1. **Annulation de réservation**  
   Endpoint DELETE ou POST /transfers/:id/cancel  
   **Impact** : mute transfer.sold à la baisse

2. **Authentification utilisateur**  
   Token JWT ou session cookie  
   **Impact** : chaque réservation liée à un utilisateur identifié

3. **Persistence en base de données**  
   Migration de `const transfers = [...]` vers PostgreSQL/MongoDB  
   **Impact** : durabilité, transactions possibles

4. **Pagination du catalogue**  
   GET /transfers?limit=10&offset=0  
   **Impact** : réduction taille réponse pour gros catalogues

5. **Historique de réservations**  
   GET /transfers/:id/history ou GET /user/reservations  
   **Impact** : audit, debugging

---

## Références

- **Implémentation** : `src/transfers.js:21-27` (bookSeats), `src/server.js:23-42` (endpoint)
- **Tests** : `test/server.test.js` (3 cas POST)
- **Contexte workflow** : voir CARTE_DOMAINE.md pour détails des fonctions
