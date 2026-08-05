# Relecture — CDC_FONCTIONNEL.md

## Verdict global

**Bon** — CDC précis et complet, intégralement traçable à WORKFLOW_GET_TRANSFERS et FUNCTIONAL_AUDIT. Toutes les numéros de ligne sont vérifiés corrects. Les données du catalogue (capacités, places vendues, prix, seatsLeft calculés) sont exactes au code source. Les hypothèses sont marquées. Aucun bloquant.

## Problèmes bloquants

Aucun.

## Problèmes mineurs

- **Section "Recommandations pour l'évolution"** : présente dans un CDC mais marginale sur le fond — toutes les recommandations sont tracées (FUNCTIONAL_AUDIT reco 1-4, ARCHITECTURE_AUDIT reco 1-3). Ce n'est pas une invention ; c'est une section de conseil non conventionnelle dans un CDC. Le producteur peut la conserver ou la déplacer en annexe à sa discrétion.

## Points vérifiés et corrects

- **Contexte métier** : périmètre lecture seule, pas de route POST/PUT/DELETE, absence de persistance, consommateur `shift-pilot-resa-web` → WORKFLOW_GET_TRANSFERS + FUNCTIONAL_AUDIT. ✓
- **Acteurs et capacités** → tous issus de FUNCTIONAL_AUDIT section "Fonctionnalité livrée / Réservation absente". ✓
- **Parcours utilisateur — étapes 1 à 6** avec numéros de ligne exacts :
  - `src/server.js:10-13` (callback + routage) → vérifié lignes 10-13. ✓
  - `src/transfers.js:9-11` (`listTransfers()`) → vérifié lignes 9-11. ✓
  - `src/server.js:14-20` (`.map()` + `seatsLeft`) → vérifié lignes 14-20. ✓
  - `src/server.js:5-8` (`sendJson`) → vérifié lignes 5-8. ✓
  - `src/server.js:23` (404) → vérifié ligne 23. ✓
- **Exemple de réponse JSON** :
  - Papeete→Moorea : seats:40, sold:12 → seatsLeft = 28. ✓ (`src/transfers.js:4`)
  - Papeete→Bora Bora : seats:60, sold:60 → seatsLeft = 0. ✓ (`src/transfers.js:5`)
  - Raiatea→Tahaa : seats:20, sold:5 → seatsLeft = 15. ✓ (`src/transfers.js:6`)
- **Table du catalogue** (ID, origine, destination, capacité, vendues, prix) → conforme à `src/transfers.js:3-7` vérifié. ✓
- **Règle "Encapsulation du stock"** → `src/server.js:14-20` : projection `.map()` exclut `seats` et `sold`. ✓
- **Règle "`isFull` non exposée"** → `src/transfers.js:17-19` + `src/server.js:3` (import sans isFull) + `test/transfers.test.js:9-12`. ✓
- **Hypothèse devise XPF** → marquée explicitement `Hypothèse`. ✓
- **Workflow de test** : 3 tests, leurs descriptions, code 0/≠0 → WORKFLOW_SUITE_TESTS + `test/transfers.test.js:5-16` vérifié. ✓
- **Absences significatives** (devise, date/heure, isFull) → FUNCTIONAL_AUDIT section "Absences". ✓
- **Questions ouvertes** → reprises de FUNCTIONAL_AUDIT et WORKFLOW_GET_TRANSFERS sans invention. ✓

## Recommandations de correction

Aucune correction obligatoire. La section "Recommandations pour l'évolution" est traçable et ne nuit pas à la fiabilité du document.
