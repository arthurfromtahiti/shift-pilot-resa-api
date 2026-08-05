# Relecture — CARTOGRAPHIE_CODE.md

## Verdict global

**Bon** — Cartographie précise, bien sourcée, exploitant fidèlement CODE_HOTSPOTS_AUDIT et ARCHITECTURE_AUDIT. Tous les numéros de ligne sont exacts. La correction demandée au tour 1 (contradiction sur la résilience aux exceptions) a été appliquée correctement. Aucun bloquant.

> **Tour 1** : verdict « Acceptable avec réserves » — 1 bloquant (formulation contradictoire avec FUNCTIONAL_AUDIT sur le risque de crash sans `try/catch`).
> **Tour 2** : correction appliquée — formulation conforme à l'amont. Verdict final : Bon.

## Problèmes bloquants

Aucun.

## Problèmes mineurs

Aucun.

## Points vérifiés et corrects

- **Arborescence du projet** → liste complète, cohérente avec le code source vérifié. ✓
- **Domaine 1 — Catalogue** : `src/transfers.js:3-7` (tableau), `:9-11` (listTransfers), `:13-15` (seatsLeft), `src/server.js:14-20` (projection), `test/transfers.test.js:14-16` → tous vérifiés ligne par ligne. ✓
- **Risque "Ajouter un 4e transfert casse le test"** → WORKFLOW_SUITE_TESTS "Cardinalité hard-codée". ✓
- **Domaine 2 — Disponibilité** : `src/transfers.js:13-15` (seatsLeft), `:17-19` (isFull), `src/server.js:19`, `test/transfers.test.js:5-12` → vérifiés. ✓
- **"`isFull` exportée mais non câblée"** → CODE_HOTSPOTS_AUDIT "fonction orpheline à risque de confusion — VÉRIFIÉ_CODE". ✓
- **Domaine 3 — Exposition HTTP** : `src/server.js:1-10` (imports + createServer), `:11-23` (routage), `:5-8` (sendJson), `:14-20` (projection), `:26-29` (PORT + listen) → vérifiés. ✓
- **Guard testabilité `src/server.js:27`** : `if (require.main === module)` → vérifié ligne 27, traçable à CODE_HOTSPOTS_AUDIT "Guard `require.main`" + ARCHITECTURE_AUDIT "Guard module.main — VÉRIFIÉ_CODE". ✓
- **`module.exports = server` à la ligne 30** → WORKFLOW_SUITE_TESTS "serveur exporté (`src/server.js:30`)". ✓
- **Domaine 4 — Qualité/tests** : `package.json` script test, `test/transfers.test.js:1-16` (3 tests) → vérifiés. ✓
- **Dépendances internes** (graph server.js → transfers.js sans isFull) → vérifié `src/server.js:3`. ✓
- **Import `{ listTransfers, seatsLeft }` sans `isFull`** → vérifié `src/server.js:3`. ✓
- **Hotspot `src/server.js:10-23`** → CODE_HOTSPOTS_AUDIT "le callback de routage polyvalent — VÉRIFIÉ_CODE". ✓
- **Risque "sold dépasse seats si route POST ajoutée"** → ARCHITECTURE_AUDIT "Mutation silencieuse du catalogue". ✓
- **Évolution prévisible** (routeur nommé, copie tableau, test cardinalité) → ARCHITECTURE_AUDIT recommandations + WORKFLOW_SUITE_TESTS questions ouvertes. ✓

## Recommandations de correction

Aucune correction requise. La formulation corrigée au tour 2 (`src/server.js:87`) est conforme à FUNCTIONAL_AUDIT :
> « **Pas d'appel asynchrone** : ni Promise ni callback en dehors du handler. Risque latent : aucun `try/catch` ; une exception synchrone non gérée dans `listTransfers()` ou `.map()` planterait le handler sans réponse structurée au client (`src/server.js:13-20`). » ✓
