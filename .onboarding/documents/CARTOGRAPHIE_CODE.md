# CARTOGRAPHIE_CODE — shift-pilot-resa-api

> **Confiance : high** — sources : lecture directe des fichiers source, structure du projet, et grep.

## Vue d'ensemble

```
shift-pilot-resa-api/
├── src/
│   ├── server.js         (843 bytes) — couche HTTP
│   └── transfers.js      (586 bytes) — données métier + calculs
├── test/
│   └── transfers.test.js (400 bytes) — 3 tests unitaires
├── package.json          — configuration Node.js
├── README.md             — documentation utilisateur
└── .onboarding/          — documents de synthèse (ce workspace)
```

**Total code source** : ~1,4 Ko répartis sur 2 fichiers métier (server.js + transfers.js).  
**Architecture** : Séparation nette HTTP / Métier — pas de framework, modules natifs Node.js uniquement.

---

## Domaines et fichiers

### 1. Catalogue des transferts inter-îles

**Domaine métier** : gestion de la liste des trajets disponibles avec leurs caractéristiques (prix, capacité, occupation).

| Aspect | Fichier | Lignes | Détail |
|--------|---------|--------|--------|
| **Données** | `src/transfers.js` | 3–7 | Tableau `const transfers` : 3 objets { id, from, to, seats, sold, price } |
| **Lecture** | `src/transfers.js` | 9–11 | Fonction `listTransfers()` : retourne le tableau brut |
| **Calcul places** | `src/transfers.js` | 13–15 | Fonction `seatsLeft(t)` : retourne `t.seats - t.sold` |
| **Test métier** | `test/transfers.test.js` | 14–16 | Test 3 : vérifie `listTransfers().length === 3` |
| **Exposition HTTP** | `src/server.js` | 14–20 | Projection de réponse : `.map()` vers `{ id, from, to, price, seatsLeft }` |

**Points clés** :
- Les données sont **hardcodées en mémoire**, aucune persistance.
- Trois trajets fixes : Papeete↔Moorea, Papeete↔Bora Bora, Raiatea↔Tahaa.
- `seatsLeft` est **calculé à la volée** (pas de cache) ; chaque requête appelle la fonction.
- Bora Bora est initialisé avec `sold: 60` (complet) — artefact intentionnel, jamais modifié en runtime.

**Risques de croissance** :
- Ajouter un 4e transfert casse le test `listTransfers().length === 3`.
- Aucune validation des invariants (`sold <= seats`, `price >= 0`) — risque latent si une route d'écriture est ajoutée.

---

### 2. Disponibilité et places (occupation)

**Domaine métier** : suivi du remplissage de chaque transfert — combien de places restent libres.

| Aspect | Fichier | Lignes | Détail |
|--------|---------|--------|--------|
| **Champs de stock** | `src/transfers.js` | 3–7 | `seats` (capacité), `sold` (vendues) dans chaque objet Transfer |
| **Calcul** | `src/transfers.js` | 13–15 | `seatsLeft(t) = t.seats - t.sold` |
| **Détection complétion** | `src/transfers.js` | 17–19 | Fonction `isFull(t)` : retourne `seatsLeft(t) === 0` |
| **Exposition HTTP** | `src/server.js` | 19 | `seatsLeft` inclus dans chaque objet de réponse |
| **Test métier** | `test/transfers.test.js` | 5–12 | Tests 1 & 2 : `seatsLeft()` et `isFull()` |

**Points clés** :
- `seatsLeft` est la **seule donnée d'occupation** exposée au client (l'API masque `seats` et `sold`).
- `isFull()` est **exportée et testée**, mais **non câblée à la route HTTP** — une décision préalable à toute évolution.
- `sold` n'est jamais incrémenté : le stock est **figé à sa valeur initiale**.

**Confiance** : medium (domaine validé en code, mais jamais observé en runtime — données statiques, pas de route d'écriture).

---

### 3. Exposition HTTP de l'API

**Domaine technique** : couche serveur, routage, sérialisation, gestion des erreurs.

| Aspect | Fichier | Lignes | Détail |
|--------|---------|--------|--------|
| **Serveur** | `src/server.js` | 1–10 | Import modules natifs, création du serveur `http.createServer` |
| **Routage** | `src/server.js` | 11–23 | Parsing URL, vérification `pathname === "/transfers" && method === "GET"`, cas défaut 404 |
| **Sérialisation** | `src/server.js` | 5–8 | Fonction `sendJson(res, status, body)` : fixe headers et envoie JSON |
| **Projection** | `src/server.js` | 14–20 | Transformation des données : `.map()` avec exclusion de `seats`/`sold`, inclusion de `seatsLeft` |
| **Démarrage** | `src/server.js` | 26–29 | `server.listen(port, ...)` avec port configurable `process.env.PORT || 3100` |
| **Guard testabilité** | `src/server.js` | 27 | `if (require.main === module)` empêche le démarrage lors des imports en test |

**Points clés** :
- **Une seule route** : `GET /transfers` (`src/server.js:13`).
- **Pas de framework** : routage manual par `if` sur pathname/méthode.
- **Pas d'appel asynchrone** : ni Promise ni callback en dehors du handler. Risque latent : aucun `try/catch` ; une exception synchrone non gérée dans `listTransfers()` ou `.map()` planterait le handler sans réponse structurée au client (`src/server.js:13-20`).
- **Port configurable** : `process.env.PORT || 3100` (`src/server.js:26`) — déploiement sans modification du code.

**Risque structurel** : la forme actuelle du callback (un seul `if`, suivi du défaut 404) ne passe pas à l'échelle au-delà de 2–3 routes. La deuxième route accumule la logique dans le même callback — signal pour introduire un routeur nommé avant d'ajouter trop de routes.

---

### 4. Qualité et tests

**Domaine technique** : vérification de la logique métier.

| Aspect | Fichier | Lignes | Détail |
|--------|---------|--------|--------|
| **Lanceur** | `package.json` | script `test` | `"test": "node --test test/"` |
| **Runner** | `test/transfers.test.js` | 1–2 | Imports natifs : `node:test`, `node:assert/strict` (Node.js ≥ 18) |
| **Test 1 — seatsLeft** | `test/transfers.test.js` | 5–7 | Fixture : `{ seats: 40, sold: 12 }` → espère 28 ✓ |
| **Test 2 — isFull** | `test/transfers.test.js` | 9–12 | Deux cas : complet (true), non-complet (false) ✓ |
| **Test 3 — cardinalité** | `test/transfers.test.js` | 14–16 | Vérifie `listTransfers().length === 3` ✓ |

**Points clés** :
- Tests unitaires **logique pure** — aucune dépendance externe (pas de base, pas de serveur HTTP).
- Aucun test de la route HTTP — pas de couverture du routage, de la sérialisation, ou de la réponse.
- `isFull()` est testée ici mais **non importée dans `src/server.js`** — logique testée mais morte en runtime.
- Le test 3 casse dès qu'un 4e transfert est ajouté (hard-codage de `=== 3`).

**Confiance** : low (pour la couverture fonctionnelle globale) — tests logique pure seulement, pas d'intégration.

---

## Points d'entrée par parcours

### Parcours 1 : Consultation du catalogue (client web)

```
GET /transfers
   ↓
src/server.js:10-23 (callback du serveur)
   ├─ Parsing URL : new URL(req.url, ...)
   ├─ Routage : if (pathname === "/transfers" && method === "GET")
   ├─ Appel : listTransfers() → src/transfers.js:9-11
   ├─ Calcul : .map() → seatsLeft(t) → src/transfers.js:13-15
   ├─ Projection : { id, from, to, price, seatsLeft }
   └─ Sérialisation : sendJson() → src/server.js:5-8
      → HTTP 200 + JSON
```

**Fichiers engagés** : `src/server.js` (l'intégralité), `src/transfers.js:3-15`.

### Parcours 2 : Exécution des tests

```
npm test (package.json)
   ↓
node --test test/transfers.test.js
   ├─ Import modules : node:test, node:assert/strict
   ├─ Import métier : ../src/transfers
   ├─ Test 1 : seatsLeft() → src/transfers.js:13-15
   ├─ Test 2 : isFull() → src/transfers.js:17-19
   ├─ Test 3 : listTransfers().length → src/transfers.js:9-11 + src/transfers.js:3-7
   └─ Rapport : code 0 (succès) ou ≠ 0 (échec)
```

**Fichiers engagés** : `test/transfers.test.js` (l'intégralité), `src/transfers.js` (l'intégralité).

---

## Zones critiques et hotspots

### 1. Callback du serveur `src/server.js:10-23`

**Pourquoi c'est critique** : toute la logique du serveur converge ici :
- Parsing de l'URL
- Routage (vérification du chemin + méthode)
- Appel à la logique métier
- Projection de la réponse
- Sérialisation JSON

**Risque** : Accumulation rapide de logique. Dès la deuxième route, ce callback devient le point d'accès unique pour toute nouvelle fonctionnalité. Aucune abstraction de routeur.

**Action préventive** : Si une nouvelle route est ajoutée, introduire une couche de routage (même minimale : `Map` ou `switch`) avant d'ajouter trop de logique inline.

### 2. Tableau `transfers` `src/transfers.js:3-7`

**Pourquoi c'est critique** : source unique de vérité pour le catalogue.
- Trois enregistrements hardcodés.
- Aucune validation d'invariants.
- Aucune persistance.
- Champ `sold` jamais mis à jour en runtime.

**Risque** : 
- Ajouter un 4e trajet casse le test 3 (`listTransfers().length === 3`).
- Si une route POST est ajoutée, `sold` peut dépasser `seats` sans validation → `seatsLeft` négatif.

**Action préventive** :
- Introduire une validation (`sold <= seats`, `price >= 0`) avant toute route d'écriture.
- Faire une copie du tableau dans `listTransfers()` plutôt que de retourner la référence directe.
- Décider : test 3 doit-il vérifier `listTransfers().length === 3` (donnée figée) ou `listTransfers().length > 0` (comportement)?

### 3. Fonction `isFull` `src/transfers.js:17-19`

**Pourquoi c'est un hotspot** : logique implémentée et testée, mais jamais exposée HTTP.
- Permet de détecter les transferts complets.
- Non importée dans `src/server.js`.
- Absent de la réponse API.

**Risque** : confusion — un développeur découvrant cette fonction se demandera pourquoi elle existe si elle n'est pas utilisée. Réponse supposée : préparation pour un filtrage futur ou logique en attente de décision.

**Action préventive** : Clarifier son rôle avant d'ajouter une nouvelle route. Soit l'exposer, soit la retirer.

---

## Dépendances

### Dépendances externes

- **`node:http`** (`src/server.js:1`) : module natif Node.js pour le serveur HTTP.
- **`node:url`** (`src/server.js:2`) : module natif pour parser les URLs.
- **`node:test`** (`test/transfers.test.js:1`) : runner de tests natif (Node.js ≥ 18).
- **`node:assert/strict`** (`test/transfers.test.js:2`) : assertions pour les tests.

**Aucune dépendance npm** : `package.json` ne déclare aucune `dependency` ni `devDependency`.

### Dépendances internes

```
src/server.js
   ├─ import { listTransfers, seatsLeft } from ./transfers
   └─ (n'importe pas : isFull)

src/transfers.js
   └─ (export : listTransfers, seatsLeft, isFull)

test/transfers.test.js
   └─ import { listTransfers, isFull, seatsLeft } from ../src/transfers
```

**Observation clé** : `src/server.js` n'importe que `listTransfers` et `seatsLeft` — `isFull` existe mais est morte côté HTTP.

---

## Fichiers à connaître

| Chemin | Taille | Rôle | Lecture essentielle |
|--------|--------|------|---------------------|
| `src/server.js` | 843 b | Couche HTTP, routage, sérialisation | Oui — point d'entrée unique |
| `src/transfers.js` | 586 b | Données, logique métier, calculs | Oui — source de vérité métier |
| `test/transfers.test.js` | ~400 b | Suite de tests unitaires | Oui — comprendre la couverture et les limites |
| `package.json` | ~300 b | Config Node.js, scripts, engines | Oui — pour reproduire l'env de dev |
| `README.md` | ~200 b | Description utilisateur (simple) | Oui — contexte et limites documentées |

---

## Évolution prévisible (signaux)

### Si une 2e route est ajoutée

**Symptôme** : accumuler la logique dans `src/server.js:10-23` par un `else if` supplémentaire.

**Prévention** : introduire un routeur nommé avant la deuxième route.

**Exemple** :
```javascript
const routes = {
  'GET /transfers': () => { /* logique ici */ },
  'POST /transfers': () => { /* nouvelle logique */ }
};
const key = `${req.method} ${url.pathname}`;
const handler = routes[key];
```

### Si `sold` doit être mis à jour

**Symptôme** : ajouter une route POST pour créer une réservation.

**Prévention** :
1. Implémenter une validation : `sold <= seats`, `price >= 0`.
2. Protéger `transfers` contre la mutation directe → copie dans `listTransfers()`.
3. Introduire une couche de sérialisation de données (transformation modèle interne → réponse API).

### Si le test 3 doit grandir

**Symptôme** : ajouter plus de 3 transferts, le test casse (`listTransfers().length === 3`).

**Prévention** : changer le test pour vérifier le comportement, pas la donnée figée.
```javascript
// Mauvais :
assert.equal(listTransfers().length, 3)  // casse si on ajoute un 4e trajet

// Bon :
assert.ok(listTransfers().length > 0)    // teste que listTransfers retourne quelque chose
```

---

## Vérification rapide (checklist pour un senior)

- [ ] `src/server.js` : une seule route, routage par `if`, pas de framework — OK pour pilote.
- [ ] `src/transfers.js` : données hardcodées, aucune persistance, aucune écriture — OK pour pilote.
- [ ] `test/transfers.test.js` : couverture logique pure seulement, pas de test HTTP — à étendre si évolution.
- [ ] Aucune `isFull` exposée HTTP — clarifier avant évolution.
- [ ] `sold` de Bora Bora = capacité (complet) — intentionnel ou artefact ? À documenter ou corriger.
- [ ] Zéro dépendance externe — maintenance minimale.

