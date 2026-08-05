# ECOSYSTEME — shift-pilot-resa

> Confiance : medium

## Workspaces couverts

- **shift-pilot-resa-api** — API backend Node.js minimaliste exposant le catalogue de transferts inter-îles avec calcul de disponibilité en temps réel
- **shift-pilot-resa-web** — Interface HTML/JS statique affichant le catalogue en consultation de lecture seule

## Dépendances entre workspaces

**shift-pilot-resa-web → shift-pilot-resa-api** :
- **Consommé** : endpoint HTTP `GET /transfers` retournant un tableau JSON des transferts disponibles
- **Format attendu du contrat** (d'après `CDC_FONCTIONNEL.md` du web) : tableau d'objets avec au minimum `{ from: string, to: string, price: number, availableSeats: number }`
- **API expose en réalité** (`CDC_FONCTIONNEL.md` de l'API) : `{ id, from, to, price, seatsLeft }` — les champs `from`, `to`, `price` correspondent, **mais le champ d'API `seatsLeft` est mappé côté front sur `availableSeats`** (correspondance implicite, cf. ci-dessous).
- **Preuve** : 
  - `shift-pilot-resa-api:server.js:14-20` — construction de la projection JSON `{ id, from, to, price, seatsLeft }`
  - `shift-pilot-resa-web:js/app.js:13` — accès à `t.availableSeats` lors du rendu

### Risque de contrat implicite

Le front accède à `t.availableSeats` ; l'API retourne `t.seatsLeft`. **Divergence de noms de champs** — la divergence est effective dès maintenant : le front lit `t.availableSeats` qui n'existe pas dans la réponse API, et affiche `undefined` pour le nombre de places. Aucune documentation explicite ne fixe le contrat.

## Flux transverses

### Flux principal : Affichage du catalogue de transferts inter-îles

**Acteurs** : voyageur (utilisateur final) → front web → API backend  
**Criticité** : HAUTE — c'est l'unique cas d'usage du système en l'état  
**Confiance** : medium

**Déroulement** :

1. Voyageur accède à la page `index.html` du frontend (domaine `shift-pilot-resa-web`)
2. Le navigateur charge et exécute `js/app.js` qui configure l'URL de base de l'API via `window.API_BASE_URL` (fallback sur `http://localhost:3100`)
3. Au chargement du DOM (`DOMContentLoaded`), le front appelle `fetch('${API_BASE_URL}/transfers')`
4. L'API (`shift-pilot-resa-api`) reçoit la requête `GET /transfers` sur le port 3100 (ou autre selon déploiement)
5. Le serveur API (`server.js:13-20`) valide la route, appelle `listTransfers()` du module de domaine, calcule `seatsLeft` pour chaque transfert
6. L'API sérialise le tableau projeté en JSON et retourne statut 200 avec Content-Type `application/json`
7. Le front désérialise la réponse et boucle sur chaque transfert pour créer un `<li>` affiché dans la liste (`index.html:9`)
8. **Résultat observé par le voyageur** : liste des 3 transferts avec origines, destinations, prix en XPF et places disponibles

**État retourné par l'API** (d'après audit du web) — NB : ces places ne s'affichent pas à l'écran du voyageur en l'état actuel, en raison de la divergence `seatsLeft` / `availableSeats` (cf. section « Risque de contrat implicite ») :
```
Papeete → Moorea — 3500 XPF (28 places)
Papeete → Bora Bora — 21000 XPF (0 places)
Raiatea → Tahaa — 1800 XPF (15 places)
```

## Intégrations et déploiement

### Configuration de l'URL de l'API côté front

Le front a besoin de savoir où joindre l'API :
- **Développement** : fallback hardcodé sur `http://localhost:3100` (`js/app.js:4`)
- **Production** : `window.API_BASE_URL` injecté par la page hôte (mécanisme non versionné dans ce dépôt)

**Hypothèse déploiement** : l'API tourne sur l'origine `http://localhost:3100` (ou équivalent en prod) ; le front l'atteint soit par proxy inverse (même origine) soit par une URL absolue distincte (nécessiterait CORS).

### CORS et cross-origin

**Risque identifié** (PROJECT_CONTEXT.md de l'API) :
- L'API n'expose aucun header `Access-Control-Allow-Origin`
- Si le front tourne sur une origine différente de l'API (ex. `http://localhost:3000` vs `http://localhost:3100`), le navigateur bloquera la requête `fetch()` par politique CORS
- **Statut** : pas de blocker visible en développement local (même machine, localhost par défaut), mais critique si déploiement sur origines séparées

**Décision attendue** : 
1. Les deux services tournent sur la même origine (proxy reverse)? Aucun header CORS nécessaire.
2. Origines séparées? Ajouter `Access-Control-Allow-Origin: *` (ou spécifiée) à `server.js:5-8` de l'API.

## Robustesse de l'intégration

### Points fragiles côté API → front

| Risque | Gravité | Détail |
|--------|---------|--------|
| **Crash URL malformée** | Critique | `server.js:11` parse l'URL sans `try/catch`. Fuzzing ou requête HTTP/0.9 fera crasher le process. Impact : service complètement down. Preuve : `PROJECT_CONTEXT.md` API, section « Crash sur URL malformée ». |
| **Données statiques** | Medium | `sold` jamais incrémenté → `seatsLeft` figé. Si le front présente cette info comme « temps réel », c'est trompeur. Acceptable en pilote. |
| **Absence `isFull` câblée** | Low | Fonction exportée mais non utilisée. Front ne l'appelle pas, peut être ignorée pour l'instant. |

### Points fragiles côté front → utilisateur

| Risque | Gravité | Détail |
|--------|---------|--------|
| **API injoignable : aucune gestion d'erreur** | Medium | `fetch()` sans `try/catch`. Si l'API est down, l'utilisateur voit une liste vide sans message d'erreur. Indéterminable d'une liste réellement vide. Preuve : `CDC_FONCTIONNEL.md` web, section « Cas : API injoignable ». |
| **Champs API manquants** | Medium | Front accède directement à `t.availableSeats` sans vérification. L'API retourne actuellement `seatsLeft` — le champ attendu n'existe pas. Tout changement de nom supplémentaire aggraverait l'écart existant. Preuve : `CDC_FONCTIONNEL.md` web, section « Cas : Transfert avec champ(s) manquant(s) ». |
| **Réponse non-itérable** | Low | Front suppose `transfers` est un tableau et boucle sans validation. Si l'API retourne un objet ou `null`, erreur JavaScript non capturée. |

## Données partagées et contrat implicite

### Catalogue de transferts

Le catalogue est **défini côté API** (3 transferts en dur) et **consommé côté front** :
- Transferts : Papeete↔Moorea, Papeete↔Bora Bora, Raiatea↔Tahaa
- Champs affichés au front : `from`, `to`, `price`, `availableSeats` (aka `seatsLeft` côté API)
- Projection API masque intentionnellement `seats` et `sold` (données internes)

**Contrat implicite** : la forme retournée par `GET /transfers` doit correspondre à ce que le front attend. Divergence de noms de champs = panne silencieuse (champs undefined).

## Questions ouvertes et dépendances externes

1. **Nom du champ disponibilité — DIVERGENCE CONFIRMÉE**  
   L'API expose `seatsLeft` ; le front consomme `availableSeats` — cette divergence est établie par le code et actuellement effective. Quel nom retenir pour l'harmonisation (recommandation : `availableSeats` plus lisible en public)?
   - Impact : actuellement, la page affiche `undefined places` au lieu du nombre
   - **Résolution attendue** : harmoniser les noms et resynchroniser les deux implémentations

2. **Configuration d'URL API en production**  
   Le mécanisme `window.API_BASE_URL` n'est pas versionné. Comment cette variable est-elle injectée lors du déploiement (templating, script inline, header)?
   - Impact : mauvaise URL = API injoignable
   - **Résolution attendue** : documenter le processus de déploiement (ou la vérifier par intégration)

3. **Architecture de déploiement (same-origin vs. cross-origin)**  
   Les deux services partagent-elles l'origine HTTP, ou tournent-elles sur des ports/domaines distincts?
   - Impact : cross-origin sans CORS = requête bloquée par le navigateur
   - **Résolution attendue** : décider de la topologie, ajouter CORS si nécessaire

4. **Persistance et synchronisation de `sold`**  
   Le champ `sold` est hardcodé et jamais incrémenté. Sera-t-il incrément par un endpoint de réservation côté API (not yet implemented), ou synchronisé depuis un système externe?
   - Impact : « disponibilité temps réel » reste théorique tant que `sold` ne change pas
   - **Résolution attendue** : clarifier le modèle de réservation (voir `CDC_FONCTIONNEL.md` de l'API, section « Questions ouvertes »)

5. **Superviseur et résilience**  
   Qui superviseur le process `node src/server.js`? Crash → restart automatique ou manual intervention?
   - Impact : incident API non contenu
   - **Résolution attendue** : vérifier qu'un gestionnaire de process (PM2, systemd, Docker restart policy) est en place

6. **Réservation : côté API ou côté front dans une itération future?**  
   Le `README.md` du web annonce une « interface de réservation » que le code ne contient pas. Où vit la logique : API future endpoint, ou ajout au front plus tard?
   - Impact : dépendance architecturale entre les deux workspaces pour la prochaine phase
   - **Résolution attendue** : clarifier la décision de design (cf. `PROJECT_CONTEXT.md` du web, section « Écarts et incertitudes »)

## Résumé de confiance

| Aspect | Confiance | Justification |
|--------|-----------|--------------|
| **Flux nominal** (affichage du catalogue) | high | Code simple, audité, fonctionnel en local |
| **Contrat de l'API** | medium | Noms de champs potentiellement désynchronisés (`seatsLeft` vs `availableSeats`) |
| **Déploiement** | medium | Configuration d'URL et CORS dépendent d'infrastructure externe non versionnée |
| **Robustesse** | medium | Gestion d'erreur minimale, crash API non contenu, front sans message utilisateur |
| **Intégration systémique** | medium | Deux workspaces fonctionnels indépendamment, dépendance API→front claire, mais points critiques latents (CORS, URL config) |

**Profondeur** : Ce document synthétise les relations entre workspaces. Les détails des implémentations individuelles (architecture, risques internes, dette technique de chaque côté) sont couverts par `CDC_FONCTIONNEL.md` et `PROJECT_CONTEXT.md` de chaque workspace — lire ces deux fichiers pour comprendre le contexte global.
