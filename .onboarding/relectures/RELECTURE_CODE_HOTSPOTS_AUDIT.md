# Relecture — CODE_HOTSPOTS_AUDIT.md

## Verdict global

**Bon** — Les trois hotspots identifiés sont réels, sourcés à la ligne, et correctement hiérarchisés. La complexité cyclomatique est évaluée correctement. Le lien avec les workflows documentés est pertinent et vérifiable.

## Problèmes bloquants

Aucun.

## Problèmes mineurs

**Légère incohérence de décompte** — L'audit annonce « 3 fichiers source » dans le résumé global, alors que `ARCHITECTURE_AUDIT.md` parle de « 2 fichiers source ». La différence tient à l'inclusion ou non du fichier de test (`test/transfers.test.js`). Les deux formulations sont défendables ; noter qu'elles sont dans deux documents distincts, donc sans impact sur la cohérence interne de chacun. Ce n'est pas un défaut de preuve.

## Points vérifiés et corrects

- Hotspot 1 — `src/server.js:11` : `new URL(req.url, ...)` sans `try/catch`, confirmé. Lien correct avec `WORKFLOW_LISTE_TRANSFERTS` (unique workflow HTTP).
- Hotspot 2 — `src/transfers.js:9-11` : `return transfers` sans copie, confirmé. Lien correct avec `WORKFLOW_CALCUL_DISPONIBILITE`.
- Hotspot 3 — `isFull` exportée (`src/transfers.js:17-21`) mais absente de `src/server.js:3` — confirmé. Usage uniquement dans `test/transfers.test.js:3` — confirmé.
- Complexité cyclomatique : `sendJson`, `listTransfers`, `seatsLeft`, `isFull` toutes à 0 branche ; handler HTTP à 1 branche — exact.
- Absence de code mort au sens strict (tous les exports sont consommés quelque part) — exact, avec la nuance correctement apportée que `isFull` n'est consommée que par le test.
- `HYPOTHÈSE` correctement posé sur l'intention préparatoire de `isFull` — aucune documentation ne le confirme.
- Guard `require.main === module` (`src/server.js:27`) — confirmé.
- Aucun secret.

## Recommandations de correction

Aucune. La légère incohérence de décompte est anecdotique et ne nécessite pas de correction.
