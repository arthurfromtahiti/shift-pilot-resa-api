# Relecture — WORKFLOW_CALCUL_DISPONIBILITE

## Verdict global

**Bon** — L'analyse est exacte, sourcée et exploitable sans réserve. Toutes les références de fichiers et numéros de ligne ont été contrôlées. Un écart cosmétique sans impact sur le fond a été noté.

## Problèmes bloquants

Aucun.

## Problèmes mineurs

- **Comptage de lignes `test/transfers.test.js`** : l'analyse indique « 16 lignes » (section Preuves), mais le fichier compte 17 lignes (ligne 17 = ligne vide de fin). Écart cosmétique, sans incidence sur la justesse de l'analyse.

## Points vérifiés et corrects

| Affirmation | Preuve |
|---|---|
| `seatsLeft(transfer)` défini `src/transfers.js:13`, appelé `src/server.js:19` et `test/transfers.test.js:6` | Lu : `function seatsLeft(transfer) {` L13 ; `seatsLeft: seatsLeft(t),` L19 serveur ; `assert.equal(seatsLeft({...}), 28)` L6 tests ✅ |
| `isFull(transfer)` défini `src/transfers.js:17`, appelé uniquement par `test/transfers.test.js:10-11` | Lu : `function isFull(transfer) {` L17 ; `test/transfers.test.js:10-11` — absent de `src/server.js:3` ✅ |
| `isFull` retourne `seatsLeft(transfer) === 0` — `src/transfers.js:18` | Lu : `return seatsLeft(transfer) === 0;` ✅ |
| `seatsLeft` retourne `transfer.seats - transfer.sold` — `src/transfers.js:14` | Lu : `return transfer.seats - transfer.sold;` ✅ |
| Fonctions pures, sans effet de bord | Confirmé : aucune lecture/écriture du tableau `transfers`, aucun I/O ✅ |
| Tests appellent les fonctions sans passer par `listTransfers()` (`test/transfers.test.js:5-7`) | Lu : `seatsLeft({ seats: 40, sold: 12 })` et `isFull({ seats: 60, sold: 60 })` — objets inline ✅ |
| `isFull` exportée `src/transfers.js:21` mais absente de l'import `src/server.js:3` | Lu : `module.exports = { listTransfers, seatsLeft, isFull };` L21 ; import L3 serveur sans `isFull` ✅ |
| `sold` jamais incrémenté dynamiquement | Grep de `src/` : zéro modification de `sold` en dehors de l'initialisation ✅ |
| Risque « données invalides `sold > seats` → résultat négatif » | Aucune validation d'entrée dans les fonctions — constatable `src/transfers.js:13-19` ✅ |

## Recommandations de correction

L'unique écart (comptage de lignes du fichier de test : 16 vs 17) est cosmétique. Aucune correction requise. Le livrable est prêt pour publication.
