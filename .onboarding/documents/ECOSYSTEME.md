# ECOSYSTEME — Shift Pilot Resa

> **Confiance : medium** — API pleinement documentée (`shift-pilot-resa-api`) ; interface front lue entièrement (`shift-pilot-resa-web`) ; tensions sémantiques identifiées sur la division de responsabilités (réservation absente des deux côtés).

## Workspaces couverts

- **shift-pilot-resa-api** — API HTTP Node.js natif exposant un catalogue de transferts inter-îles (lecture seule), trois trajets codés en dur avec prix et places restantes
- **shift-pilot-resa-web** — Interface web statique (HTML + JavaScript vanilla) affichant la liste des transferts en appelant l'API distante

## Dépendances entre workspaces

### shift-pilot-resa-web → shift-pilot-resa-api

**Ce qui est consommé** : un endpoint HTTP GET  
**Endpoint** : `GET /transfers`  
**Preuve dans le code** : 
- `shift-pilot-resa-web/js/app.js:6` — appel `fetch(\`${API_BASE_URL}/transfers\`)`
- `shift-pilot-resa-api/src/server.js:10-13` — implémentation de la route

**Contrat API réel** (reconstruction depuis les deux côtés) :

```http
GET /transfers
Host: <API_BASE_URL>  # configurable, par défaut localhost:3100
Content-Type: application/json

HTTP/1.1 200 OK
Content-Type: application/json

[
  { "id": 1, "from": "Papeete", "to": "Moorea", "price": 3500, "seatsLeft": 28 },
  { "id": 2, "from": "Papeete", "to": "Bora Bora", "price": 21000, "seatsLeft": 0 },
  { "id": 3, "from": "Raiatea", "to": "Tahaa", "price": 1800, "seatsLeft": 15 }
]
```

**Champs observés par le web** (`shift-pilot-resa-web/js/app.js:10-15`)) :
- `from` (string) — origine
- `to` (string) — destination  
- `price` (number) — tarif en XPF
- `availableSeats` (number) — places restantes

**Champs fournis par l'API** (`shift-pilot-resa-api/src/server.js:14-20`) :
- `id` (number) — identifiant du transfert
- `from` (string) — origine
- `to` (string) — destination
- `price` (number) — tarif
- `seatsLeft` (number) — places restantes

**Mismatch détecté** : le web attend `availableSeats`, l'API retourne `seatsLeft`. Quand le web accède `t.availableSeats`, la propriété manque et retourne `undefined` — l'affichage produit systématiquement `(undefined places)`. C'est un **bug actif**, non une coïncidence heureuse.

---

## Flux transversaux

### Consultation du catalogue de transferts

**Acteur** : Utilisateur final  
**Déclencheur** : Chargement de la page `shift-pilot-resa-web/index.html`  
**Type** : API GET (lecture seule)  
**Criticité** : Haute — c'est l'unique fonction métier du système en état pilote

#### Déroulement

1. **Chargement du navigateur** : l'utilisateur ouvre `index.html` ; le navigateur exécute `js/app.js`
2. **Résolution d'endpoint** : l'URL de l'API est résolue :
   - Priorité : valeur injectée dans `window.API_BASE_URL` (définie par l'environnement hôte)
   - Fallback : `http://localhost:3100` (développement local)
   - Preuve API : configurabilité du port via `process.env.PORT || 3100` (`shift-pilot-resa-api/src/server.js:26`)
3. **Requête HTTP** : fetch GET vers `${API_BASE_URL}/transfers`
4. **Résolution du routage API** : `shift-pilot-resa-api/src/server.js:10-13` vérifie le chemin et la méthode
5. **Récupération du catalogue** : `listTransfers()` (`shift-pilot-resa-api/src/transfers.js:9-11`) retourne les trois transferts en mémoire
6. **Transformation côté API** : calcul de `seatsLeft = seats - sold` pour chaque transfert (`shift-pilot-resa-api/src/transfers.js:13-15`) ; projection en JSON (champs `id`, `from`, `to`, `price`, `seatsLeft`)
7. **Sérialisation et envoi** : réponse HTTP 200 avec Content-Type `application/json`
8. **Parsing côté web** : `shift-pilot-resa-web/js/app.js:7` désérialise le JSON ; **aucune validation de schéma**
9. **Rendu côté web** : itération sur le tableau ; pour chaque transfert, affichage au format `${from} → ${to} — ${price} XPF (${availableSeats} places)` (`shift-pilot-resa-web/js/app.js:10-15`)
10. **Affichage à l'utilisateur** : liste HTML des transferts

### Cassures observées dans le flux

**1. Mismatch de noms de champ (bug actif)** : l'API retourne `seatsLeft`, mais le web affiche `t.availableSeats` (voir code ci-dessus). La propriété attendue n'existe pas dans la réponse JSON, donc `t.availableSeats` retourne `undefined`. En exécution réelle, chaque transfert affiche `(undefined places)` plutôt que le nombre de places restantes.

**2. Pas de gestion d'erreur côté web** : si l'API est injoignable (réseau, CORS, DNS), la promesse fetch est rejetée ; aucun `try...catch` dans `js/app.js` — la page affiche une liste vide et un message d'erreur dans la console uniquement (`shift-pilot-resa-web/js/app.js:5-16`). Expérience utilisateur dégradée.

**3. Pas de validation de réponse** : aucune vérification que la réponse est un tableau valide. Si l'API renvoie un objet comme `{ data: [...] }` ou un code d'erreur avec JSON, le `for...of` échoue silencieusement (`shift-pilot-resa-web/js/app.js:10-15`).

**4. Pas d'actualisation de l'offre** : une fois la page chargée, la liste reste figée. Le changement d'état du stock côté API (via une future route POST) ne remonte jamais au navigateur. À clarifier si la réservation devra déclencher une actualisation manuel ou un refresh automatique.

---

## Partage de données et états

### Stock de transferts

**Source unique de vérité** : `shift-pilot-resa-api/src/transfers.js:3-7` — tableau en mémoire contenant les trois transferts.

**Propriétés de stock** :
- `seats` (capacité totale) : jamais exposée en HTTP, jamais modifiée en runtime
- `sold` (places vendues) : jamais exposée en HTTP, jamais incrémentée en runtime (valeurs initiales : 12 pour Papeete→Moorea, 5 pour Raiatea→Tahaa, 60 pour Bora Bora)
- `seatsLeft` (dérivé) : calculé à la demande, exposé dans chaque réponse

**Visualisation côté web** : le web reçoit `seatsLeft` et l'affiche ; aucune persistance locale.

**Conséquence d'absence de réservation** : bien que `shift-pilot-resa-api` expose un champ `sold` sémantiquement lié à la réservation, aucune route n'existe pour l'incrémenter. Le web ne peut pas réserver. Les "places vendues" restent figées à l'état initial.

---

## Périmètre délimité entre workspaces

### Responsabilités de shift-pilot-resa-api

- ✓ Maintenir le catalogue de transferts en mémoire
- ✓ Calculer et exposer `seatsLeft` pour chaque transfert
- ✓ Répondre aux requêtes HTTP GET /transfers avec un schéma de réponse cohérent
- ✗ **Prise de réservation** : aucune route POST, aucune mutation du stock
- ✗ **Persistance durable** : données perdues au redémarrage

### Responsabilités de shift-pilot-resa-web

- ✓ Charger et afficher la liste des transferts
- ✓ Accepter l'injection de l'endpoint API via une variable globale pour multienvironnement (dev/staging/prod)
- ✓ Mettre en forme l'affichage pour l'utilisateur final
- ✗ **Réservation** : aucun formulaire, aucun bouton d'action
- ✗ **Filtrage/tri** : affichage au format reçu de l'API, dans l'ordre renvoyé
- ✗ **Gestion d'erreur** : aucune robustesse réseau

---

## Questions ouvertes

### 1. **Réservation : dans quel workspace ?**
- `shift-pilot-resa-api` porte le nom « resa » (réservation) mais n'implémente **pas** la prise de réservation
- `shift-pilot-resa-web` promet une « interface de réservation » dans son README mais n'a **pas** d'interface de prise de réservation
- **Clarification requise** : la fonctionnalité est-elle prévue mais hors périmètre du pilote ? Vit-elle dans un autre workspace ?

### 2. **Mismatch de noms de champ : design intentionnel ou bug ?**
- API retourne `seatsLeft` ; web affiche `t.availableSeats`
- Les deux noms n'apparaissent jamais dans la même propriété JSON
- **Impact** : en pratique, `t.availableSeats` est `undefined` ; le web affiche `"(undefined places)"`
- **Clarification requise** : Faut-il renommer `seatsLeft` en `availableSeats` dans l'API, ou renommer dans le web ?

### 3. **Robustesse réseau côté web**
- Le web n'a aucune gestion d'erreur en cas d'API injoignable
- Comment l'utilisateur sait-il que la liste vide est due à un échec réseau plutôt qu'une offre vide ?
- **Clarification requise** : Faut-il ajouter un affichage d'erreur ou une page de fallback ?

### 4. **Actualisation de l'offre après réservation**
- Une fois la page chargée, la liste ne se recharge jamais
- Si une réservation est implémentée, comment le web saura-t-il qu'une place est vendormais ?
- **Clarification requise** : bouton refresh manuel ? Polling périodique ? WebSocket ?

### 5. **Port de l'API en production**
- Le web fallback à `localhost:3100` ; en production, comment `window.API_BASE_URL` est-elle injectée ?
- Aucun fichier de déploiement (Dockerfile, nginx config) trouvé dans les deux repos
- **Clarification requise** : mécanisme d'injection d'endpoint, configuration d'infrastructure

### 6. **Devise : XPF documentée ou supposée ?**
- L'API expose `price: 3500` sans unité
- Le web affiche `"3500 XPF"` — l'unité est codée en dur dans le template
- **Clarification requise** : documenter la devise dans l'API ou laisser le web la supposer ?

### 7. **Autres champs du catalogue**
- L'API retourne 5 champs (`id`, `from`, `to`, `price`, `seatsLeft`)
- Le web n'en utilise que 4 (pas `id`)
- **Clarification requise** : l'`id` est-il utile pour la réservation future ? Faut-il ajouter horaires, compagnie, durée ?

---

## Synthèse : un système incomplet mais articulé

**shift-pilot-resa** est un pilote de démonstration SHIFT/Paperclip composé de deux workspaces clairement séparés :

- **API** : fournit l'offre en lecture seule, avec un contrat HTTP bien délimité mais un nom sémantiquement trompeur (« resa » = réservation, absente du code)
- **Web** : consomme l'API et l'affiche à l'utilisateur final ; absence de tout contrôle d'erreur et de toute capacité d'écriture

Le **flux central** (consultation du catalogue) fonctionne, mais en mode dégradé (mismatch de noms de champs, pas d'erreur utilisateur, perte de données au redémarrage). Les **tensions principales** portent sur le **positionnement de la réservation** (nulle part implémentée) et sur la **robustesse end-to-end** (le web affiche une liste vide sans distinguer un échec réseau d'une offre vide).

Les deux dépôts **doivent être déployés ensemble** pour que le système fonctionne : ni l'un ni l'autre n'a de valeur isolé.
