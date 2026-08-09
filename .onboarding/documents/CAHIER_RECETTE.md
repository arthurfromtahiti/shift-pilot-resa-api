# CAHIER_RECETTE — shift-pilot-resa-api

Plan de test — parcours à valider, cas de régression, critères d'acceptation.

> Confiance : high

## Préambule

Le cahier dérive de trois workflows documentés :
- `WORKFLOW_CONSULTATION_CATALOGUE` — consultation et filtrage du catalogue GET /transfers (avec filtre optionnel `?available=true` depuis SHIAAAAAAAAAAAAAAAAAAAAAAAA-408)
- `WORKFLOW_RESERVATION_SIEGE` — réservation de sièges POST /transfers/:id/reserve (SHIAAAAAAAAAAAAAAAAAAAAAAAA-61)
- `WORKFLOW_ANNULATION_SIEGE` — annulation de réservation DELETE /transfers/:id/reservations/:reservationId (SHIAAAAAAAAAAAAAAAAAAAAAAAA-353)

Tests : unitaires sur les fonctions domaine (`seatsLeft`, `isFull`, `bookSeats`, `cancelReservation` — les deux premières sont pures, les deux dernières mutent l'état intentionnellement) + intégration HTTP (couverte par `test/server.test.js`).

---

## Cas de test 1 : Consultation du catalogue de transferts (`GET /transfers`)

**Type** : intégration HTTP (API flow externe)

**Objectif** : valider que le client reçoit la liste complète des 3 transferts avec disponibilité calculée.

### Pré-condition
- Serveur Node.js lancé sur le port par défaut (3100) ou via `PORT` env var.
- Pas de modification du tableau `transfers` en mémoire depuis le démarrage (état initial).

### Étapes

1. **Préparer une requête HTTP**
   - Verbe : `GET`
   - URL : `http://localhost:3100/transfers`
   - Pas de header `Authorization`, pas de body.

2. **Envoyer la requête**
   - Utiliser un client HTTP : navigateur (fetch/XHR), `curl`, `node fetch`, Postman, ou un test automatisé.

3. **Recevoir la réponse**
   - Code de statut attendu : **200 OK**.
   - Header `Content-Type` attendu : **`application/json`**.
   - Body : un array JSON de 3 objets.

### Critères d'acceptation

**Structure de réponse** : un tableau JSON contenant exactement 3 objets, chacun avec les champs suivants (pas d'ordre imposé) :
- `id` (entier)
- `from` (chaîne)
- `to` (chaîne)
- `price` (entier)
- `seatsLeft` (entier)

**Les champs `seats` et `sold` ne doivent jamais apparaître.**

### Cas de données attendues

Après un démarrage frais du serveur (ou réinitialisation du module), la réponse doit contenir :

```json
[
  {
    "id": 1,
    "from": "Papeete",
    "to": "Moorea",
    "price": 3500,
    "seatsLeft": 28
  },
  {
    "id": 2,
    "from": "Papeete",
    "to": "Bora Bora",
    "price": 21000,
    "seatsLeft": 0
  },
  {
    "id": 3,
    "from": "Raiatea",
    "to": "Tahaa",
    "price": 1800,
    "seatsLeft": 15
  }
]
```

**Validation** :
- Transfert id 1 : 40 places, 12 vendues → `seatsLeft = 28`. ✓
- Transfert id 2 : 60 places, 60 vendues → `seatsLeft = 0` (saturé). ✓
- Transfert id 3 : 20 places, 5 vendues → `seatsLeft = 15`. ✓

### Résultat

**Acceptation** : le serveur retourne un array valide de 3 transferts avec les valeurs de disponibilité correctes, sans exposer `seats` ni `sold`.

**Rejet** : le serveur retourne un code d'erreur (5xx), un array vide, des champs manquants, ou des données incorrectes.

---

## Cas de test 1b : Filtrage par disponibilité — `GET /transfers?available=true` [SHIAAAAAAAAAAAAAAAAAAAAAAAA-408]

**Type** : intégration HTTP (API flow)

**Objectif** : valider que le paramètre `?available=true` filtre les transferts pour n'inclure que ceux ayant des places restantes.

### Pré-condition
- Serveur Node.js lancé sur port 3100.
- État initial : id 1 (28 restantes), id 2 (0 restantes — complet), id 3 (15 restantes).

### Étapes

1. **Préparer une requête HTTP**
   - Verbe : `GET`
   - URL : `http://localhost:3100/transfers?available=true`
   - Pas de header Authorization, pas de body.

2. **Envoyer la requête**

3. **Recevoir la réponse**
   - Code de statut attendu : **200 OK**.
   - Header `Content-Type` attendu : **`application/json`**.
   - Body : un array JSON contenant **2 objets** (id 1 et id 3, exclusion de id 2 qui est complet).

### Critères d'acceptation

La réponse doit contenir exactement les transferts où `seatsLeft > 0` (i.e. `isFull(t) === false`) :

```json
[
  {
    "id": 1,
    "from": "Papeete",
    "to": "Moorea",
    "price": 3500,
    "seatsLeft": 28
  },
  {
    "id": 3,
    "from": "Raiatea",
    "to": "Tahaa",
    "price": 1800,
    "seatsLeft": 15
  }
]
```

**Validation** :
- Transfert id 1 : `seatsLeft = 28 > 0` → inclus. ✓
- Transfert id 2 : `seatsLeft = 0` (saturé) → **exclu**. ✓
- Transfert id 3 : `seatsLeft = 15 > 0` → inclus. ✓

### Résultat

**Acceptation** : le filtre retourne un array de 2 transferts, excluant le transfert complet (id 2).

**Rejet** : le serveur retourne 3 éléments, inclut id 2, ou retourne un code d'erreur.

---

## Cas de test 2 : Réponse 404 sur route invalide

**Type** : intégration HTTP (negative case)

**Objectif** : valider que le serveur rejette les requêtes qui ne correspondent pas à `GET /transfers`.

### Cas 2a : Verbe HTTP non supporté sur `/transfers`

**Étape** : envoyer `POST /transfers` (ou `PUT`, `DELETE`, `PATCH`) vers le serveur.

**Code attendu** : **404 Not found**

**Body attendu** : `{ "error": "Not found" }`

**Content-Type** : `application/json`

### Cas 2b : Route inexistante

**Étape** : envoyer `GET /` ou `GET /catalogue` ou `GET /transfers/1`.

**Code attendu** : **404 Not found**

**Body attendu** : `{ "error": "Not found" }`

### Résultat

**Acceptation** : tout verbe non-GET ou toute route autre que `/transfers` retourne 404 + body vide ou erreur JSON.

**Rejet** : le serveur accepte `POST /transfers` ou retourne un code différent (5xx, 405, etc.).

---

## ## Cas de test 3 : Calcul de disponibilité — fonction `seatsLeft()`

**Type** : unitaire (fonction pure)

**Objectif** : valider que `seatsLeft(transfer)` retourne `seats - sold` sans effet de bord.

**Framework** : `node:test` + `node:assert/strict` (déjà utilisé dans `test/transfers.test.js`)

### Cas 3a : Cas nominal (places vendues < places totales)

```javascript
test("seatsLeft calcule correctement les places restantes", () => {
  const transfer = { seats: 40, sold: 12 };
  assert.strictEqual(seatsLeft(transfer), 28);
});
```

**Données** : 40 places, 12 vendues → 28 restantes.
**Acceptation** : la fonction retourne `28`.

### Cas 3b : Cas limite — pas de vente

```javascript
test("seatsLeft retourne capacity si sold === 0", () => {
  const transfer = { seats: 100, sold: 0 };
  assert.strictEqual(seatsLeft(transfer), 100);
});
```

**Données** : 100 places, 0 vendues → 100 restantes.
**Acceptation** : la fonction retourne `100`.

### Cas 3c : Cas limite — complet

```javascript
test("seatsLeft retourne 0 si sold === seats", () => {
  const transfer = { seats: 60, sold: 60 };
  assert.strictEqual(seatsLeft(transfer), 0);
});
```

**Données** : 60 places, 60 vendues → 0 restantes.
**Acceptation** : la fonction retourne `0`.

### Cas 3d : Cas de survente (comportement actuel — pas de garde)

```javascript
test("seatsLeft retourne un nombre négatif si sold > seats (comportement actuel, non gardé)", () => {
  const transfer = { seats: 40, sold: 50 };
  assert.strictEqual(seatsLeft(transfer), -10);  // comportement observé, pas défini comme correct
});
```

**Données** : 40 places, 50 vendues → -10 retourné (incohérent, mais pas d'erreur levée).
**Réalité** : la fonction retourne `-10`. Pas de validation d'invariant.
**Note** : ce cas n'est **pas un critère d'acceptation actuel** mais documenter le comportement pour la couverture future.

### Résultat

**Acceptation** : `seatsLeft(transfer)` retourne toujours `transfer.seats - transfer.sold` pour toute paire d'entiers.

**Rejet** : la fonction retourne une valeur différente, jette une exception, ou modifie l'objet `transfer` passé en paramètre.

---

## Cas de test 4 : Détection de saturation — fonction `isFull()`

**Type** : unitaire (fonction pure)

**Objectif** : valider que `isFull(transfer)` retourne `true` ssi `seatsLeft === 0`.

### Cas 4a : Transfert complet

```javascript
test("isFull retourne true si seatsLeft === 0", () => {
  const transfer = { seats: 60, sold: 60 };
  assert.strictEqual(isFull(transfer), true);
});
```

**Données** : saturé.
**Acceptation** : retourne `true`.

### Cas 4b : Transfert non complet

```javascript
test("isFull retourne false si seatsLeft > 0", () => {
  const transfer = { seats: 40, sold: 12 };
  assert.strictEqual(isFull(transfer), false);
});
```

**Données** : 28 places restantes.
**Acceptation** : retourne `false`.

### Cas 4c : Presque complet (1 place)

```javascript
test("isFull retourne false si seatsLeft === 1", () => {
  const transfer = { seats: 40, sold: 39 };
  assert.strictEqual(isFull(transfer), false);
});
```

**Données** : 1 place restante.
**Acceptation** : retourne `false` (pas de notion de « seuil »).

### Résultat

**Acceptation** : `isFull(transfer)` retourne un booléen correct pour tous les cas.

**Rejet** : la fonction retourne une valeur incorrecte ou jette une exception.

---

## Cas de test 5 : Accès au catalogue — fonction `listTransfers()`

**Type** : unitaire + intégration

**Objectif** : valider que `listTransfers()` retourne un array de 3 transferts avec les champs attendus.

### Cas 5a : Longueur et structure

```javascript
test("listTransfers retourne exactement 3 transferts avec les champs requis", () => {
  const transfers = listTransfers();
  assert.strictEqual(transfers.length, 3);
  
  // Vérifier que chaque transfert a les champs attendus
  transfers.forEach(t => {
    assert(t.id !== undefined);
    assert(t.from !== undefined);
    assert(t.to !== undefined);
    assert(t.seats !== undefined);
    assert(t.sold !== undefined);
    assert(t.price !== undefined);
  });
});
```

**Acceptation** : array de 3 objets, chacun avec `id, from, to, seats, sold, price`.

### Cas 5b : Cohérence des valeurs

```javascript
test("listTransfers retourne les données attendues", () => {
  const transfers = listTransfers();
  
  // Transfert 1
  assert.strictEqual(transfers[0].id, 1);
  assert.strictEqual(transfers[0].from, "Papeete");
  assert.strictEqual(transfers[0].to, "Moorea");
  assert.strictEqual(transfers[0].seats, 40);
  assert.strictEqual(transfers[0].sold, 12);
  assert.strictEqual(transfers[0].price, 3500);
  
  // Transfert 2 (complet)
  assert.strictEqual(transfers[1].id, 2);
  assert.strictEqual(transfers[1].seats, 60);
  assert.strictEqual(transfers[1].sold, 60);
  
  // Transfert 3
  assert.strictEqual(transfers[2].id, 3);
  assert.strictEqual(transfers[2].from, "Raiatea");
  assert.strictEqual(transfers[2].to, "Tahaa");
  assert.strictEqual(transfers[2].seats, 20);
  assert.strictEqual(transfers[2].sold, 5);
  assert.strictEqual(transfers[2].price, 1800);
});
```

**Acceptation** : toutes les valeurs correspondent aux données en mémoire.

### Résultat

**Acceptation** : `listTransfers()` retourne l'array complet avec les bonnes données.

**Rejet** : données manquantes, incorrectes, ou array vide.

---

## Cas de test 6 : Absence de régression — aucune mutation d'état

**Type** : intégration / robustesse

**Objectif** : valider que la projection `GET /transfers` ne modifie pas l'état interne.

### Cas 6a : Appel multiple avec résultats identiques

```javascript
test("GET /transfers retourne les mêmes données à chaque appel (pas de mutation d'état)", async () => {
  // Envoyer deux requêtes GET /transfers
  const response1 = await fetch('http://localhost:3100/transfers');
  const data1 = await response1.json();
  
  const response2 = await fetch('http://localhost:3100/transfers');
  const data2 = await response2.json();
  
  // Les données doivent être identiques
  assert.deepStrictEqual(data1, data2);
});
```

**Acceptation** : deux appels successifs retournent exactement le même JSON.

**Rejet** : les données divergent entre les deux appels (mutation d'état non contrôlée).

### Résultat

**Acceptation** : l'état en mémoire n'est pas modifié par les appels `GET /transfers`.

**Rejet** : le service modifie silencieusement `sold` ou d'autres champs.

---

## Cas de test 7 : Robustesse — gestion des erreurs

**Type** : intégration / sécurité

**Objectif** : valider que le serveur ne crashe pas sur inputs invalides.

### Cas 7a : URL malformée (RISQUE ACTIF — non couvert actuellement)

**Étape** : envoyer une requête HTTP/0.9 ou une URL avec caractères non UTF-8 valides (ex. `GET %FF%FE HTTP/1.1`).

**Résultat attendu** : le serveur **doit** retourner un 400 Bad Request au lieu de crasher.

**Réalité actuelle** : le serveur crashe (exception `TypeError` non attrapée dans `server.js:11`).

**Critère** : ce test échoue ; on attend une correction (voir `SECURITY_ROBUSTNESS_AUDIT.md`).

### Cas 7b : Header `Host` absent (HTTP/1.0)

**Étape** : envoyer une requête sans header `Host`.

**Résultat attendu** : le serveur doit gérer `req.headers.host === undefined` sans crasher.

**Critère** : le serveur retourne 200 ou 400, pas de crash.

### Résultat

**Acceptation** : le serveur gère gracieusement les inputs malformés.

**Rejet** : le serveur crashe ou retourne 5xx sur une requête malformée.

---

## Cas de test 8 : Intégration frontend — CORS

**Type** : intégration / cross-origin

**Objectif** : valider que le frontend `shift-pilot-resa-web` peut consommer l'API depuis un navigateur sur une origine différente.

**Pré-condition** : les deux services tournent sur des ports différents (ex. API sur 3100, frontend sur 3000).

### Cas 8a : Requête cross-origin depuis le navigateur

**Étape** (JavaScript côté frontend) :
```javascript
fetch('http://localhost:3100/transfers')
  .then(r => r.json())
  .then(data => console.log(data))
  .catch(e => console.error('CORS failed:', e));
```

**Résultat attendu** : le navigateur **doit** recevoir un header `Access-Control-Allow-Origin` et ne pas lever une CORS error.

**Réalité actuelle** : CORS bloqué (pas de header). Le navigateur lève `Origin http://localhost:3000 is not allowed`.

**Critère** : ce test échoue ; on attend une correction (voir `SECURITY_ROBUSTNESS_AUDIT.md`).

### Résultat

**Acceptation** : le frontend peut appeler l'API depuis le navigateur sans CORS error.

**Rejet** : requête bloquée par le navigateur avec CORS error.

---

## Cas de test 9 : Réservation de sièges — `POST /transfers/:id/reserve` [SHIAAAAAAAAAAAAAAAAAAAAAAAA-61]

**Type** : intégration HTTP (API flow critique)

**Objectif** : valider que le serveur crée une réservation, incrémente `sold`, génère un UUID et le retourne.

### Pré-condition
- Serveur Node.js lancé sur port 3100.
- État initial : id 1 a 28 places libres (40 total, 12 vendues).

### Cas 9a : Réservation nominale (1 siège)

**Étapes**
1. Envoyer `POST /transfers/1/reserve` (pas de body, défaut 1 siège)
2. Recevoir la réponse

**Code attendu** : **200 OK**

**Body attendu** :
```json
{
  "reservationId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "transferId": 1,
  "seatsLeft": 27
}
```

**Critères** :
- `reservationId` : UUID valide (format v4 générée par `randomUUID()`)
- `transferId` : 1 (celui de la requête)
- `seatsLeft` : 27 (28 - 1 réservation)
- Les 28 places étaient libres → la réservation réussit
- `transfer.sold` est incrémenté de 1 en mémoire

**Validation** : récupérer immédiatement `GET /transfers` et vérifier que id 1 affiche maintenant 27 places.

**Acceptation** : réservation créée, UUID retourné, places libres décrémentées, état persistent en mémoire.

**Rejet** : code d'erreur, UUID absent, places non décrémentées.

### Cas 9b : Réservation multi-sièges

**Étape** : envoyer `POST /transfers/1/reserve` avec body `{ "seats": 5 }`

**Code attendu** : **200 OK**

**Body attendu** :
```json
{
  "reservationId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "transferId": 1,
  "seatsLeft": 22
}
```

**Critères** : 27 places libres, on en réserve 5 → 22 restantes.

### Cas 9c : Réservation sur transfert saturé

**Étape** : envoyer `POST /transfers/2/reserve` (id 2 est plein : 60/60)

**Code attendu** : **409 Conflict**

**Body attendu** :
```json
{ "error": "Transfer full" }
```

**Critères** : aucune réservation créée, UUID non généré, `seatsLeft` inchangé.

### Cas 9d : Réservation avec ID invalide

**Étape** : envoyer `POST /transfers/999/reserve` (transfert n'existe pas)

**Code attendu** : **404 Not Found**

**Body attendu** :
```json
{ "error": "Transfer not found" }
```

### Cas 9e : Réservation avec seats invalide

**Étape** : envoyer `POST /transfers/1/reserve` avec body `{ "seats": -5 }` ou `{ "seats": "abc" }`

**Code attendu** : **400 Bad Request**

**Body attendu** :
```json
{ "error": "seats must be a positive integer" }
```

### Résultat

**Acceptation** : réservations créées avec UUID, places décrémentées, erreurs gérées correctement (404/409/400 selon contexte).

**Rejet** : crash, UUID non généré, places non décrémentées, erreurs non distinguées.

---

## Cas de test 10 : Annulation de réservation — `DELETE /transfers/:id/reservations/:reservationId` [SHIAAAAAAAAAAAAAAAAAAAAAAAA-353]

**Type** : intégration HTTP (API flow critique)

**Objectif** : valider que le serveur annule une réservation, décrémente `sold` et supprime du registre.

### Pré-condition
- Serveur lancé, une réservation existante (ex. UUID = `f47ac10b-58cc-4372-a567-0e02b2c3d479` sur transfert id 1 pour 5 sièges)
- État avant annulation : id 1 a 22 places libres.

### Cas 10a : Annulation nominale

**Étape** : envoyer `DELETE /transfers/1/reservations/f47ac10b-58cc-4372-a567-0e02b2c3d479`

**Code attendu** : **200 OK**

**Body attendu** :
```json
{ "seatsLeft": 27 }
```

**Critères** :
- Réservation supprimée du registre Map
- `transfer.sold` est décrémenté de 5 (places restaurées)
- Réponse retourne `seatsLeft` après annulation (22 + 5 = 27)

**Validation** : une seconde tentative d'annulation avec le même UUID doit retourner 404 (réservation déjà supprimée).

**Acceptation** : réservation annulée, places libérées, état synchro avec le registre.

**Rejet** : crash, places non libérées, réservation toujours present.

### Cas 10b : Annulation sur réservation inexistante

**Étape** : envoyer `DELETE /transfers/1/reservations/00000000-0000-0000-0000-000000000000` (UUID qui n'existe pas)

**Code attendu** : **404 Not Found**

**Body attendu** :
```json
{ "error": "Reservation not found" }
```

### Cas 10c : Annulation avec incohérence transferId

**Étape** : envoyer `DELETE /transfers/2/reservations/f47ac10b-...` (URL dit transfert 2, mais réservation est sur transfert 1)

**Code attendu** : **404 Not Found**

**Body attendu** :
```json
{ "error": "Reservation not found" }
```

**Critères** : validation de cohérence URL vs. objet (`reservation.transferId !== parseInt(transferId)` rejette la requête — SHIAAAAAAAAAAAAAAAAAAAAAAAA-396)

### Résultat

**Acceptation** : annulation crée libère les places, erreurs gérées (404 si UUID invalide ou transferId incohérent).

**Rejet** : crash, places non libérées, annulations croisées acceptées.

---

## Matrice de couverture actuelle

| Cas | Type | Implémenté | Couvert par test | Statut |
|-----|------|-----------|---------|--------|
| 1. GET /transfers | HTTP | ✓ | ✓ (`test/server.test.js:128-133`) | Couvert |
| 1b. GET /transfers?available=true [SHIA-408] | HTTP | ✓ | ✓ (`test/server.test.js:135-140`) | Couvert |
| 2. 404 routes invalides | HTTP | ✓ | Partiellement (`test/server.test.js:142-147`) | Partiellement couvert |
| 3. seatsLeft() | Unitaire | ✓ | ~ (3 cas sur 4) | Partiellement couvert |
| 4. isFull() | Unitaire | ✓ | ✓ (2 cas) | Couvert |
| 5. listTransfers() | Unitaire | ✓ | ~ (longueur seulement) | Partiellement couvert |
| 6. Pas de mutation | Intégration | ✓ (conception) | ✗ | À tester |
| 7. Robustesse erreurs (URL) | Robustesse | ✗ | ✗ | Défaillant (risque actif) |
| 8. CORS frontend | Intégration | ✗ | ✗ | Non implémenté |
| 9. POST /transfers/:id/reserve [SHIA-61] | HTTP | ✓ | ✓ (`test/server.test.js`) | Couvert (5 cas) |
| 10. DELETE /transfers/:id/reservations/:id [SHIA-353] | HTTP | ✓ | ✓ (`test/server.test.js`) | Couvert (3 cas) |

---

## Priorité de test

### Immédiat (avant production)
1. ✓ Tests HTTP `GET /transfers` + `?available=true` (couvert)
2. ✓ Tests HTTP POST /reserve (couvert)
3. ✓ Tests HTTP DELETE /reservations (couvert)
4. ⚠ Try/catch URL parsing (risque crash — non implémenté)
5. ⚠ Headers CORS (frontend bloqué — non implémenté)

### Court terme (recette complète)
6. Tests de cas limites `seatsLeft()` (survente)
7. Test d'intégration : pas de mutation entre appels
8. Validation des invariants (sold ≤ seats)
9. Sémantique 409 : distinguer "complet" de "pas assez de places"

### Moyen terme (avant production)
10. Try/catch sur URL parsing (crash actif)
11. CORS headers (nécessaire si frontend sur port différent)
12. Authentification (si multi-utilisateur souhaité)

---

## Commandement de test

### Lancer les tests existants
```bash
npm test
# Exécute test/transfers.test.js avec node:test
# Résultat attendu : 3 tests passent
```

### Lancer le serveur manuellement
```bash
node src/server.js
# Écoute sur 3100 (par défaut)
# Test manuel : curl http://localhost:3100/transfers
```

### Lancer avec port personnalisé
```bash
PORT=3000 node src/server.js
```

---

## Confiance et vérification

**Workflows couverts** : 3 (CONSULTATION_CATALOGUE, RESERVATION_SIEGE, ANNULATION_SIEGE)
**Cas testés implémentés** : 10 (unitaires + intégration HTTP)
**Cas couverts par `test/server.test.js`** : GET 200, GET?available, POST 200/400/404/409, DELETE 200/404
**Confiance fonctionnelle** : high — tous les endpoints documentés sont testés
**Dettes critiques** : risque crash URL parsing (`server.js:11`), absence CORS (bloquant frontend)
**Confiance documentaire** : high — matrices couvrent les 3 workflows validés, test cases détaillés et traçables

**Recommandation** : écrire des tests HTTP intégrés (supertest, node-fetch) avant de considérer le service production-ready. Voir `TESTING_AUDIT.md` pour les détails.
