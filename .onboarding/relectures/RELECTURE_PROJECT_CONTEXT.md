# Relecture — PROJECT_CONTEXT.md

## Verdict global

**Bon** — Document de contexte précis, intégralement traçable à l'amont (ARCHITECTURE_AUDIT, FUNCTIONAL_AUDIT, CARTE_DES_DOMAINES, WORKFLOW_GET_TRANSFERS). Les hypothèses sont marquées, les absences assumées, le périmètre pilote correctement qualifié. Aucun bloquant.

## Problèmes bloquants

Aucun.

## Problèmes mineurs

Aucun.

## Points vérifiés et corrects

- **Nature du produit** : "API HTTP de consultation, Node.js natif, ~1,5 Ko, deux fichiers" → WORKFLOW_GET_TRANSFERS (lecture intégrale src/ en preuve) + ARCHITECTURE_AUDIT résumé exécutif. ✓
- **Périmètre lecture seule** : "aucun POST, PUT, DELETE, PATCH" → FUNCTIONAL_AUDIT `grep -niE "post|put|delete|patch|book|reserv|resa" src/` → aucun résultat. ✓
- **Consommateur désigné `shift-pilot-resa-web`** → `README.md:3-4` cité dans WORKFLOW_GET_TRANSFERS. ✓
- **Point 1 — Réservation absente** → FUNCTIONAL_AUDIT "Réservation absente — VÉRIFIÉ_CODE". ✓
- **Point 2 — Bora Bora complet (`sold:60 = seats:60`)** → FUNCTIONAL_AUDIT "Bora Bora complet au démarrage — VÉRIFIÉ_CODE", `src/transfers.js:5` vérifié. ✓
- **Point 3 — Champs `seats`/`sold` masqués, `seatsLeft` calculé** → WORKFLOW_GET_TRANSFERS règle métier + `src/server.js:14-20` vérifié. ✓
- **Point 4 — `isFull` dormante** → ARCHITECTURE_AUDIT "isFull exportée mais non câblée" + CODE_HOTSPOTS_AUDIT "fonction orpheline à risque de confusion — VÉRIFIÉ_CODE". ✓
- **Domaines clés (table)** → cohérents avec CARTE_DES_DOMAINES (priorité, confiance, notes). ✓
- **Force "Tableau mutable exposé"** → ARCHITECTURE_AUDIT "Tableau mutable exposé — VÉRIFIÉ_CODE. `listTransfers()` retourne `transfers` sans copie (`src/transfers.js:9-11`)". ✓
- **Force "Guard `require.main`"** → ARCHITECTURE_AUDIT "Guard module.main — VÉRIFIÉ_CODE (`src/server.js:27`)". ✓
- **Hypothèse devise XPF** → marquée `Hypothèse` dans le document, cohérente avec FUNCTIONAL_AUDIT "Absence de devise — VÉRIFIÉ_CODE". ✓
- **Questions ouvertes** → toutes reprises de FUNCTIONAL_AUDIT et ARCHITECTURE_AUDIT, aucune invention. ✓
- **Checklist développeur** → cohérente avec le corpus produit. ✓

## Recommandations de correction

Aucune correction requise.
