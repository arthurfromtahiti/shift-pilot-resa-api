# Relecture — CODE_HOTSPOTS_AUDIT.md

## Verdict global

**Bon** — Audit honnête sur l'absence de points chauds classiques, qui recadre correctement l'analyse sur les zones de croissance future plutôt que sur des pathologies inexistantes. Tous les constats sont `VÉRIFIÉ_CODE` avec référence précise. Aucun défaut bloquant.

## Problèmes bloquants

Aucun.

## Problèmes mineurs

- **Décalage de statut pour `sendJson`** : le constat "pas importable/partageable sans passer par `server.js`" (`src/server.js:5-8`) est présenté sans statut de preuve explicite dans la phrase. Il s'agit d'un `VÉRIFIÉ_CODE` (la fonction est déclarée dans `server.js` et non exportée) — la preuve est dans le code, mais le label est absent de cette sous-phrase. Impact : faible, le contexte rend la nature du constat évidente.

## Points vérifiés et corrects

- `src/server.js:10-23` — 7 responsabilités dans 14 lignes : liste vérifiée contre le code réel (URL parsing, routage, listTransfers, map, seatsLeft, sendJson, 404). ✓
- `src/transfers.js:3-7` — seul état de l'application. ✓
- `sendJson` utilisée à `src/server.js:14` et `src/server.js:23` : confirmé. ✓
- `src/server.js:31` lignes, `src/transfers.js:22` lignes, `test/transfers.test.js:17` lignes : décompte exact. ✓
- `isFull` — exportée `src/transfers.js:21` mais non importée dans `src/server.js:3` : confirmé. ✓
- Couplage unique `src/server.js:3 → ./transfers` : vérifié, pas de dépendance circulaire. ✓
- Zéro secret dans les constats. ✓

## Recommandations de correction

Aucune correction nécessaire. Le manque de label de preuve sur une sous-phrase de `sendJson` est cosmétique.
