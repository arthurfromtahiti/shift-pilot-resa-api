# CDC_FONCTIONNEL — shift-pilot-resa-api

Cahier des charges fonctionnel. Décrit ce que le logiciel fait, pour qui, selon quelles règles.

> Confiance : high

## Contexte métier

Service de consultation et réservation de transferts inter-îles en Polynésie française. L'objectif : permettre aux clients (via l'application frontend `shift-pilot-resa-web`) de :
1. Découvrir les trajets disponibles et leur disponibilité instantanée
2. Réserver des sièges sur un trajet (et recevoir un identifiant de réservation)
3. Annuler une réservation précédemment effectuée

Clients visés : voyageurs cherchant un trajet inter-îles, pas de restrictions d'accès (catalogue public).

## Acteurs et capacités

### Client HTTP externe
- **Capacité** : consulter la liste des transferts avec disponibilité.
- **Restrictions** : accès en lecture seule. Pas de création, modification, suppression.
- **Canaux** : requête HTTP `GET /transfers` depuis un navigateur web ou une application native.

### Serveur Node.js (`src/server.js`)
- **Capacité** : recevoir requêtes HTTP, router vers les endpoints, retourner JSON.
- **Logique** : exposer un catalogue statique avec calcul de disponibilité à chaque appel (pas de cache).
- **Non-capacité** : persistance, authentification, business logic complexe.

### Module de logique métier (`src/transfers.js`)
- **Capacité** : fournir primitives de calcul (`seatsLeft`, `isFull`), accès au catalogue (`listTransfers`), réservation (`bookSeats`), et annulation (`cancelReservation`).
- **Constraints** : fonctions (quasi-)pures, déterministes, sans I/O. Side-effect limité à mutations en mémoire (`transfer.sold`, registre `reservations`).

---

## Parcours utilisateur principal : Consulter les transferts disponibles

**Objectif** : le client obtient la liste complète des trajets avec places restantes.

**Déclencheur** : accès au frontend `shift-pilot-resa-web`, affichage du catalogue.

**Déroulement** :

1. Client HTTP envoie `GET /transfers` au serveur.
2. Serveur reçoit la requête, valide qu'il s'agit de la bonne route et de la bonne méthode (`pathname === "/transfers" && method === "GET"` — `server.js:13`).
3. Serveur appelle `listTransfers()` qui retourne le tableau en mémoire des 3 transferts avec tous leurs champs (`transfers.js:3-7`).
4. Pour chaque transfert, le serveur construit une projection réduite : `{ id, from, to, price, seatsLeft }` en omettant `seats` et `sold` (données internes — `server.js:14-20`).
5. Le calcul de `seatsLeft` pour chaque transfert s'effectue par `seatsLeft(transfer) = transfer.seats - transfer.sold` (`transfers.js:13-15`).
6. Serveur sérialise le tableau projeté en JSON et l'envoie au client avec statut 200 et header `Content-Type: application/json` (`server.js:5-8`).

**État observé par le client** : réponse JSON bien formée contenant 3 objets, chacun avec `id, from, to, price, seatsLeft` :

```json
[
  { "id": 1, "from": "Papeete", "to": "Moorea", "price": 3500, "seatsLeft": 28 },
  { "id": 2, "from": "Papeete", "to": "Bora Bora", "price": 21000, "seatsLeft": 0 },
  { "id": 3, "from": "Raiatea", "to": "Tahaa", "price": 1800, "seatsLeft": 15 }
]
```

**Résultat** : client affiche les trajets et leur disponibilité au voyageur.

---

## Parcours utilisateur secondaire : Réserver des sièges sur un transfert [SHIAAAAAAAAAAAAAAAAAAAAAAAA-61]

**Objectif** : le client immobilise N sièges sur un transfert et reçoit un identifiant de réservation unique (UUID).

**Déclencheur** : client web remplissant un formulaire de réservation (non encore implémenté côté frontend, mais l'API est prête).

**Déroulement** :

1. Client HTTP envoie `POST /transfers/{id}/reserve` au serveur avec corps JSON optionnel `{ seats: N }` (`server.js:23-45`).
2. Serveur reçoit la requête, valide la route via regex `/^\/transfers\/(\d+)\/reserve$/` (`server.js:23`), extrait l'ID et s'assure que la méthode est POST (`server.js:24`).
3. Serveur accumule le corps HTTP chunk par chunk, parse le JSON, extraite valeur de `seats` avec défaut 1 si absent (`server.js:26-36`).
4. Serveur valide que `seats` est un entier positif (≥ 1), rejette avec 400 si invalide (`server.js:37-39`).
5. Serveur appelle `bookSeats(id, seats)` (transferts.js:25-34`).
6. Dans `bookSeats()` :
   - Validation `seats > 0` et `Number.isInteger(seats)` (redondante avec étape 4, mais robuste) (`transfers.js:26`).
   - Recherche du transfert par ID (`transfers.js:27-28`), rejette 404 si non trouvé.
   - Calcul `seatsLeft(transfer)` et vérification `seatsLeft < seats` (`transfers.js:29`), rejette 409 si capacité insuffisante.
   - **Mutation en mémoire** : `transfer.sold += seats` (`transfers.js:30`).
   - **Génération UUID** : `reservationId = randomUUID()` (`transfers.js:31`).
   - **Enregistrement** : `reservations.set(reservationId, { transferId, seats })` (`transfers.js:32`).
   - Retour `{ ok: true, reservationId, seatsLeft: seatsLeft(transfer) }` (`transfers.js:33`).
7. Mappage résultats → réponse HTTP (`server.js:41-43`) :
   - `reason: "not_found"` → 404 `{ error: "Transfer not found" }`
   - `reason: "full"` → 409 `{ error: "Transfer full" }`
   - `ok: true` → 200 `{ reservationId: UUID, transferId: id, seatsLeft: X }` [UPDATED SHIAAAAAAAAAAAAAAAAAAAAAAAA-353]

**État observé par le client** : réponse 200 JSON contenant l'UUID de réservation et les places restantes après réservation :

```json
{
  "reservationId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "transferId": 1,
  "seatsLeft": 27
}
```

**Résultat** : client stocke l'UUID (en session, localStorage, état applicatif) pour annulation ultérieure.

---

## Parcours utilisateur tertiaire : Annuler une réservation [SHIAAAAAAAAAAAAAAAAAAAAAAAA-353]

**Objectif** : le client libère les places d'une réservation précédemment acceptée en fournissant son UUID.

**Déclencheur** : client web cliquant « annuler ma réservation » (non encore implémenté côté frontend, mais l'API est prête).

**Déroulement** :

1. Client HTTP envoie `DELETE /transfers/{id}/reservations/{reservationId}` au serveur (pas de body) (`server.js:48-54`).
2. Serveur reçoit la requête, valide la route via regex `/^\/transfers\/(\d+)\/reservations\/([^/]+)$/` (`server.js:48`), extrait l'ID du transfert (non utilisé) et l'UUID, s'assure que la méthode est DELETE (`server.js:49`).
3. Serveur extrait `reservationId` du groupe regex 2 (`server.js:50`).
4. Serveur appelle `cancelReservation(reservationId)` (`server.js:51`, `transfers.js:36-43`).
5. Dans `cancelReservation()` :
   - Recherche la réservation dans le registre Map (`reservations.get(reservationId)`) (`transfers.js:37`), rejette 404 si non trouvée.
   - Récupère le transfert associé via `reservation.transferId` (`transfers.js:39`).
   - **Mutation en mémoire (inverse)** : `transfer.sold -= reservation.seats` (`transfers.js:40`).
   - **Suppression du registre** : `reservations.delete(reservationId)` (`transfers.js:41`).
   - Retour `{ ok: true, seatsLeft: seatsLeft(transfer) }` (`transfers.js:42`).
6. Mappage résultats → réponse HTTP (`server.js:52-53`) :
   - `ok: false` (réservation inexistante/déjà annulée) → 404 `{ error: "Reservation not found" }`
   - `ok: true` → 200 `{ seatsLeft: X }` (places libres après annulation)

**État observé par le client** : réponse 200 JSON contenant les places libres après libération :

```json
{
  "seatsLeft": 29
}
```

**Résultat** : client reçoit confirmation que l'annulation a réussi ; places deviennent disponibles pour d'autres clients.

---

## Ensemble de données

### Notion fondamentale : Transfert (trajet inter-îles)

Représente un trajet régulier entre deux îles, avec capacité et ventes enregistrées.

| Champ | Type | Rôle | Exemple |
|-------|------|------|---------|
| `id` | entier | identifiant unique du transfert | `1, 2, 3` |
| `from` | chaîne | ville/île de départ | `"Papeete"` |
| `to` | chaîne | ville/île de destination | `"Moorea"` |
| `seats` | entier | capacité totale du trajet (places disponibles au démarrage) | `40, 60, 20` |
| `sold` | entier | places vendues ; incrémenté par `bookSeats()`, décrémenté par `cancelReservation()` | `12, 60, 5` |
| `price` | entier | prix unitaire en XPF (francs CFP polynésiens) | `3500, 21000, 1800` |

Schéma implicite (pas de TypeScript, pas de validation de schéma au runtime).

**État observable du catalogue** (données figées dans `transfers.js:3-7`) :

| id | from | to | seats | sold | seatsLeft | price |
|----|------|-----|-------|------|-----------|-------|
| 1 | Papeete | Moorea | 40 | 12 | 28 | 3500 |
| 2 | Papeete | Bora Bora | 60 | 60 | 0 | 21000 |
| 3 | Raiatea | Tahaa | 20 | 5 | 15 | 1800 |

**Projection exposée au client** (ce que `GET /transfers` retourne) : `{ id, from, to, price, seatsLeft }` — jamais `seats` ni `sold`.

### Notion secondaire : Réservation [SHIAAAAAAAAAAAAAAAAAAAAAAAA-61]

Représente un immobilisation de N sièges sur un transfert, associée à un UUID unique généré à la création.

| Champ | Type | Rôle | Exemple |
|-------|------|------|---------|
| `reservationId` | UUID | identifiant unique de la réservation (généré par `randomUUID()`) | `f47ac10b-58cc-4372-a567-0e02b2c3d479` |
| `transferId` | entier | référence au transfert réservé | `1, 2, 3` |
| `seats` | entier | nombre de places immobilisées | `1, 2, 5` |

**Stockage** : registre Map en mémoire `reservations` (`src/transfers.js:11`), clé = UUID, valeur = `{ transferId, seats }`.

**Cycle de vie** :
1. Création : `bookSeats()` génère un UUID et enregistre dans la Map (`transfers.js:31-32`).
2. Durée de vie : jusqu'à annulation ou redémarrage du process (volatilité).
3. Suppression : `cancelReservation()` supprime l'entrée de la Map (`transfers.js:41`).

**Réflexe de mutation** : chaque création de réservation incrémente `transfer.sold` du transfert associé ; chaque annulation le décrémente (le restaure à sa valeur pré-réservation).

---

## Règles métier

### Disponibilité d'un transfert
**Places restantes = capacité totale − places vendues**

$$seatsLeft(t) = t.seats - t.sold$$

Implémentation : `src/transfers.js:13-15`

**Domaine de validité** : mathématiquement, le résultat peut être négatif si `sold > seats` (cas de survente), mais le code n'effectue aucune validation et retournerait silencieusement un nombre négatif. Aucune garde documentée à ce jour.

### Saturation d'un transfert
**Un transfert est saturé si aucune place restante n'est disponible**

$$isFull(t) = (seatsLeft(t) === 0)$$

Implémentation : `src/transfers.js:17-19`

C'est une comparaison binaire : saturation oui/non, pas de seuil de « presque complet ».

**Corollaire** : le transfert id 2 (Papeete→Bora Bora) est saturé dès le démarrage (`sold: 60 = seats: 60`).

### Projection JSON
**Le client n'obtient que les données calculées et publiques**, jamais l'état interne de vente.

Les champs `seats` et `sold` n'apparaissent jamais dans la réponse HTTP. Le client voit uniquement :
- `id, from, to, price` (données statiques du trajet)
- `seatsLeft` (valeur calculée)

**Cohérence** : tous les transferts retournés, y compris les saturés (id 2). Aucun filtrage côté serveur.

### Aucune authentification, aucune autorisation
L'endpoint est public. N'importe quel client HTTP peut l'appeler. Pas de vérification d'identité, pas de token, pas de contrôle d'accès.

---

## Cas de non-fonctionnement (hors périmètre)

### Modification du catalogue
Impossible. Le tableau `transfers` est une constante module (`src/transfers.js:5`) réinitialisée à chaque démarrage du serveur.

### Persistance de réservations
Pas de base de données. Un redémarrage du process ramène `sold` aux valeurs hardcodées. Le registre `reservations` Map (en mémoire) est perdu.

### Filtrage côté serveur
Impossible de demander « uniquement les transferts avec places disponibles » — pas de query param `?available=true` ni de méthode équivalente. Le client doit filtrer lui-même.

### Modification d'une réservation
Impossible. Une fois réservée, on ne peut que l'annuler complètement ou accepter sa perte au redémarrage. Pas de modification partielle (ex. augmenter/réduire le nombre de sièges d'une réservation existante).

---

## Comportement sur requête invalide

**Toute requête qui ne correspond pas à une route supportée** retourne `404 Not found` :

```json
{ "error": "Not found" }
```

Statut HTTP : `404`. Content-Type : `application/json`.

Exemples de requêtes 404 :
- `GET /` (route invalide)
- `GET /transfers/1` (route invalide, pas de lecture unitaire)
- `POST /transfers` (chemin invalide, doit être `/transfers/{id}/reserve`)
- `GET /catalogue` (route inexistante)
- `PATCH /transfers/1/reservations/UUID` (méthode non supportée)
- Toute URL malformée qui parse correctement

Routes supportées (non-404) :
- `GET /transfers` — consultation catalogue
- `POST /transfers/{id}/reserve` — réservation (avec validation `id` entier, `seats` optionnel)
- `DELETE /transfers/{id}/reservations/{reservationId}` — annulation (avec validation `id` entier, `reservationId` UUID)

**Risque d'exception non attrapée** : si l'URL est strictement non parseable (ex. caractères interdits, structure HTTP/0.9), `new URL(...)` lève une `TypeError` qui n'est pas attrapée (`server.js:11` sans try/catch). Le process Node.js crashe. Voir `CODE_HOTSPOTS_AUDIT.md`, `SECURITY_ROBUSTNESS_AUDIT.md`.

---

## Intégrations déclarées

### Consommateur : `shift-pilot-resa-web`
Frontend React/Vue/autre, mentionné dans `README.md:4` comme consommateur de cette API. Détails du frontend hors périmètre. Intégration attendue : `fetch('http://api:3100/transfers')` ou similaire depuis le navigateur.

**Risque CORS** : le frontend sera bloqué si tournant sur une origine différente (`http://localhost:3000` vs `http://localhost:3100`). Aucun header `Access-Control-Allow-Origin` n'est actuellement posé. Voir `SECURITY_ROBUSTNESS_AUDIT.md`.

### Aucune intégration sortante
Pas d'appel HTTP vers un système externe, pas de connexion à une base de données, pas d'envoi de messages.

---

## Hypothèses non confirmées

### `isFull` exportée mais non câblée
La fonction `isFull(transfer)` est définie et exportée (`src/transfers.js:21-23`) mais jamais importée par `src/server.js` ni exposée dans la réponse HTTP. Possible usages futurs :
- Filtrer les transferts complets dans une future requête `GET /transfers?available=true`
- Indicateur UI côté frontend (champ `isFull` dans la réponse)

Aucune décision documentée.

### Fixture transfert plein
Le transfert id 2 (`sold: 60, seats: 60`) apparaît complètement vendu dès l'initialisation. C'est probablement une fixture pour tester le cas de saturation (observable dans `test/transfers.test.js:11-13` où `isFull({ seats: 60, sold: 60 })` = `true` est testé), mais aucun commentaire ne le confirme.

### Validation de seats dans POST /reserve
Le serveur valide que `seats` est un entier positif (ligne 37-39) et rejette avec 400 si non. C'est une validation côté HTTP, doublée par une validation symétrique dans `bookSeats()` (ligne 26). Stratégie prudente pour un pilote, mais en production une validation unique (soit HTTP, soit métier) suffirait.

### Synchronisation `sold` depuis un système externe
Le champ `sold` est maintenant incrémenté par `bookSeats()` et décrémenté par `cancelReservation()`, mais jamais chargé depuis un système externe au démarrage. En cas de redémarrage, on revient aux valeurs hardcodées. Aucun mécanisme de chargement/synchronisation asynchrone (backoffice, PMS, base de données) n'existe.

---

## Zones de non-clarté et questions ouvertes

1. **Validation des données** : si `sold > seats` (survente), `seatsLeft` retourne un nombre négatif sans erreur. Faut-il valider l'invariant ? Où (à l'écriture, à la lecture, jamais) ?

2. **Disponibilité temps réel** : la documentation parle de « disponibilité en temps réel », mais `sold` est statique. Avant production, qui est responsable de maintenir `sold` à jour ?

3. **CORS** : aucun header `Access-Control-Allow-Origin` n'est posé. Le frontend `shift-pilot-resa-web` sera-t-il co-localisé sur la même origine (proxy) ou sur une origine différente ?

4. **Démarrage du service** : `package.json` ne définit pas de script `start` (seulement `test`). Comment le service est-il lancé en développement et en production ?

5. **Port** : le port 3100 est hardcodé dans le code (`server.js:26`). Peut-il être surchargé via `PORT` env var (oui, le code le supporte) — est-ce documenté ?

---

## Barre de qualité et confiance

- **Fonctionnalité implémentée** (`GET /transfers`) : correct, cohérent avec les workflows.
- **Séparation des responsabilités** : claire et propre (transport vs. domaine).
- **Couverture de test** : complète pour les endpoints HTTP. Tous les parcours testés (GET 200, POST 200/400/404/409, DELETE 200/404) via `test/server.test.js` avec serveur actif.
- **Risques** : crash sur URL malformée, absence CORS, références mutables exposées (voir audits).
- **Matériel d'onboarding** : workflows et audits complets et cohérents avec le code.

**Résultat** : implémentation complète et testée pour consultation, réservation et annulation en mémoire. API opérationnelle pour pilote. Migration vers persistance requise pour production.
