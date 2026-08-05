# Relecture — CARTE_DES_DOMAINES.md

> Relecteur : Relecteur de domaines (agent `2f9907e0`) — modèle `claude-sonnet-4-6`  
> Producteur : Découverte de domaines (agent `5c5239ec`) — modèle différent  
> Dépôt : `shift-pilot-resa-api`  
> Date : 2026-08-05

## Verdict global

**Bon** — La carte est exploitable sans réserve bloquante. Tous les domaines sont prouvés code, toutes les références de ligne vérifiées exactes, les niveaux de confiance sont calibrés honnêtement sur la matière disponible. Le producteur a correctement signalé en « Incertitudes » la seule zone de flou structurel (fusion possible de deux domaines sur la même entité) : transparence conforme aux attentes.

---

## Problèmes bloquants

*Aucun.*

---

## Problèmes mineurs

*Aucun.*

---

## Points vérifiés et corrects

**Grille appliquée — 8 contrôles, 8 passés.**

### 1. Chaque domaine est prouvé

Ouverture de chaque fichier source cité et vérification ligne par ligne :

| Domaine | Preuve vérifiée |
|---|---|
| `catalogue-transferts` | `src/transfers.js:3-7` → tableau `transfers` (3 trajets, champs `id/from/to/seats/sold/price`). `src/transfers.js:9-11` → `listTransfers()`. `src/server.js:13-20` → route `GET /transfers` avec projection `id/from/to/price/seatsLeft`. ✓ |
| `disponibilite-places` | `src/transfers.js:13-15` → `seatsLeft(transfer) = seats - sold`. `src/transfers.js:17-19` → `isFull(transfer) = seatsLeft === 0`. `src/server.js:3` → seul `listTransfers` et `seatsLeft` importés (pas `isFull`), confirmant que `isFull` n'est pas câblé à une route. `test/transfers.test.js:5-12` → `isFull` testé uniquement ici. ✓ |
| `exposition-http-api` | `src/server.js:1-30` relu en entier. `sendJson` : lignes 5-8. `http.createServer` : ligne 10. Routage `url.pathname`/`req.method` : lignes 11-13. 404 : ligne 23. `PORT`/`listen` : lignes 26-29. `module.exports = server` : ligne 30 (exportable pour tests d'intégration éventuels). ✓ |
| `qualite-tests` | `test/transfers.test.js:1-17` relu. 3 tests (`seatsLeft` l.5-7, `isFull` l.9-12, `listTransfers` l.14-16). `package.json:6` → `"test": "node --test test/"`. ✓ |

### 2. Indices de rattachement testés

- `transfers`/`transfer`/`from`/`to`/`price` → présents uniquement dans `src/transfers.js` et `src/server.js`. N'inondent pas le repo.
- `seats`/`sold`/`seatsLeft`/`isFull` → cantonnés à `src/transfers.js` et `test/transfers.test.js`.
- `http`/`createServer`/`sendJson`/`url.pathname`/`PORT` → cantonnés à `src/server.js`.
- `node:test`/`node:assert`/`.test.js` → cantonnés à `test/`.

Aucun indice ne dépasse son domaine. ✓

### 3. Granularité (4 domaines)

4 domaines sur un dépôt de 3 fichiers source (~68 lignes de code) est en bas de la fourchette attendue (4–12), ce qui est **cohérent** avec la nature pilote. Le producteur a signalé lui-même la frontière floue entre `catalogue-transferts` et `disponibilite-places` (même entité, même fichier, même route) dans la section « Incertitudes » : l'honnêteté de ce signalement justifie de conserver la carte telle quelle, la décision de fusion appartenant à la prochaine correction si le coordinateur l'estime utile. ✓

### 4. Cœurs corrects

Deux domaines marqués « cœur » (`catalogue-transferts` et `disponibilite-places`). Justifié : l'API se nomme « resa/réservation », le catalogue est la raison d'être du service, la disponibilité est le versant occupation du produit. `exposition-http-api` et `qualite-tests` marqués « support » : exact. ✓

### 5. Oublis

Exploration indépendante du dépôt :
- `src/server.js:30` → `module.exports = server` : non couvert par une route existante, mais correctement compris dans `exposition-http-api` (couche HTTP transverse). ✓
- Aucun autre fichier source, contrôleur, job, intégration ou module non couvert détecté.
- Aucun domaine manquant. ✓

### 6. Techniques séparés du métier

`exposition-http-api` est catégorisé « technique / support » et n'est pas fondu dans un domaine métier. Conforme. ✓

### 7. Confiances et incertitudes honnêtes

| Domaine | Confiance affichée | Justification vérifiée |
|---|---|---|
| `catalogue-transferts` | `high` | Preuve directe et complète (`VÉRIFIÉ_CODE`). ✓ |
| `disponibilite-places` | `medium` | Justifié : le champ `sold` n'est jamais incrémenté par le code existant (aucun `POST`/`PUT`/`PATCH`/`DELETE` dans `src/`). grep confirmé : zéro hit pour `POST|PUT|DELETE|PATCH|book|reserv|resa` dans `src/` et `test/`. ✓ |
| `exposition-http-api` | `high` | Preuve exhaustive (`src/server.js` lu en intégralité). ✓ |
| `qualite-tests` | `low` | Justifié : 3 tests logique pure, aucune couverture HTTP. ✓ |

Section « Incertitudes » complète et non gonflée : 4 incertitudes légitimes, toutes vérifiables. ✓

### 8. Dépend de la base : honnêteté du champ

Tous les domaines marqués `non`. Vérification : aucun ORM, aucune chaîne de connexion, aucune migration, aucun schéma DB dans le dépôt (`package.json` : zéro dépendance externe). ✓

---

## Recommandations de correction

*Aucune correction demandée.* Le producteur peut soumettre la carte pour publication.

Note pour le coordinateur : la question de fusion `catalogue-transferts` + `disponibilite-places` est délibérément laissée ouverte par le producteur dans les « Incertitudes ». Si les analyses de workflow aval montrent que les deux domaines partagent systématiquement les mêmes workflows, une consolidation en v2 de la carte serait bienvenue — mais ce n'est pas un défaut bloquant à ce stade.
