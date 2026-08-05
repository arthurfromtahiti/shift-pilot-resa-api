# Relecture — CARTE_DES_DOMAINES.md

> Relecteur : Relecteur de domaines (agent `3a14efea`) — modèle `claude-sonnet-4-6`
> Producteur : Découverte de domaines (agent `d910e19c`) — modèle différent
> Dépôt : `shift-pilot-resa-api`
> Date : 2026-08-05
> Mode : réconciliation (zéro drift détecté entre `main` et `onboarding/artifacts`)

## Verdict global

**Bon** — La carte est exploitable sans réserve bloquante. Vérification indépendante des 8 contrôles sur le code source réel (`main`, SHA `5e984c5`) : tous passés. Les références de lignes sont exactes, les niveaux de confiance calibrés honnêtement, aucune incertitude dissimulée. Le signalement explicite de la frontière floue `catalogue-transferts`/`disponibilite-places` dans la section « Incertitudes » est correct et honnête.

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

Vérification ligne par ligne sur chaque fichier source cité (branche `main`) :

| Domaine | Preuve vérifiée |
|---|---|
| `catalogue-transferts` | `src/transfers.js:3-7` → tableau `transfers` (3 lignes, champs `id/from/to/seats/sold/price` confirmés). `src/transfers.js:9-11` → `listTransfers()`. `src/server.js:13-20` → `GET /transfers` avec projection `id/from/to/price/seatsLeft`. ✓ |
| `disponibilite-places` | `src/transfers.js:13-15` → `seatsLeft(t) = t.seats - t.sold`. `src/transfers.js:17-19` → `isFull(t) = seatsLeft(t) === 0`. `src/server.js:3` → seul `listTransfers` et `seatsLeft` importés, confirme que `isFull` n'est pas câblé à une route. `test/transfers.test.js:5-12` → `isFull` testé ici seulement. ✓ |
| `exposition-http-api` | `src/server.js` lu en entier (30 lignes). `sendJson` : l.5-8. `http.createServer` : l.10. Routage `url.pathname`/`req.method` : l.11-13. 404 : l.23. `PORT`/`listen` : l.26-29. `module.exports = server` : l.30. ✓ |
| `qualite-tests` | `test/transfers.test.js:1-16` relu. 3 tests (`seatsLeft` l.5-7, `isFull` l.9-12, `listTransfers` l.14-16). `package.json` → `"test": "node --test test/"`. ✓ |

### 2. Indices de rattachement testés

- `transfers`/`from`/`to`/`price` → cantonnés à `src/transfers.js` et `src/server.js`. Ne débordent pas.
- `seats`/`sold`/`seatsLeft`/`isFull` → cantonnés à `src/transfers.js` et `test/transfers.test.js`.
- `http`/`createServer`/`sendJson`/`url.pathname`/`PORT` → `src/server.js` uniquement.
- `node:test`/`node:assert`/`.test.js` → `test/` uniquement.

Aucun indice n'inonde le repo. ✓

### 3. Granularité

4 domaines pour 3 fichiers source (~68 lignes) : en bas de la fourchette 4–12, cohérent avec la nature pilote. La frontière floue `catalogue-transferts`/`disponibilite-places` est signalée dans les « Incertitudes » — honnêteté correcte, décision de fusion éventuelle laissée au coordinateur. ✓

### 4. Cœurs corrects

`catalogue-transferts` et `disponibilite-places` marqués « cœur » : justifié (raison d'être du service + versant occupation). `exposition-http-api` et `qualite-tests` marqués « support » : exact. ✓

### 5. Oublis

Exploration indépendante : `src/server.js`, `src/transfers.js`, `test/transfers.test.js`, `package.json`, `README.md` — tout est couvert. Aucun contrôleur, job, intégration ou module non attribué. ✓

### 6. Techniques séparés du métier

`exposition-http-api` catégorisé « technique / support », non fusionné au métier. ✓

### 7. Confiances et incertitudes honnêtes

| Domaine | Confiance | Justification vérifiée |
|---|---|---|
| `catalogue-transferts` | `high` | Preuve complète et directe (`VÉRIFIÉ_CODE`). ✓ |
| `disponibilite-places` | `medium` | Champ `sold` jamais incrémenté dans `src/`. Grep confirmé : zéro hit pour `POST|PUT|DELETE|PATCH|book|reserv|resa` dans `src/` et `test/`. ✓ |
| `exposition-http-api` | `high` | `src/server.js` lu exhaustivement. ✓ |
| `qualite-tests` | `low` | 3 tests, logique pure, aucune couverture HTTP. ✓ |

4 incertitudes en section dédiée — toutes légitimes et vérifiables. ✓

### 8. Dépend de la base — champ honnête

Tous les domaines marqués `non`. Vérifié : `package.json` a zéro dépendance externe, aucun ORM, aucune chaîne de connexion, aucune migration, données en mémoire (`src/transfers.js:3-7`). ✓

---

## Recommandations de correction

*Aucune correction demandée.* La carte est publiable.
