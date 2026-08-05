# Relecture — SECURITY_ROBUSTNESS_AUDIT.md

## Verdict global

**Bon** — Audit sécurité précis et calibré : il ne gonfle pas artificiellement la surface d'attaque d'une API lecture seule sans dépendance externe. Le seul vrai risque de robustesse (handler sans `try/catch`) est correctement qualifié comme risque futur conditionnel, pas comme critique actuel. La note sur `req.headers.host` et HTTP/1.0 est honnête sur sa marginalité.

## Problèmes bloquants

Aucun.

## Problèmes mineurs

- **`req.headers.host` undefined → `'http://undefined'`** : l'audit affirme que `new URL(req.url, 'http://undefined')` s'exécute sans exception et extrait correctement le pathname. C'est exact pour Node.js ≥ 18 (la WHATWG URL API accepte ce hostname syntaxiquement invalide pour l'extraction du pathname). Le constat est `VÉRIFIÉ_CODE` mais la vérification repose sur une connaissance de l'implémentation WHATWG URL, pas sur un test exécuté dans ce dépôt. Le label approprié serait `HYPOTHÈSE` ou `VÉRIFIÉ_CODE (comportement runtime, non testé dans ce dépôt)`. Impact : faible, la conclusion est correcte, mais la certitude affichée est légèrement surcalibrée pour ce type d'assertion runtime.

## Points vérifiés et corrects

- Absence de secrets dans `src/`, `test/`, `package.json` : confirmée. ✓
- `package.json` : zéro dépendance externe (`dependencies`, `devDependencies` absents). ✓
- Seule entrée : `url.pathname` extrait de `src/server.js:11-13`. ✓
- Absence de `try/catch` dans `src/server.js:10-24` : confirmée. ✓
- `sendJson` (`src/server.js:5-8`) ne pose que `Content-Type: application/json`, aucun header CORS. ✓
- Absence de `.gitignore` : confirmée par listing du root. ✓
- Port `3100` : seule valeur hardcodée, non sensible. ✓
- Risque "dégradation silencieuse à l'ajout d'une route d'écriture" : conditionnel explicite, non présenté comme actuel. ✓
- Risque CORS : concret — `shift-pilot-resa-web` consomme l'API (`README.md:4`). ✓
- Zéro secret dans les constats. ✓

## Recommandations de correction

Aucune correction nécessaire. Le point sur `'http://undefined'` est une nuance de niveau de preuve sur un comportement marginal ; la conclusion reste exacte.
