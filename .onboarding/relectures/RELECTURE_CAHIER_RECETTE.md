# Relecture — CAHIER_RECETTE.md

## Verdict global

**Bon** — Cahier bien structuré, dérivé fidèlement de WORKFLOW_GET_TRANSFERS et WORKFLOW_SUITE_TESTS. Les tests 1 à 5 sont traçables à l'amont. Les deux corrections demandées au tour 1 ont été appliquées correctement.

> **Tour 1** : verdict « Acceptable avec réserves » — 1 bloquant (seuil de performance non sourcé) + 1 mineur (commentaire npm install inexact).
> **Tour 2** : les deux corrections appliquées. Verdict final : Bon.

## Problèmes bloquants

Aucun. Le seuil chiffré `< 5 secondes / ~50ms par appel` a été retiré du test 5, cas 5.1. L'attendu ne couvre plus que la stabilité (non-crash), traçable au code synchrone et in-memory. ✓

## Problèmes mineurs

Aucun. Le commentaire `npm install` a été corrigé en « # Aucune dépendance externe — crée le package-lock.json si absent ». ✓

## Points vérifiés et corrects

- **Test 1 — Consultation catalogue (cas 1.1, 1.2, 1.3)** :
  - Statut 200, `Content-Type: application/json`, 3 objets → WORKFLOW_GET_TRANSFERS règles métier. ✓
  - Valeurs exactes (Moorea:28, Bora Bora:0, Tahaa:15) → vérifiées contre `src/transfers.js:4-6` et formule `seatsLeft`. ✓
  - Champs `seats`/`sold` absents → `src/server.js:14-20`. ✓
  - Ordre : insertion order du tableau → WORKFLOW_GET_TRANSFERS "Toujours 3 résultats retournés". ✓
- **Test 2 — Erreurs HTTP (cas 2.1, 2.2, 2.3)** :
  - 404 pour mauvais chemin → `src/server.js:23`. ✓
  - 404 pour POST /transfers (pas 405) → routage par `url.pathname && req.method === "GET"`, tout le reste → 404. ✓
  - Query strings ignorés (`GET /transfers?from=Papeete` → 200) → `url.pathname === "/transfers"` ne tient pas compte de la query string. ✓ Source : WORKFLOW_GET_TRANSFERS "Aucun filtre, aucune pagination". ✓
- **Test 3 — Logique métier** :
  - Calcul seatsLeft cohérent → WORKFLOW_GET_TRANSFERS règle `seatsLeft = seats - sold`. ✓
  - Stabilité entre appels (données statiques) → WORKFLOW_GET_TRANSFERS "Données statiques". ✓
  - Bora Bora complet depuis le démarrage (artefact de donnée) → FUNCTIONAL_AUDIT. ✓
- **Test 4 — Suite de tests unitaires** :
  - `npm test`, 3 tests, code 0, sorties attendues → WORKFLOW_SUITE_TESTS étapes 1-7. ✓
  - Couverture logique pure sans couverture HTTP → WORKFLOW_SUITE_TESTS "Aucune couverture de la route HTTP". ✓
- **Matrices de tests** → cohérentes avec les règles de routage et les workflows. ✓
- **Blocages connus** (réservation absente, filtrage absent, `isFull` absent, persistance absente) → WORKFLOW_GET_TRANSFERS + FUNCTIONAL_AUDIT. ✓
- **Test 5 — Stabilité (non-crash sur 100 requêtes)** : le principe du test est justifié (serveur synchrone, statique, sans état externe). C'est uniquement le seuil chiffré qui pose problème (voir bloquant 1). ✓

## Recommandations de correction

Aucune correction requise. Les deux corrections du tour 1 ont été appliquées :

- Test 5, cas 5.1 : seuil chiffré retiré, attendu limité à la non-crash (traçable). ✓
- Section Installation : commentaire `npm install` corrigé et fidèle. ✓
