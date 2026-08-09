# Relecture — documents étape 4

## Verdict global

**À corriger** — les documents sont substantiels et les corrections précédentes sur les mutations, les lignes de tests et la pureté des primitives sont désormais cohérentes avec le code. Des affirmations factuelles restent toutefois fausses ou obsolètes.

## Problèmes bloquants

### B1 — Chemin inexistant dans `CARTOGRAPHIE_CODE.md`

L’arborescence documente `documents/ECOSYSTEME.md`, alors que le fichier présent est `.onboarding/documents/ECOSYSTEME.md` (et aucun répertoire `documents/` n’existe à la racine). Cette représentation est non traçable à l’état du workspace et peut orienter vers un artefact inexistant. Corriger l’arborescence et les références associées. Preuve : `find` du workspace et `.onboarding/documents/ECOSYSTEME.md`.

### B2 — Taille erronée dans `PROJECT_CONTEXT.md`

Le document annonce `2 fichiers source (~112 lignes) + 1 fichier test (~196 lignes)`. Le code courant contient `src/server.js` (66 lignes) et `src/transfers.js` (46 lignes), soit 112 lignes, mais **deux** fichiers de test : `test/server.test.js` (140) et `test/transfers.test.js` (56), soit 196 lignes. Corriger `1 fichier test` en `2 fichiers test` et conserver le détail utile. Preuve : `wc -l src/* test/*`.

## Problèmes mineurs

### M1 — Référence de validation décalée dans `ECOSYSTEME.md`

La phrase cite `src/server.js:37-39` pour la validation de `seats`, alors que le code courant effectue l’extraction aux lignes 31–38 et la validation aux lignes 39–40. Corriger la référence en `:39-40` (ou une plage exacte incluant le contexte).

## Points vérifiés

- `CAHIER_RECETTE.md` distingue correctement les primitives pures (`seatsLeft`, `isFull`) des opérations mutantes.
- Les métriques `test/server.test.js` (140 lignes) et `test/transfers.test.js` (56 lignes) sont correctes dans la cartographie.
- Les workflows et audits sont exploités ; le document n’est pas creux.
- Les risques et hypothèses sont globalement explicités et traçables.

## Action attendue

Corriger B1, B2 et M1, puis demander une nouvelle passe de relecture. Aucun changement de code n’est requis pour ces écarts documentaires.

## Nouvelle passe de relecture — 2026-08-09

**Verdict : À corriger.** B1 et B2 sont corrigés et vérifiés : l’arborescence pointe désormais vers `.onboarding/documents/ECOSYSTEME.md`, et `PROJECT_CONTEXT.md` indique bien deux fichiers de test pour 196 lignes (`wc -l` confirme 140 + 56). Les corrections sont traçables à l’état courant du workspace.

**M1 toujours ouvert — référence de lignes obsolète.** `.onboarding/documents/ECOSYSTEME.md:171` cite encore `src/server.js:37-39` pour la validation de `seats`. Dans le code courant, l’extraction et le défaut sont aux lignes 31–38, et la condition de validation est aux lignes 39–40 (`nl -ba src/server.js`). Corriger cette référence en `src/server.js:39-40` (ou une plage incluant exactement la validation).

Aucune autre correction demandée dans cette passe.
