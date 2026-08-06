# Relecture — DATA_MODEL_AUDIT.md

## Verdict global

**Bon** — Tous les constats sont exacts, les références de code sont vérifiées ligne par ligne. Les statuts de preuve sont correctement calibrés. Les risques sont proportionnés et liés à des observations précises.

## Problèmes bloquants

Aucun.

## Problèmes mineurs

Aucun.

## Points vérifiés et corrects

- **Structure de l'entité `transfer`** (`VÉRIFIÉ_CODE`, `src/transfers.js:3-7`) : `{ id, from, to, seats, sold, price }` — exact. Seul `sold` est muté (`src/transfers.js:25`). ✓
- **Catalogue statique codé en dur** (`VÉRIFIÉ_CODE`) : aucune lecture de fichier ou base de données. Confirmé par absence d'import autre que les fonctions internes. ✓
- **Transfert 2 pré-complet** (`VÉRIFIÉ_CODE`, `src/transfers.js:5`) : `{ id: 2, ..., seats: 60, sold: 60 }` — exact, et `test/server.test.js:42` confirme l'usage de test. ✓
- **Invariant géré par code** (`VÉRIFIÉ_CODE`, `src/transfers.js:24`) : la garde `seatsLeft(transfer) < seats` est la seule protection. Aucune contrainte structurelle. ✓
- **IDs manuels** (`VÉRIFIÉ_CODE`, `src/transfers.js:3-7`) : `1`, `2`, `3` assignés à la main. Aucun générateur. ✓
- **Volatilité totale** (`VÉRIFIÉ_CODE`) : `sold` muté en mémoire, réinitialisé au redémarrage. ✓
- **Mutation unique dans `bookSeats`** (`VÉRIFIÉ_CODE`, `src/transfers.js:25`) : seul point de mutation de `sold`. ✓
- **Projection correcte** (`src/server.js:14-20`) : `seats` et `sold` masqués dans la réponse publique. ✓
- **Aucun secret recopié**. ✓
