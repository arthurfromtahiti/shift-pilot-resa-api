# CAHIER_RECETTE — shift-pilot-resa-api

> **Confiance : high** — tous les chemins de test sont issus des workflows et du code source vérifiés.

Le cahier de recette décrit les parcours à tester pour valider que le produit fonctionne comme prévu. Chaque test est dérivé d'un **workflow** documenté (WORKFLOW_GET_TRANSFERS, WORKFLOW_SUITE_TESTS).

---

## Préalable : Environnement de test

### Prérequis

- **Node.js ≥ 18** — runner de tests natif `node:test` et modules natifs.
- **Git** — pour cloner le dépôt.
- **Port 3100 disponible** (ou redéfinir via `PORT=XXXX`).

### Installation

```bash
git clone <repo-url>
cd shift-pilot-resa-api
npm install          # Aucune dépendance externe — crée le package-lock.json si absent
```

### Démarrage du serveur

```bash
npm start            # Démarre le serveur sur http://localhost:3100
```

ou

```bash
PORT=3001 npm start  # Démarre sur un port custom
```

### Validation de l'env

```bash
# Vérifier Node.js
node --version       # ≥ 18.x

# Tester le runner
npm test             # Doit afficher : 3 tests, 0 failures
```

---

## Test 1 : Consultation du catalogue (parcours nominal)

**Objectif** : Valider que `GET /transfers` retourne la liste complète des trois transferts avec leurs données correctes.

**Criticité** : Haute — c'est l'unique fonctionnalité exposée.

### Cas 1.1 : Réponse structurée

**Étapes** :

1. Démarrer le serveur : `npm start`
2. Envoyer une requête HTTP :
   ```bash
   curl -s http://localhost:3100/transfers | jq .
   ```

**Attendus** :

- **Statut HTTP** : `200 OK`
- **Header** : `Content-Type: application/json`
- **Corps** : tableau JSON de 3 objets
- **Champs par objet** : `id`, `from`, `to`, `price`, `seatsLeft` (et uniquement ceux-ci)
- **Champs absents** : `seats`, `sold` (masqués à dessein)

**Exemple de réponse réussie** :
```json
[
  { "id": 1, "from": "Papeete", "to": "Moorea", "price": 3500, "seatsLeft": 28 },
  { "id": 2, "from": "Papeete", "to": "Bora Bora", "price": 21000, "seatsLeft": 0 },
  { "id": 3, "from": "Raiatea", "to": "Tahaa", "price": 1800, "seatsLeft": 15 }
]
```

**Validation** :

- [ ] 3 objets dans le tableau.
- [ ] Chaque objet contient exactement 5 champs.
- [ ] Pas de champ `seats` ni `sold`.
- [ ] `seatsLeft` est un entier positif (ou zéro).

### Cas 1.2 : Valeurs correctes

**Étapes** : (suite du cas 1.1)

**Attendus** :

| Transfert | id | from | to | price | seatsLeft | Calcul |
|-----------|----|----|-----|-------|-----------|--------|
| 1 | 1 | Papeete | Moorea | 3500 | 28 | 40 - 12 |
| 2 | 2 | Papeete | Bora Bora | 21000 | 0 | 60 - 60 |
| 3 | 3 | Raiatea | Tahaa | 1800 | 15 | 20 - 5 |

**Validation** :

- [ ] Tous les `id` sont uniques et séquentiels (1, 2, 3).
- [ ] Tous les `from` et `to` correspondent à des îles réelles (Papeete, Moorea, Bora Bora, Raiatea, Tahaa).
- [ ] Tous les `price` sont des entiers positifs.
- [ ] `seatsLeft` = `seats` − `sold` pour chaque transfert.
  - Papeete→Moorea : 40 − 12 = 28 ✓
  - Papeete→Bora Bora : 60 − 60 = 0 ✓
  - Raiatea→Tahaa : 20 − 5 = 15 ✓

### Cas 1.3 : Ordre de retour

**Étapes** : (suite du cas 1.1)

**Attendus** :
- Les transferts sont retournés dans l'ordre du tableau source (`src/transfers.js:3-7`).
- Ordre : Papeete→Moorea (ID 1), Papeete→Bora Bora (ID 2), Raiatea→Tahaa (ID 3).

**Validation** :

- [ ] L'ordre est respecté (pas de tri par prix, destination ou `seatsLeft`).

---

## Test 2 : Erreurs HTTP et chemins inconnus

**Objectif** : Valider que les requêtes invalides retournent un statut 404 et un message d'erreur structuré.

**Criticité** : Moyenne — comportement défensif.

### Cas 2.1 : Mauvais chemin

**Étapes** :

1. Serveur en cours d'exécution.
2. Envoyer une requête à un chemin inexistant :
   ```bash
   curl -s -i http://localhost:3100/unknown
   ```

**Attendus** :

- **Statut HTTP** : `404 Not Found`
- **Header** : `Content-Type: application/json`
- **Corps** : `{ "error": "Not found" }`

**Validation** :

- [ ] Statut 404.
- [ ] Corps JSON valide avec message `error`.

### Cas 2.2 : Mauvaise méthode HTTP

**Étapes** :

1. Serveur en cours d'exécution.
2. Envoyer une requête POST (au lieu de GET) :
   ```bash
   curl -s -i -X POST http://localhost:3100/transfers
   ```

**Attendus** :

- **Statut HTTP** : `404 Not Found`
- **Corps** : `{ "error": "Not found" }`

**Validation** :

- [ ] Statut 404 (pas 405 Method Not Allowed).
- [ ] Corps identique au cas 2.1.

### Cas 2.3 : Chemins typiquement attendus mais absents

**Étapes** : Tester les routes qui pourraient être anticipées mais ne sont pas implémentées :

1. `POST /transfers` (créer une réservation) :
   ```bash
   curl -s -i -X POST -H "Content-Type: application/json" \
     -d '{"from":"Papeete","to":"Moorea"}' \
     http://localhost:3100/transfers
   ```
   → Doit retourner 404.

2. `GET /transfers/1` (consulter un transfert spécifique) :
   ```bash
   curl -s -i http://localhost:3100/transfers/1
   ```
   → Doit retourner 404.

3. `GET /transfers?from=Papeete` (filtrer par origine) :
   ```bash
   curl -s -i http://localhost:3100/transfers?from=Papeete
   ```
   → Doit retourner l'intégralité du catalogue (query ignorés), statut 200.

**Validation** :

- [ ] POST /transfers → 404.
- [ ] GET /transfers/:id → 404.
- [ ] GET /transfers?... → 200 + catalogue complet (query ignorés).

**Note** : Le dernier cas est important pour documenter que les filtres ne sont **pas** implémentés — le client reçoit toujours les 3 transferts.

---

## Test 3 : Logique métier — Calcul des places

**Objectif** : Valider que le calcul `seatsLeft = seats - sold` est exact et cohérent.

**Criticité** : Haute — c'est une règle métier critique.

### Cas 3.1 : Calcul correct par transfert

**Étapes** : (suite du test 1)

**Attendus** :

Pour chaque transfert, vérifie que `seatsLeft` = `seats` − `sold`.

| Transfert | Données source | Calcul attendu | Réponse API |
|-----------|---|---|---|
| 1 | seats:40, sold:12 | 40 − 12 = 28 | seatsLeft: 28 |
| 2 | seats:60, sold:60 | 60 − 60 = 0 | seatsLeft: 0 |
| 3 | seats:20, sold:5 | 20 − 5 = 15 | seatsLeft: 15 |

**Validation** :

- [ ] Papeete→Moorea : `seatsLeft === 28`
- [ ] Papeete→Bora Bora : `seatsLeft === 0`
- [ ] Raiatea→Tahaa : `seatsLeft === 15`

### Cas 3.2 : Cohérence entre appels

**Étapes** :

1. Envoyer 3 requêtes consécutives à `GET /transfers`.
2. Comparer les réponses.

**Attendus** :

- Les trois réponses sont **identiques** (pas de mutation du stock entre appels).
- `seatsLeft` ne change pas.

**Validation** :

- [ ] Réponse 1 == Réponse 2 == Réponse 3.

**Justification** : Les données sont statiques en mémoire, jamais modifiées en runtime (pas de route d'écriture).

### Cas 3.3 : Signification de seatsLeft = 0

**Étapes** :

1. Récupérer la réponse de `GET /transfers`.
2. Localiser le transfert avec `seatsLeft: 0` (Papeete→Bora Bora, ID 2).

**Attendus** :

- `seatsLeft: 0` signifie que le transfert est **complet** (aucune place libre).
- Cette information est suffisante pour que le client web affiche un badge « complet » ou masque ce trajet des offres disponibles.

**Validation** :

- [ ] Bora Bora a `seatsLeft: 0`.
- [ ] Les deux autres ont `seatsLeft > 0`.

**Note pédagogique** : Bora Bora est complet **depuis le démarrage** (`sold: 60 = seats: 60`) — c'est un artefact de donnée volontaire pour la démonstration, pas une réservation effectuée. Le client doit l'accepter.

---

## Test 4 : Suite de tests unitaires

**Objectif** : Valider que tous les tests automatisés passent et qu'il n'y a pas de régression dans la logique métier.

**Criticité** : Moyenne — tests logique pure seulement (pas d'intégration HTTP).

### Cas 4.1 : Exécution complète

**Étapes** :

1. Terminal ouvert sur le dépôt.
2. Exécuter : `npm test`

**Attendus** :

```
# Exemple de sortie réussie (Node.js natif test runner)
✓ seatsLeft calculation
✓ isFull detection
✓ listTransfers cardinality
```

- **Statut sortie** : code `0` (succès).
- **3 tests passent**.

**Validation** :

- [ ] `npm test` retourne code 0.
- [ ] Pas de `FAIL` ni `Error` dans la sortie.

### Cas 4.2 : Détail des tests

**Étapes** : (suite du cas 4.1)

**Attendus** :

**Test 1 — `seatsLeft`** :
- Vérifie que `seatsLeft({ seats: 40, sold: 12 }) === 28` ✓

**Test 2 — `isFull`** :
- Vérifie que `isFull({ seats: 60, sold: 60 }) === true` ✓
- Vérifie que `isFull({ seats: 40, sold: 12 }) === false` ✓

**Test 3 — `listTransfers` cardinalité** :
- Vérifie que `listTransfers().length === 3` ✓

**Validation** :

- [ ] Test 1 passe (calcul de `seatsLeft` correct).
- [ ] Test 2 passe (détection de complétude correcte).
- [ ] Test 3 passe (catalogue retourne 3 éléments).

### Cas 4.3 : Couverture des tests

**Étapes** : (analyse statique)

**Observations** :

- **Couverture logique métier** : Tests 1, 2, 3 couvrent les trois fonctions exportées (`seatsLeft`, `isFull`, `listTransfers`).
- **Couverture HTTP** : **Aucun test** de la route `GET /transfers`, du routage, ou de la sérialisation JSON.

**Validation** :

- [ ] Les tests couvrent la logique métier pure (pas d'intégration).
- [ ] Aucun test HTTP trouvé (à ajouter si évolution majeure).

**Implication** : Un bug dans `src/server.js` (routage, projection de réponse, sérialisation) ne serait **pas** détecté par cette suite. Tests 1–2 portent sur des objets injectés (fixtures), pas sur le catalogue réel. Seul le test 3 vérifie que le catalogue a 3 éléments.

---

## Test 5 : Performance et stabilité

**Objectif** : Valider que le serveur est stable et répond rapidement sous une charge minimale.

**Criticité** : Basse — pilote de démonstration, pas de charge critique attendue.

### Cas 5.1 : Requêtes répétées

**Étapes** :

1. Serveur lancé.
2. Exécuter 100 requêtes consécutives :
   ```bash
   for i in {1..100}; do curl -s http://localhost:3100/transfers > /dev/null; done; echo "Done"
   ```
3. Mesurer le temps total.

**Attendus** :

- Toutes les 100 requêtes retournent statut 200.
- Le serveur ne s'arrête pas.
- Le serveur ne plante pas (code de sortie 0 pour toutes les requêtes).

**Validation** :

- [ ] Pas d'erreur en cours d'exécution.
- [ ] Pas de crash du serveur.
- [ ] Aucune exception non gérée ne coupe la connexion.

### Cas 5.2 : Port configuré

**Étapes** :

1. Démarrer le serveur sur un port custom :
   ```bash
   PORT=3001 npm start &
   ```
2. Vérifier que le serveur écoute sur ce port :
   ```bash
   curl -s http://localhost:3001/transfers > /dev/null && echo "OK"
   ```
3. Tuer le processus : `pkill -f "node.*server.js"`

**Attendus** :

- Le serveur démarre sur le port fourni via `PORT`.
- Les requêtes retournent 200.

**Validation** :

- [ ] Port custom accepté.
- [ ] Serveur fonctionnel sur ce port.

---

## Matrices de tests supplémentaires

### Matrice 1 : Combinaisons HTTP valides/invalides

| Chemin | Méthode | Attendu | Test |
|--------|---------|---------|------|
| `/transfers` | GET | 200 + catalogue | 1.1 ✓ |
| `/transfers` | POST | 404 | 2.2 |
| `/transfers` | PUT | 404 | 2.2 |
| `/transfers` | DELETE | 404 | 2.2 |
| `/transfers/1` | GET | 404 | 2.3 |
| `/unknown` | GET | 404 | 2.1 |
| `/transfers?available=true` | GET | 200 + catalogue | 2.3 |

### Matrice 2 : Cohérence des données

| Scénario | Vérifie | Test |
|----------|---------|------|
| Stock figé | `seatsLeft` identique entre appels | 3.2 |
| Calcul correct | `seatsLeft = seats - sold` | 3.1, 4.2 |
| Bora Bora complet | `seatsLeft === 0` pour ID 2 | 3.3, 4.2 |
| Données masquées | Absence de `seats` et `sold` | 1.1 |

---

## Blocages connus et limitations

### Fonctionnalités absentes (intentionnelles)

| Fonctionnalité | Statut | Implication de test |
|---|---|---|
| Réservation (POST) | Absent | Ne pas tester une route qui n'existe pas |
| Filtrage (`?from=X`) | Absent | Tester que les query strings sont ignorés (retour catalogue complet) |
| `isFull` dans la réponse | Absent | Tester que le champ n'existe pas dans le JSON |
| Persistance | Absent | Tester que les données se réinitialisent au redémarrage |

### Pré-requis pour prolonger la recette

Si une nouvelle fonctionnalité est ajoutée (ex. une deuxième route), ajouter des cas de test correspondants :
- [ ] Nouveaux cas dans le test 2 (erreurs HTTP).
- [ ] Nouveaux tests de logique métier (équivalents aux tests 3–4).
- [ ] Mise à jour du test de performance (cas 5.1) si la logique devient plus lourde.

---

## Checklist finale de recette

**Avant de valider le produit** :

- [ ] Test 1 : `GET /transfers` retourne 3 objets avec les bons champs.
- [ ] Test 1 : `seatsLeft` est correct pour chaque transfert.
- [ ] Test 2 : Chemins inconnus retournent 404.
- [ ] Test 2 : Mauvaises méthodes retournent 404.
- [ ] Test 2 : Query strings n'affectent pas le résultat (catalogue complet retourné).
- [ ] Test 3 : Logique métier stable (calcul cohérent).
- [ ] Test 4 : `npm test` passe (3/3 tests).
- [ ] Test 5 : Serveur stable sous 100 requêtes.
- [ ] Test 5 : Port configurable via `PORT`.
- [ ] Documentation : README précise que la réservation (écriture) est absente.

**Signature** : Tous les points cochés = **recette passée** pour ce dépôt.

