# Relecture — FUNCTIONAL_AUDIT.md

## Verdict global

**Bon** — Audit fonctionnel précis qui distingue honnêtement ce qui est livré (lecture du catalogue) de ce qui est absent (réservation), et qui qualifie correctement les lacunes comme des choix de périmètre pilote. Un seul point mineur sur la qualification d'un risque hypothétique dans la section Risques.

## Problèmes bloquants

Aucun.

## Problèmes mineurs

- **Risque "`shift-pilot-resa-web` attend peut-être un champ `isFull`"** : ce risque est présenté dans la section Risques sans label `HYPOTHÈSE`, bien que le texte utilise "peut-être" comme hedge. Dans la section Constats, la distinction est proprement faite (`isFull() non exposée — VÉRIFIÉ_CODE` puis "Hypothèse :..." clairement séparé). La cohérence voudrait que le risque soit préfixé d'une mention `[HYPOTHÈSE]` ou reformulé pour clarifier qu'aucune preuve dans `shift-pilot-resa-web` n'est citée (le dépôt web n'a pas été examiné dans cet audit). Mineure — le hedge "peut-être" suffit à ne pas tromper le lecteur.

## Points vérifiés et corrects

- `GET /transfers` à `src/server.js:13` : confirmé. ✓
- Projection `{ id, from, to, price, seatsLeft }` à `src/server.js:14-20` : confirmée, `seats` et `sold` absents. ✓
- `seatsLeft = seats - sold` (`src/transfers.js:13-15`) : formule exacte. ✓
- Bora Bora : `sold:60 = seats:60` (`src/transfers.js:5`) — `seatsLeft = 0` dès le démarrage. ✓
- `isFull` exportée (`src/transfers.js:21`) et non importée dans `src/server.js:3`. ✓
- Absence de route POST/PUT/DELETE : confirmée par lecture complète de `src/server.js`. ✓
- `price` sans unité : confirmé — aucun champ `currency` dans le schéma ni la réponse. ✓
- Absence de champs temporels : confirmée. ✓
- `src/transfers.js:1` — commentaire "pilote de démonstration" : vérifié. ✓
- Zéro secret dans les constats. ✓

## Recommandations de correction

Aucune correction nécessaire au sens bloquant. Si le producteur veut améliorer la rigueur, il peut préfixer le risque `shift-pilot-resa-web → isFull` de `[HYPOTHÈSE — dépôt web non examiné]` — mais c'est une retouche cosmétique.
