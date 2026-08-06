# Relecture — CODE_HOTSPOTS_AUDIT.md

## Verdict global

**Bon** — Les points chauds identifiés sont exacts et bien sourcés. Les statuts de preuve sont correctement appliqués. L'audit ne reproduit pas l'erreur de qualification de la race condition présente dans SECURITY_ROBUSTNESS_AUDIT : il se contente de la mentionner comme référence à un autre audit ("race condition possible, borne inférieure non protégée") sans lui attribuer un statut `VÉRIFIÉ_CODE` ici.

## Problèmes bloquants

Aucun.

## Problèmes mineurs

Aucun.

## Points vérifiés et corrects

- **Zone POST couplée** (`VÉRIFIÉ_CODE`, `src/server.js:23-42`) : route matching, cast de `id`, collecte async du body, parsing JSON, appel métier, dispatch des réponses — tout dans 20 lignes. Confirmé. ✓
- **`bookSeats` seule mutation** (`VÉRIFIÉ_CODE`, `src/transfers.js:21-27`) : unique point de mutation de `sold`. ✓
- **`isFull` dead code en production** (`VÉRIFIÉ_CODE`, `src/transfers.js:17-19`) : exportée mais non importée dans `src/server.js:3` (qui importe `{ listTransfers, seatsLeft, bookSeats }` uniquement). Seule occurrence dans `test/transfers.test.js:9-11`. ✓
- **Routage sans table de routes** (`VÉRIFIÉ_CODE`, `src/server.js:13` et `23`) : deux blocs `if` indépendants, ordre significatif. ✓
- **Absence de timeout sur la lecture du body** (`VÉRIFIÉ_CODE`, `src/server.js:26-28`) : `req.on("data")` + `req.on("end")` sans timeout. Vecteur Slowloris confirmé par lecture du code. ✓
- **Mutation irréversible dans `bookSeats`** (`VÉRIFIÉ_CODE`, `src/transfers.js:25`) : `transfer.sold += seats` sans rollback — correctement qualifié. ✓
- **Extension de l'API via zone POST** qualifiée `HYPOTHÈSE` (pas encore de troisième endpoint) — calibrage correct. ✓
- **Aucun secret recopié**. ✓
