# Relecture — TESTING_AUDIT.md

## Verdict global

**Bon** — L'audit des tests est factuel et exhaustif sur ce qui existe. Les gaps (zéro test HTTP, cas limites manquants, `listTransfers` sans vérification de contenu) sont tous exacts. Le constat sur le guard `require.main === module` non exploité est pertinent et vérifiable.

## Problèmes bloquants

Aucun.

## Problèmes mineurs

Aucun.

## Points vérifiés et corrects

- Fichier de test unique (`test/transfers.test.js`, 16 lignes) — confirmé par lecture directe.
- 3 tests : `seatsLeft`, `isFull`, `listTransfers` — confirmé (lignes 5-7, 9-12, 14-16).
- Import uniquement depuis `../src/transfers` (ligne 3) — confirmé : `src/server` jamais importé.
- `test("listTransfers retourne les 3 transferts", ...)` vérifie uniquement `.length === 3`, pas le contenu — confirmé (ligne 15-16).
- `test("isFull detecte un transfert complet", ...)` couvre les deux cas booléens (`true` et `false`) — confirmé, cas frontière `sold === seats` atteint via `{ seats: 60, sold: 60 }`.
- Cas manquants pour `seatsLeft` : `sold === 0` et `sold > seats` — confirmé (seul `{ seats: 40, sold: 12 }` testé).
- Guard `require.main === module` (`src/server.js:27`) present mais non exploité par les tests — confirmé.
- Runner `node --test test/` (`package.json:6`) sans dépendance externe — confirmé.
- Aucun secret.
- Recommandations (test HTTP GET /transfers, test 404, cas limites seatsLeft, renforcement listTransfers) toutes actionnables avec référence fichier:ligne.

## Recommandations de correction

Aucune.
