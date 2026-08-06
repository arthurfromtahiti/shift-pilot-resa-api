# Relecture — FUNCTIONAL_AUDIT.md

## Verdict global

**À corriger** — Un défaut bloquant : la divergence `seatsLeft`/`availableSeats` est qualifiée `VÉRIFIÉ_CODE` alors que le code frontend n'est pas dans ce workspace. Le workflow `WORKFLOW_CONSULTATION_CATALOGUE.md` (déjà validé dans cette même chaîne) qualifie correctement ce même point comme `HYPOTHÈSE`. Le reste de l'audit est solide.

## Problèmes bloquants

**[BLOQUANT-1] Divergence `seatsLeft`/`availableSeats` en `VÉRIFIÉ_CODE` — statut trop élevé, contradiction avec un artefact validé**

L'audit affirme : « La carte des domaines et les workflows documentent que le frontend (`shift-pilot-resa-web`) s'attend à `availableSeats`, pas `seatsLeft` » — statut `VÉRIFIÉ_CODE`.

Vérification effectuée :

1. Le côté API est bien `VÉRIFIÉ_CODE` : `src/server.js:19` retourne `seatsLeft`. Confirmé.

2. Le côté frontend n'est **pas** dans ce workspace (`shift-pilot-resa-api`). L'auditeur n'a pas accès au code de `shift-pilot-resa-web` — il s'appuie sur des artefacts de documentation (`CARTE_DOMAINE.md`, `WORKFLOWS.md`, `documents/ECOSYSTEME.md`).

3. Le `WORKFLOW_CONSULTATION_CATALOGUE.md` (validé dans cette chaîne) qualifie exactement ce point : « `HYPOTHÈSE` — Le code frontend (`shift-pilot-resa-web`) n'est pas dans ce workspace — cette information est issue d'un artefact écosystème (`documents/ECOSYSTEME.md`), pas d'une lecture directe du code frontend. »

4. La conséquence présentée comme un fait — « le champ de disponibilité s'affiche comme `undefined` côté web » — hérite de cette hypothèse et doit elle aussi être qualifiée `HYPOTHÈSE`.

Conclusion : `VÉRIFIÉ_CODE` n'est autorisé que pour ce qu'on a lu dans le code. Ici, seul le côté API est `VÉRIFIÉ_CODE`  ; le côté frontend est `HYPOTHÈSE` (source : `documents/ECOSYSTEME.md:14-22`). Elever une hypothèse en `VÉRIFIÉ_CODE` est le défaut de discipline de preuve central que la grille de relecture traque.

**Correction requise** : séparer les deux parties du constat — (a) API retourne `seatsLeft` : `VÉRIFIÉ_CODE` (`src/server.js:19`) ; (b) frontend attendrait `availableSeats` : `HYPOTHÈSE` (source `documents/ECOSYSTEME.md:14-22`, code frontend non lisible depuis ce workspace). La conséquence sur l'affichage `undefined` doit également être qualifiée `HYPOTHÈSE`.

## Problèmes mineurs

Aucun autre.

## Points vérifiés et corrects

- **Implémentation des deux endpoints conforme** : `GET /transfers` et `POST /transfers/:id/reserve` fonctionnent selon leur contrat respectif. ✓
- **`isFull` non importée dans `src/server.js:3`** (`VÉRIFIÉ_CODE`) : imports `{ listTransfers, seatsLeft, bookSeats }` uniquement. ✓
- **Transfert 2 pré-complet** (`VÉRIFIÉ_CODE`, `src/transfers.js:5`) : `sold: 60` = `seats: 60`. ✓
- **409 pour les deux cas** (`VÉRIFIÉ_CODE`, `src/server.js:38`) : `"Transfer full"` couvre transfert complet ET pas assez de places — constat subtil et exact. ✓
- **Réponse 200 minimale** (`VÉRIFIÉ_CODE`, `src/server.js:39`) : `{ transferId, seatsLeft }` sans `seatsReserved` ni identifiant de réservation. ✓
- **Formulaire frontend absent** qualifié avec incertitude ("incertitude sur l'état du frontend") — calibrage honnête. ✓
- **Cohérence interne de l'API** : `seatsLeft` calculé identiquement entre `GET` et `bookSeats`. ✓
- **Aucun secret recopié**. ✓

## Recommandations de correction

1. Constat « Divergence `seatsLeft` / `availableSeats` » : remplacer le statut unique `VÉRIFIÉ_CODE` par deux statuts distincts — `VÉRIFIÉ_CODE` sur la valeur retournée par l'API (`src/server.js:19`) et `HYPOTHÈSE` sur l'attente du frontend (source `documents/ECOSYSTEME.md:14-22`). Qualifier en `HYPOTHÈSE` la conséquence sur l'affichage `undefined`. Aligner la formulation sur `WORKFLOW_CONSULTATION_CATALOGUE.md` qui précise que le code frontend n'est pas dans ce workspace.
