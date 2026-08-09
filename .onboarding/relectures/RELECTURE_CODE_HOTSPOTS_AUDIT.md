# Relecture — CODE_HOTSPOTS_AUDIT.md

## Verdict global

**À corriger** — Les points chauds et la qualification de la race condition sont correctement calibrés, mais une exclusivité factuelle est inexacte.

## Problèmes mineurs

**[MINEUR-1] « seul endroit » trop absolu**

L'absence de garde autour de `transfers.find()` dans `src/transfers.js:40-41` est bien observée et le scénario est correctement marqué `HYPOTHÈSE`. En revanche, « le seul endroit du code qui pourrait théoriquement lever un crash TypeError » est trop absolu : `new URL(req.url, ...)` (`src/server.js:11`) peut aussi lever sur une entrée/base malformée. Dire « seul endroit identifié dans le chemin métier d'annulation ».

## Points vérifiés et corrects

- Couplage du POST (`src/server.js:25-48`).
- Deuxième point de mutation dans `cancelReservation` (`src/transfers.js:36-44`).
- `isFull()` réellement utilisée (`src/server.js:3`, `15`).
- Absence de timeout du body (`src/server.js:29-30`) et risque qualifié selon le contexte.
- Aucun secret recopié.

## Recommandation

Corriger l'absolu sur les lieux de crash ; le verdict peut ensuite être favorable.
