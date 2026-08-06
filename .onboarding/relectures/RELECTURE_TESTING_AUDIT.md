# Relecture — TESTING_AUDIT.md

## Verdict global

**Acceptable avec réserves** — Deux imprécisions mineures : numéro de ligne incorrect pour `package.json` et description inexacte du body de T1. Les constats sur la couverture manquante, l'état partagé et les cas limites absents sont tous exacts et bien sourcés. Corrige et resoumets.

## Problèmes bloquants

Aucun.

## Problèmes mineurs

**[MINEUR-1] `package.json (ligne 4)` — numéro de ligne incorrect**

L'audit écrit : « La commande `node --test test/*.test.js` dans `package.json` (ligne 4) ».

Vérification sur `package.json` :
- Ligne 4 : `"private": true`
- Ligne 6 : `"scripts": { "test": "node --test test/*.test.js" }`

La commande est à la ligne 6, pas la ligne 4. Correction requise : `package.json:6`.

**[MINEUR-2] T1 décrit comme envoyant un "body vide"**

L'audit dit : « T1 appelle `POST /transfers/1/reserve` avec un body vide (→ `seats = 1` par défaut) ».

Vérification dans `test/server.test.js:34-35` : le test appelle `postJson("/transfers/1/reserve", {})` — `postJson` sérialise le body en `JSON.stringify({})` = `"{}"`. Le body envoyé est donc `{}` (objet JSON vide), pas une chaîne vide. En pratique, `JSON.parse("{}")` donne `{}`, `parsed.seats` est `undefined`, et `?? 1` s'applique — l'effet décrit est correct. Mais "body vide" est inexact ; dire "body `{}` (objet vide)" est plus précis.

## Points vérifiés et corrects

- **Tests unitaires** (`test/transfers.test.js:1-16`) : `seatsLeft` (ligne 5-7), `isFull` (9-12), `listTransfers` (14-16) — 3 tests, 17 lignes. ✓
- **Tests HTTP sur port éphémère** (`test/server.test.js:8-15`) : `server.listen(0)`, `server.close()`. ✓
- **T1 mute l'état global** (`test/server.test.js:34-40`) : `sold` passe de 12 à 13, assertion `seatsLeft: 27`. Si rejoué, le test échouera. ✓
- **T2 409 sur transfert 2 complet** (`test/server.test.js:42-46`) : sans mutation. ✓
- **T3 404 sur transfert 999** (`test/server.test.js:48-52`) : sans mutation. ✓
- **`GET /transfers` sans test HTTP** (`VÉRIFIÉ_CODE`) : aucun `test("GET /transfers...")` dans `test/server.test.js`. ✓
- **Cas limites `seats` absents** (`VÉRIFIÉ_CODE`) : aucun test pour `seats: -1`, `seats: 0`, `seats: 0.5`. ✓
- **`bookSeats` sans test unitaire direct** (`VÉRIFIÉ_CODE`) : `test/transfers.test.js` importe `{ listTransfers, seatsLeft, isFull }` — pas `bookSeats` (ligne 3). ✓
- **Stack `node:test` sans dépendances externes** (`VÉRIFIÉ_CODE`) : confirmé par `package.json`. ✓
- **Flakiness de T1 en mode watch qualifiée `HYPOTHÈSE`** — calibrage correct. ✓
- **Aucun secret recopié**. ✓

## Recommandations de correction

1. Corriger `package.json (ligne 4)` → `package.json:6`.
2. Corriger "body vide" → "body `{}` (objet JSON vide, `seats` absent → fallback `?? 1`)".
