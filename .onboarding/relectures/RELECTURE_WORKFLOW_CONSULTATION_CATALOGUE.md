# Relecture — WORKFLOW_CONSULTATION_CATALOGUE.md

## Verdict global

**Bon** — les deux défauts bloquants identifiés au premier tour ont été corrigés. La référence pour la divergence `seatsLeft`/`availableSeats` cite désormais `documents/ECOSYSTEME.md:14-22` (correct), et le statut a été abaissé à `HYPOTHÈSE` (correct). Les points mineurs (template literal, numérotation des tests) ont également été corrigés. L'artefact est exploitable sans réserve.

## Problèmes bloquants

Aucun — corrigés au premier tour :

- **[RÉSOLU] BLOQUANT-1** — La référence `domaines/CARTE_DES_DOMAINES.md` (absente de ce fichier) a été remplacée par `documents/ECOSYSTEME.md:14-22`. Vérification : `documents/ECOSYSTEME.md` lignes 14-22 décrivent bien la divergence `seatsLeft` / `availableSeats` (`t.availableSeats` accédé côté front, `seatsLeft` retourné par l'API). ✓
- **[RÉSOLU] BLOQUANT-2** — Le tag `VÉRIFIÉ_CODE` sur le risque de divergence a été remplacé par `HYPOTHÈSE`. Conforme à la définition socle (§1) : le code frontend est hors périmètre, la divergence est déduite d'un artefact écosystème, pas lue dans le source. ✓

## Problèmes mineurs

Aucun — corrigés au premier tour :

- **[RÉSOLU] MINEUR-1** — La description de l'URL builder utilise désormais la template literal `` `http://${req.headers.host}` `` (`src/server.js:11`). ✓
- **[RÉSOLU] MINEUR-2** — La référence `test/transfers.test.js:14-16` (test `listTransfers`) est exacte (ligne 14 = ouverture du test, 16 = `assert.equal`). ✓

## Points vérifiés et corrects

- Tous les fichiers cités existent et sont lisibles : `src/server.js`, `src/transfers.js`, `test/transfers.test.js`, `test/server.test.js`, `documents/ECOSYSTEME.md`, `README.md` ✓
- Point d'entrée `GET /transfers` → `src/server.js:13` : `url.pathname === "/transfers" && req.method === "GET"` ✓
- Déroulement (routage, `listTransfers()`, projection map, calcul `seatsLeft`, `sendJson 200`) : tracé aux bonnes lignes, aucune étape inventée ✓
- Règles métier (catalogue sans filtre, projection masquant `seats`/`sold`, réponse toujours 200, `seatsLeft` dynamique) : toutes exactes et sourcées ✓
- Données catalogue (`src/transfers.js:3-7`) : 3 transferts, valeurs numériques, `seatsLeft` calculés — tous corrects ✓
- Risque "divergence de nom de champ" : `HYPOTHÈSE` + référence `documents/ECOSYSTEME.md:14-22` — exact et honnête ✓
- Risques "absence de pagination", "pas de test HTTP GET /transfers", "aucun cache" : corrects et sourcés ✓
- `isFull()` exporté mais non importé par `src/server.js:3` : signalé correctement ✓
- Confiance `high` justifiée (codebase < 30 lignes actives, intégralement lisible) ✓
- Nommage de l'artefact (`WORKFLOW_CONSULTATION_CATALOGUE.md`, dossier `workflows/`) conforme ✓

## Recommandations de correction

Aucune — l'artefact est validé.
