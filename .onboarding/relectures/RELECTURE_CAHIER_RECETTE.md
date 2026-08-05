# Relecture — CAHIER_RECETTE

## Verdict global

**Bon** — Le cahier de recette est complet, réaliste et entièrement dérivé des workflows et audits disponibles. Les 8 cas de test couvrent le parcours nominal, les cas limites documentés, les cas de robustesse identifiés (crash URL, CORS) et les primitives pures. La matrice de couverture actuelle est honnête et conforme à `TESTING_AUDIT.md`. Les données de test correspondent exactement aux fixtures du code. Aucun problème bloquant ni mineur significatif.

---

## Problèmes bloquants

Aucun.

---

## Problèmes mineurs

Aucun.

---

## Points vérifiés et corrects

- **Cas 1 — GET /transfers** : préconditions, étapes, critères d'acceptation (3 objets, champs attendus, exclusion `seats`/`sold`) — dérivé de `WORKFLOW_LISTE_TRANSFERTS.md § Étapes principales` et `FUNCTIONAL_AUDIT.md § GET /transfers`.
- **Données cas 1** : valeurs exactes (id 1→28 places, id 2→0, id 3→15) — confirmées dans `WORKFLOW_LISTE_TRANSFERTS.md § Données` et `CODE_HOTSPOTS_AUDIT.md § Données`.
- **Cas 2 — 404 routes invalides** : verbe non supporté (`POST /transfers`) et routes invalides — dérivé de `FUNCTIONAL_AUDIT.md § Route 404 catch-all` (server.js:23).
- **Cas 3 — seatsLeft()** : 4 variantes (nominal, sold=0, sold=seats, sold>seats) — dérivé de `TESTING_AUDIT.md § Cas limites non testés` ("seul le cas sold < seats est couvert. Manquent : sold===0, sold===seats, sold>seats"). Les données de chaque cas correspondent aux valeurs du catalogue.
- **Cas 3d survente (-10)** : bien signalé comme "comportement observé, pas défini comme correct", conforme au `WORKFLOW_CALCUL_DISPONIBILITE.md § Risques` ("sold > seats → résultat négatif, non détecté").
- **Cas 4 — isFull()** : 3 variantes (saturé, non saturé, presque complet 1 place) — dérivé de `WORKFLOW_CALCUL_DISPONIBILITE.md § Règles métier` ("saturation binaire"). La variante "presque complet" (seatsLeft===1 → false) illustre correctement le caractère binaire de la saturation.
- **Cas 5 — listTransfers()** : vérification longueur ET valeurs (id, from, to, seats, sold, price) — comble le gap identifié dans `TESTING_AUDIT.md § Constats détaillés` ("listTransfers : seule la longueur est vérifiée").
- **Cas 6 — Pas de mutation** : appels multiples et comparaison `deepStrictEqual` — dérivé de `CODE_HOTSPOTS_AUDIT.md § Hotspot 2` (référence mutable exposée, vecteur de corruption silencieuse).
- **Cas 7a — URL malformée** : risque actif signalé, résultat attendu 400, réalité actuelle crash — `SECURITY_ROBUSTNESS_AUDIT.md § Crash sur URL malformée`, `CODE_HOTSPOTS_AUDIT.md § Hotspot 1`.
- **Cas 7b — Host absent** : réalité documentée ("ne crashe pas, comportement silencieusement inattendu") — `SECURITY_ROBUSTNESS_AUDIT.md § Cas req.headers.host absent`.
- **Cas 8 — CORS** : frontend bloqué, résultat attendu header `Access-Control-Allow-Origin` — `SECURITY_ROBUSTNESS_AUDIT.md § Absence de headers CORS`.
- **Matrice de couverture** : "1 cas sur 4" pour seatsLeft conforme à `TESTING_AUDIT.md` (1 cas couvert, 3 manquants). "2 cas suffisants" pour isFull conforme à `TESTING_AUDIT.md` ("c'est suffisant pour cette fonction").
- **Priorité de test** : CORS et try/catch URL en "Immédiat" — cohérent avec les recommandations prioritaires de `SECURITY_ROBUSTNESS_AUDIT.md § Recommandations priorisées`.
- **Commandes de lancement** : `npm test`, `node src/server.js`, `PORT=3000 node src/server.js` — tracées à `package.json:6` et `server.js:26`.

---

## Recommandations de correction

Aucune. Le document est exploitable tel quel.
