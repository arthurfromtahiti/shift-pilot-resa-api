# Relecture — CARTE_DES_DOMAINES.md (shift-pilot-resa-api)

## Verdict global

**Bon** — Carte exacte, sourcée ligne par ligne, honnête sur ses limites. Toutes les affirmations ont été vérifiées dans le code source. La granularité (4 domaines) est appropriée pour un dépôt de ~80 lignes. Aucun défaut bloquant, aucune correction requise.

## Problèmes bloquants

*Aucun.*

## Problèmes mineurs

*Aucun.*

## Points vérifiés et corrects

**Contrôle 1 — Domaine `catalogue-transferts` prouvé.**
Entité `transfers` vérifiée à `src/transfers.js:3-7` (tableau, champs `id`, `from`, `to`, `seats`, `sold`, `price`). Route `GET /transfers` vérifiée à `src/server.js:13-21`. Fonction `listTransfers()` à `src/transfers.js:9-11`. Indices de rattachement (`transfers`, `from`, `to`, `price`) circonscrits à ces deux fichiers — ils ne couvrent pas l'ensemble du dépôt.

**Contrôle 2 — Domaine `disponibilite-reservation` prouvé.**
`seatsLeft()` à `src/transfers.js:13-15`, `isFull()` à `src/transfers.js:17-19`, `bookSeats()` à `src/transfers.js:21-27`. Route `POST /transfers/:id/reserve` à `src/server.js:23-42`. Retour `{ ok, reason?, seatsLeft? }` confirmé : `{ ok: false, reason: "not_found" }` ligne 23, `{ ok: false, reason: "full" }` ligne 24, `{ ok: true, seatsLeft: ... }` ligne 26. Tests HTTP à `test/server.test.js:34-52` (200, 409, 404 confirmés).

**Contrôle 3 — Affirmation sur `isFull` « exporté mais mort côté runtime ».**
`src/server.js:3` : `const { listTransfers, seatsLeft, bookSeats } = require("./transfers")` — `isFull` absent de l'import. Confirmé : `isFull` n'est importé que par `test/transfers.test.js:3` et utilisé aux lignes 9-12. La garde de complétude effective en production passe bien par `seatsLeft(transfer) < seats` à `src/transfers.js:24`, pas par `isFull()`. Description exacte.

**Contrôle 4 — Fallback silencieux corps JSON malformé.**
`src/server.js:31-35` : `body ? JSON.parse(body) : {}` avec catch → `seats = undefined`. Ligne 36 : `bookSeats(id, seats ?? 1)` → défaut à 1 en cas de corps vide ou invalide. Description exacte ; incertitude correctement signalée comme relevant de l'audit robustesse.

**Contrôle 5 — Domaine `exposition-http-api` séparé du métier.**
`src/server.js` ne porte aucune entité métier — il délègue à `listTransfers`, `seatsLeft`, `bookSeats`. La séparation technique/métier est réelle et non artificielle.

**Contrôle 6 — Domaine `qualite-tests` prouvé.**
`test/transfers.test.js:1-16` (3 tests logique pure), `test/server.test.js:1-52` (3 tests intégration HTTP avec vrai serveur). `package.json` : `"test": "node --test test/*.test.js"`. Confiance `medium` justifiée : couverture HTTP présente mais `GET /transfers` et corps malformé non testés — signalé dans les types de workflows attendus.

**Contrôle 7 — Granularité.**
4 domaines pour ~80 lignes de source (2 fichiers : `src/transfers.js`, `src/server.js`). Limite basse de la grille (4-12), mais justifiée : dépôt volontairement minimal. La frontière `catalogue-transferts` / `disponibilite-reservation` est défendable (lecture/offre vs écriture/stock), honnêtement signalée comme incertitude, et renforcée par l'ajout de la route de réservation (SHIA-61).

**Contrôle 8 — Champ « Dépend de la base » honnête.**
Tous les domaines à `non`. Vérifié : `src/transfers.js:3-7` (données codées en dur), `src/transfers.js:25` (`transfer.sold += seats` — mutation mémoire uniquement). Aucun ORM, aucun fichier de schéma, aucun signal de persistence. Correct.

**Contrôle 9 — Journal de réconciliation.**
Confrontation canonique (pre-SHIA-61) vs code courant vérifiée : `bookSeats()` et `POST /transfers/:id/reserve` absents du code d'origine, présents à `src/transfers.js:21-27` et `src/server.js:23-42`. Les quatre lignes du tableau de réconciliation sont factuellement exactes.

**Contrôle 10 — Couverture du dépôt (oublis ?).**
Fichiers explorés : `src/transfers.js`, `src/server.js`, `test/transfers.test.js`, `test/server.test.js`, `package.json`, `README.md`. Chacun est couvert par au moins un domaine. Aucun pan non cartographié.

## Recommandations de correction

Aucune correction requise. La carte peut passer à l'étape suivante (analyse des workflows).
