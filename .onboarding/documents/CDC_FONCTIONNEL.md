# CDC_FONCTIONNEL — shift-pilot-resa-api

> **Confiance : high** — tous les cas d'usage et règles métier sont issus de la lecture directe du code source (`src/`, `test/`).

## Contexte métier

**API de consultation de catalogue de transferts inter-îles** destinée à être consommée par une application web ou mobile (`shift-pilot-resa-web`). Le produit couvre la **moitié lecture** d'un système de réservation de transferts : affichage de l'offre, consultation des tarifs et de la disponibilité. La **moitié écriture** (prise de réservation, paiement, annulation) est **hors périmètre** de ce dépôt (absent du code, pas de route POST/PUT/DELETE).

**Périmètre clairement délimité** : l'API sert un seul objectif fonctionnel = exposer une liste de trajets disponibles avec leurs caractéristiques (prix, places restantes). C'est un pilote de démonstration, pas un produit en production avec gestion d'historique, authentification client, ou traçabilité des changements.

---

## Acteurs et capacités

### Clients externes (lecteurs)

**Capacités** (ce qu'ils peuvent faire) :
- Consulter la liste complète des trois transferts (liaisons Papeete↔Moorea, Papeete↔Bora Bora, Raiatea↔Tahaa) avec tarif et places restantes.
- Connaître l'état d'occupation de chaque trajet sans calcul client.

**Interdictions** (ce qu'ils ne peuvent pas faire) :
- Créer une réservation (aucune route POST).
- Modifier un transfert (prix, places, trajectoire) — aucune route PUT/DELETE.
- Filtrer ou rechercher les trajets par origine/destination (pas d'argument de query string implémenté).
- Authentifier un client.

### Serveur API (producteur)

**Responsabilités** :
- Maintenir le catalogue de trois transferts en mémoire avec leurs données de stock (`seats`, `sold`) et de tarification.
- Calculer `seatsLeft = seats - sold` pour chaque transfert.
- Exposer le catalogue via HTTP en projetant la réponse (`{ id, from, to, price, seatsLeft }`).
- Gérer les requêtes HTTP malformées (retour 404 pour un chemin inconnu).

**Hors périmètre** :
- Persistance durable (base de données) — tout est perdu au redémarrage du serveur.
- Authentification/autorisation.
- Prise de réservation, mutation du stock.
- Logging, monitoring, tracing.

---

## Parcours utilisateur principal

**Nom** : `Consultation du catalogue de transferts`  
**Acteur** : Client web  
**Criticité** : Haute — c'est l'unique service rendu par l'API dans son état actuel  
**Type** : API flow (lecture)

### Déroulement

1. **Initiation** : Le client web envoie une requête `GET /transfers` au serveur.

2. **Réception et routage** (`src/server.js:10-13`).
   - Le serveur reçoit la requête via le callback `http.createServer`.
   - L'URL est parsée : `new URL(req.url, 'http://' + req.headers.host)`.
   - Le routage vérifie `url.pathname === "/transfers" && req.method === "GET"`.
   - Si OK → continuer à l'étape 3. Si non → retour 404 (étape 6).

3. **Récupération du catalogue** (`src/transfers.js:9-11`).
   - `listTransfers()` est appelée.
   - Retour : tableau brut de 3 objets `{ id, from, to, seats, sold, price }` depuis `src/transfers.js:3-7`.

4. **Transformation et calcul** (`src/server.js:14-20`).
   - Pour chaque transfert, appel de `seatsLeft(t) = t.seats - t.sold` (`src/transfers.js:13-15`).
   - Projection : construction d'un nouvel objet `{ id, from, to, price, seatsLeft }`.
   - Les champs `seats` et `sold` sont exclus de la réponse (encapsulation).

5. **Sérialisation et envoi** (`src/server.js:5-8`).
   - La réponse est sérialisée en JSON via `JSON.stringify`.
   - Header `Content-Type: application/json` et statut HTTP 200 sont fixés.
   - Réponse retournée au client.

6. **Cas alternatif — chemin inconnu** (`src/server.js:23`).
   - Toute autre combinaison (mauvais chemin, mauvaise méthode) tombe dans le défaut.
   - Réponse : `404 { error: "Not found" }`.

### Exemple de réponse réussie

```json
HTTP/1.1 200 OK
Content-Type: application/json

[
  { "id": 1, "from": "Papeete", "to": "Moorea", "price": 3500, "seatsLeft": 28 },
  { "id": 2, "from": "Papeete", "to": "Bora Bora", "price": 21000, "seatsLeft": 0 },
  { "id": 3, "from": "Raiatea", "to": "Tahaa", "price": 1800, "seatsLeft": 15 }
]
```

### Exemple de réponse d'erreur

```json
HTTP/1.1 404 Not Found
Content-Type: application/json

{ "error": "Not found" }
```

---

## Règles métier (exigences fonctionnelles)

### Catalogue fixe

**Règle** : L'API expose exactement **trois transferts** codés en dur en mémoire (`src/transfers.js:3-7`).

| Transfert | Origine | Destination | Capacité | Vendues | Prix |
|-----------|---------|-------------|----------|---------|------|
| ID 1 | Papeete | Moorea | 40 places | 12 | 3 500 XPF* |
| ID 2 | Papeete | Bora Bora | 60 places | 60 | 21 000 XPF* |
| ID 3 | Raiatea | Tahaa | 20 places | 5 | 1 800 XPF* |

**Preuve** : `src/transfers.js:3-7`  
**Hypothèse** : l'unité monétaire est le franc Pacifique (XPF) — inféré du contexte géographique (Polynésie française), jamais explicité dans le code.

### Calcul des places restantes

**Règle** : `seatsLeft(transfer) = transfer.seats - transfer.sold`

Exemple pour Papeete→Moorea :
- Capacité : 40 places
- Vendues : 12
- Restantes : 40 − 12 = 28

**Preuve** : `src/transfers.js:13-15`  
**Importance** : c'est le signal d'occupation affichable côté client ; elle doit être exacte.  
**Calcul** : atomique, sans état externe — recalculé à chaque requête `GET /transfers`.

### Encapsulation du stock

**Règle** : Les champs `seats` et `sold` **ne sont jamais exposés** dans la réponse HTTP. Seul `seatsLeft` (valeur calculée) et les métadonnées de trajet (`id`, `from`, `to`, `price`) sont retournés.

**Preuve** : `src/server.js:14-20`  
**Objectif** : préserver la liberté d'évoluer la représentation interne du stock sans casser l'API. Un client ne voit pas la mécanique interne, seulement le résultat (`places restantes`).

### Pas d'écriture sur le stock

**Règle** : Aucun chemin du code n'incrémente ou ne décrémente le champ `sold`. Le stock reste figé à sa valeur initiale pour toute la durée de vie du processus.

**Preuve** : Recherche `grep -niE "sold\s*=" src/` → résultats = `src/transfers.js:4-6` (déclaration initiale seulement).  
**Conséquence** : Bora Bora reste « complet » (seatsLeft = 0) sans qu'aucune réservation n'ait eu lieu — artefact de donnée volontaire pour un pilote.

### Fonction `isFull` implémentée mais non exposée

**Définition** : `isFull(transfer) = seatsLeft(transfer) === 0` (`src/transfers.js:17-19`)

**Statut** : Exportée (`src/transfers.js:21`), testée (`test/transfers.test.js:9-12`), mais **jamais importée dans `src/server.js`** et **n'apparaît pas dans la réponse HTTP**.

**Interprétation** : Deux scénarios possibles :
1. Préparation pour une future route de filtrage (`GET /transfers?available=true` retournant uniquement les transferts avec `seatsLeft > 0`).
2. Logique anticipée mais abandon — à clarifier.

**Impact** : Un client qui souhaite afficher uniquement les transferts disponibles doit calculer `seatsLeft === 0` lui-même ; il n'y a pas de champ `isFull` ou de filtre serveur.

**Preuve** : `src/transfers.js:17-21`, `src/server.js:3` (absence d'import), `test/transfers.test.js:9-12` (tests)

---

## Données observées

### Entité `Transfer`

Structure interne (voir par le développeur, jamais exposée directement au client) :

```javascript
{
  id:    number,      // Entier séquentiel (1, 2, 3)
  from:  string,      // Origine (ex. "Papeete")
  to:    string,      // Destination (ex. "Moorea")
  seats: number,      // Capacité totale
  sold:  number,      // Places vendues (jamais mise à jour en runtime)
  price: number       // Tarif (unité supposée XPF, non documentée)
}
```

**Projection API** (ce que le client reçoit) :

```javascript
{
  id:        number,  // Identifiant du transfert
  from:      string,  // Origine
  to:        string,  // Destination
  price:     number,  // Tarif
  seatsLeft: number   // Calcul : seats - sold
}
```

**Règle d'encapsulation** : `seats` et `sold` sont masqués ; seul `seatsLeft` (dérivé) est exposé.

### Absences significatives

| Donnée | Statut | Impact |
|--------|--------|--------|
| Devise | Absent, supposée XPF | Client doit connaître la devise hors API pour afficher correctement le prix |
| Date/heure de départ | Absent | Modèle décrit des liaisons permanentes (Papeete→Moorea existe toujours), pas des créneaux datés (ferry du 5 août à 14h) |
| Raison de la complétion | N/A | Bora Bora est complet (sold:60 = seats:60) sans qu'une seule réservation n'ait eu lieu — artefact de donnée |
| `isFull` (signal) | Calculable, non exposée | Client calcule `seatsLeft === 0` ; pas de champ `isFull` dans la réponse |

---

## Workflow de test

**Nom** : `Exécution de la suite de tests unitaires`  
**Type** : Technical flow  
**Criticité** : Basse (3 tests de logique pure, aucune couverture HTTP)  
**Confiance** : High

### Déroulement

1. Développeur exécute `npm test` (script `package.json`).
2. Node.js lance `node --test test/` (runner natif Node ≥ 18, sans dépendance externe).
3. Trois tests s'exécutent (`test/transfers.test.js:5-16`) :
   - **Test 1** : `seatsLeft({ seats: 40, sold: 12 }) === 28` ✓
   - **Test 2** : `isFull({ seats: 60, sold: 60 }) === true` ✓ et `isFull({ seats: 40, sold: 12 }) === false` ✓
   - **Test 3** : `listTransfers().length === 3` ✓
4. Sortie : code `0` (succès) ou `≠ 0` (échec).

**Couverture** : Tests logique métier pure uniquement (fonctions `seatsLeft`, `isFull`, `listTransfers`). **Aucun test de la route HTTP** (`GET /transfers`) — aucune couverture du routage, de la sérialisation JSON, ou de la réponse.

---

## Périmètre délimité (hors scope)

### Absences intentionnelles (pilote)

- **Réservation** : Aucune route POST pour créer une réservation. Aucun mécanisme de prise de place.
- **Annulation** : Aucune route DELETE pour annuler une réservation.
- **Modification du stock** : `sold` ne peut jamais être incrémenté par une route.
- **Authentification** : Aucun contrôle d'accès. L'API est ouverte.
- **Pagination / filtrage** : Retour toujours les 3 transferts, aucun argument de query accepté.
- **Persistance** : Données en mémoire, perdues au redémarrage.

### Signaux de clarification

Ces absences sont **volontaires** (état de pilote SHIFT/Paperclip) et **documentées**. Elles ne sont pas des bugs, mais des frontières qu'il faut accepter — et clarifier avant d'évoluer.

---

## Hypothèses et questions ouvertes

| Question | Impact | Preuve / Source |
|----------|--------|-----------------|
| **Devise exacte** : XPF ou autre ? | Client doit afficher le prix correctement | `src/transfers.js:3-7` (entier brut sans unité) |
| **Bora Bora complet intentionnel ?** | Confusion lors de tests produit si artefact non documenté | `src/transfers.js:5` (sold:60 = seats:60) |
| **`isFull()` destinée à quoi ?** | Clarifier avant d'ajouter une route de filtrage | Fonction exportée/testée mais morte côté HTTP |
| **Réservation dans `shift-pilot-resa-web` ?** | Comprendre la division du travail entre dépôts | `README.md:3-4` (désigne resa-web comme consommateur) |
| **Infrastructure de déploiement ?** | Savoir comment lancer le serveur en production | Aucune Dockerfile, aucun `Procfile` trouvés |

---

## Recommandations pour l'évolution

1. **Avant d'ajouter une route d'écriture** (POST /reservations) :
   - Implémenter une validation : `sold <= seats`, `price >= 0`.
   - Protéger le tableau `transfers` contre la mutation directe (retourner une copie dans `listTransfers()`).
   - Introduire une couche de routage (Map ou switch) pour éviter l'accumulation de logique dans le callback `createServer`.

2. **Clarifier le statut de `isFull`** :
   - Soit l'exposer dans la réponse : `isFull: seatsLeft === 0`.
   - Soit implémenter un filtre : `GET /transfers?available=true`.
   - Soit la retirer si elle n'a aucun usage prévu.

3. **Documenter la devise** : ajouter `currency: "XPF"` dans chaque réponse ou dans le README.

4. **Réévaluer `sold` de Bora Bora** : passer à `sold: 45` (exemple) pour que la démonstration montre un transfert partiellement rempli plutôt que systématiquement complet.

