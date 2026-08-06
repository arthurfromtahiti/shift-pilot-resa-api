# ECOSYSTEME — Shift Pilot Resa (API + Web)

> **Confiance** : medium

---

## Workspaces couverts

- **shift-pilot-resa-api** — Service HTTP backend, Node.js natif sans framework. Expose le catalogue de transferts inter-îles et gère les réservations en temps réel (données en mémoire, volatiles au redémarrage).
- **shift-pilot-resa-web** — Interface web statique HTML/JS, aucune dépendance. Affiche le catalogue de transferts en interrogeant l'API. Consultation uniquement (réservation absent du code).

---

## Dépendances entre workspaces

### Web → API (consommation)

**Endpoint 1 : GET /transfers (consultation catalogue)**
- **Consumé par** : `shift-pilot-resa-web/js/app.js`, fonction `loadTransfers()` (ligne 5–15)
- **Contrat implicite** :
  - Requête : GET sur `${window.API_BASE_URL}/transfers` (fallback `http://localhost:3100`)
  - Réponse 200 : tableau JSON de transferts
  - Champs attendus du frontend : `from`, `to`, `price`, `availableSeats`
  - Champs réellement produits par l'API : `id`, `from`, `to`, `price`, `seatsLeft` (**DIVERGENCE : voir risques**)
- **Implémentation API** : `shift-pilot-resa-api/src/server.js:10–20` (route GET /transfers)
- **Usage** : rendu DOM pour chaque transfert (`<li>Papeete → Moorea — 3500 XPF (X places)</li>`)

**Endpoint 2 : POST /transfers/:id/reserve (réservation)**
- **Consumé par** : aucun (formulaire absent du frontend — statut TODO SHIAAAAAAAAAAAAAAAAAAAAAAAA-61)
- **Contrat** :
  - Requête : POST sur `${API_BASE_URL}/transfers/{id}/reserve` avec body JSON optionnel `{ seats: N }`
  - Réponse 200 : `{ transferId: N, seatsLeft: X }`
  - Erreur 404 : transfert inexistant
  - Erreur 409 : plus de places disponibles
- **Implémentation API** : `shift-pilot-resa-api/src/server.js:23–41` (route POST /transfers/:id/reserve)
- **Usage** : réservation côté client une fois le formulaire ajouté au frontend
- **État de maturité** : API fonctionnel, UI à implémenter

---

## Flux transverses (articulation métier)

### Flux 1 : Affichage du catalogue (parcours voyageur)

**Séquence** :
1. Voyageur ouvre la page web (`index.html`)
2. Frontend (`js/app.js`) émet GET /transfers
3. API retourne tableau de 3 transferts avec disponibilités (en mémoire)
4. Frontend rendu catalogue dans la `<ul id="transfers-list">`
5. Voyageur voit liste de transferts, prix, places libres

**Points clés** :
- Découplage complet : API ne connaît pas le frontend, frontend ignore les détails internes de l'API
- Contrat API-client exprimé implicitement dans le code (`js/app.js:13` accède aux champs)
- Dépendance réseau critique : si API injoignable → liste vide sans message d'erreur

**Données partagées** :
```
Transfer {
  id: 1..3,
  from: "Papeete" | "Raiatea",
  to: "Moorea" | "Bora Bora" | "Tahaa",
  price: 1800 | 3500 | 21000 (XPF),
  availableSeats: 0..28  // Attendu par frontend
  seatsLeft: 0..28       // Produit par API (même sémantique; voir transfers.js:3-6 pour capacités réelles)
}
```

### Flux 2 : Réservation de places (parcours voyageur — futur)

**Séquence (potentielle, une fois formulaire implémenté)** :
1. Voyageur remplit formulaire réservation (transfert ID + nombre de places)
2. Frontend émet POST /transfers/{id}/reserve avec body `{ seats: N }`
3. API valide disponibilité, décrémente compteur `sold` en mémoire
4. API retourne 200 avec `{ transferId, seatsLeft }` (nouvelles places libres)
5. Frontend affiche confirmation et optionnellement rafraîchit la liste
6. Autres voyageurs doivent recharger manuellement la page — aucun mécanisme de rafraîchissement (polling, WebSocket) n'existe dans le code

**Invariant métier** :
- Places vendues + places libres = capacité totale (stockée comme `seatsLeft = seats - sold`)
- Aucune réservation si places libres insuffisantes (garde dans `bookSeats()`, `src/transfers.js:24`)

**État côté serveur** :
- Chaque réservation décrémente le compteur du transfert
- Redémarrage du process perd toutes les réservations (données volatile, acceptable pour pilote)
- Pas de persistance cross-process

---

## Risques et divergences (blocages et questions)

### Risque 1 : Divergence de noms de champs (CRITIQUE DÉJÀ IMPACTÉ)

**Le problème** :
- API expose `seatsLeft` dans la réponse GET /transfers (implémentation : `src/server.js:19`)
- Frontend attend `availableSeats` pour affichage (code : `js/app.js:13`, `t.availableSeats`)
- Résultat : frontend affiche `undefined places` au lieu du nombre réel

**Preuve** :
- API (`src/server.js:14–20`) : projection `{ id, from, to, price, seatsLeft }`
- Frontend (`js/app.js:13`) : template `${t.availableSeats} places`
- Tests : API testé en isolation (200 OK, JSON valide) ; pas de test d'intégration end-to-end

**Impact en production** :
- Catalogue affichable en lecture seule — le champ de disponibilité manquant n'empêche pas le rendu textuel basique
- Affichage cosmétique cassé : "Papeete → Moorea — 3500 XPF (undefined places)"
- Confiance métier réduite : données sensoriellement inactives

**Recommandation** :
- **Option A** (préféré) : Renommer côté API en `availableSeats` (un mot moins technique)
- **Option B** : Mettre à jour le frontend pour accéder à `seatsLeft`
- **Décision** : À prendre, bloque la livraison end-to-end

### Risque 2 : Absence CORS (CRITIQUE POUR DÉPLOIEMENT MULTI-DOMAINE)

**Le problème** :
- API (`src/server.js`) n'expose aucun header `Access-Control-Allow-Origin`
- Frontend sur domaine/port différent (ex. localhost:3000 vs localhost:3100 en dev)
- Navigateur refuse requête cross-origin (CORS policy)

**Preuve** :
- Implémentation : `src/server.js` retourne 200 + JSON, mais zéro header CORS
- Comportement réseau : requête fetch est blocquée côté navigateur avant d'arriver à l'app
- Non testé en intégration multi-domaine

**Impact en production** :
- Si API et frontend déployés sur origines différentes → toutes les requêtes bloquées navigateur
- Liste vide, aucun message d'erreur visible
- Correctif simple mais requis avant tout déploiement

**Recommandation** :
- Ajouter `res.setHeader('Access-Control-Allow-Origin', '*')` ou domaine spécifié dans l'endpoint GET /transfers
- Traiter aussi les requêtes OPTIONS (preflight) si HEAD ou headers personnalisés ajoutés à l'avenir
- Tester en intégration avec frontend sur port différent avant livraison

### Risque 3 : Validation manquante sur `seats` (CRITIQUE POUR DONNÉES)

**Le problème** :
- API accepte `seats` négatif, zéro ou absent dans POST /transfers/:id/reserve
- Pas de vérification `Number.isInteger(seats) && seats >= 1`
- Valeur par défaut silencieuse (`undefined → 1`) masque bugs clients

**Preuve** :
- Implémentation : `src/server.js:32` extrait `parsed.seats` sans validation
- Fallback : `const seats = parsed.seats ?? 1` (nullish coalescing, `src/server.js:36`)
- Risque : `POST /transfers/1/reserve body={"seats":-5}` décrémente le stock (inversé)

**Impact** :
- Stock peut descendre sous zéro (violation invariant)
- Client mal écrit envoyant `-5` crée un overbooking caché
- Chaîne d'intégration ne détecte le bug que si test avec valeurs négatives explicites

**Recommandation** :
- Valider et rejeter 400 si `seats` n'est pas un entier ≥ 1
- Ajouter test de régression `POST /transfers/1/reserve body={"seats":-1}` attendant 400

### Risque 4 : Formulaire réservation absent du frontend (FONCTIONNEL)

**Le problème** :
- Endpoint POST /transfers/:id/reserve implémenté et testé côté API
- Aucun formulaire HTML côté frontend pour déclencher la réservation
- README.md annonce « interface de réservation » mais code contient seulement la consultation

**Preuve** :
- Frontend : `index.html` ne contient aucun formulaire, bouton, ou champ input
- Frontend : `js/app.js` n'a pas de fonction `reserve()` ou écoute d'événement
- Workflow SHIAAAAAAAAAAAAAAAAAAAAAAAA-61 marque `Frontend réservation: TODO`

**Impact** :
- Voyageur ne peut pas réserver depuis le web
- Réservation possible via CLI/API directement (test), mais pas via produit
- Écart entre annonce fonctionnelle et implémentation

**Statut** :
- Accepté pour pilote (MVP : consultation seule)
- À lister comme évolution : SHIAAAAAAAAAAAAAAAAAAAAAAAA-XXX Ajouter formulaire réservation côté frontend

### Risque 5 : Configuration d'URL API non versionnée (DÉPLOIEMENT)

**Le problème** :
- Frontend utilise `window.API_BASE_URL` injecté par la page hôte (fallback `http://localhost:3100`)
- Mécanisme d'injection en production non versionné dans les dépôts
- Dépendance tacite : serveur qui sert `index.html` doit injecter une `<script>` ou un template avant le chargement du JS

**Preuve** :
- Frontend (`js/app.js:1`) : `const API_BASE_URL = (typeof window !== "undefined" && window.API_BASE_URL) || "http://localhost:3100"`
- Aucun build step, aucun env var, aucun fichier `.env` versionnés
- Infrastructure : comment est injectée `window.API_BASE_URL` ? Réponse : inconnue

**Impact** :
- Développeur en local : URL OK (fallback localhost:3100)
- Déploiement test/prod : si injection oubliée → frontend appelle localhost:3100 au lieu du serveur réel
- Debugging difficile : erreur silencieuse (liste vide, aucun message réseau)

**Recommandation** :
- Documenter le mécanisme d'injection (ex. : `<script>window.API_BASE_URL="https://api.prod.example.com"</script>` avant `app.js`)
- Ou migrer vers fichier `config.json` servi par le serveur
- Ajouter un test d'intégration : vérifier que l'API correcte est interrogée en fonction de `window.API_BASE_URL`

---

## Questions ouvertes (décisions attendues)

1. **Harmonisation du champ dispo** (BLOCAGE FONCTIONNEL)
   - Utiliser `availableSeats` ou `seatsLeft` comme nom canonical ?
   - Impact : changer soit l'API, soit le frontend
   - **Deadline** : avant d'ajouter la réservation UI (sinon incompatibilité)

2. **Authentification pour les réservations** (ARCHITECTURE)
   - Réservation actuellement anonyme (pas d'authentification API)
   - Acceptable pour pilote ?
   - Si non, où vit l'authentification : token JWT dans header, session cookie, autre ?

3. **Ajout formulaire réservation côté frontend** (SCOPE)
   - À implémenter dans quelle itération (avant/après premier pilote) ?
   - Formulaire simple (ID transfert + nombre places) ou multi-étape ?

4. **Déploiement multi-domaine** (INFRASTRUCTURE)
   - Comment sont déployés API et frontend : même origine ou séparé ?
   - Qui contrôle les headers CORS en production ?

5. **Persistance des réservations** (FUTUR)
   - Redémarrage API perd les réservations (acceptable pour pilote)
   - Quand migrate-t-on vers une base de données ? Avant montée en charge ou après ?

---

## Schéma d'intégration (local & production)

### Développement local

```
voyageur → navigateur:3000
           ↓ fetch GET /transfers
           API:3100
           ↓ réponse JSON
           ↑ affiche liste
```

**Configuration** : Frontend fallback `http://localhost:3100`

### Production (hypothèse)

```
voyageur → reverse proxy / serveur web (port 443 HTTPS)
           ├─ GET /index.html → sert HTML + injecte window.API_BASE_URL = "https://api.example.com"
           └─ Frontend fetch → API HTTPS (cross-origin)
           
           ↓ GET /transfers
           
           API backend (port 443 HTTPS, domaine séparé ou même)
```

**Configuration requise** : CORS headers si API sur domaine/port différent

---

## Validations de contrat (checklist d'intégration)

Avant de déclarer le flux end-to-end fonctionnel :

- [ ] **API GET /transfers retourne champ `availableSeats` (harmonisé nom)**
- [ ] **API GET /transfers inclut header `Access-Control-Allow-Origin`**
- [ ] **API POST /transfers/:id/reserve valide `seats >= 1` et rejette 400 si invalide**
- [ ] **Frontend récupère et affiche les 4 champs sans `undefined`**
- [ ] **Test d'intégration** : appel GET depuis navigateur sur port différent, validate réponse, affichage OK
- [ ] **Formulaire réservation implémenté** ou issue de suivi créée avec priorité documentée
- [ ] **Documentation déploiement** : mécanique d'injection `window.API_BASE_URL` versionnée ou CI/CD décrite

