# Relecture — ARCHITECTURE_AUDIT.md

## Verdict global

**Bon** — L'audit architectural est précis et proportionné à l'échelle du service (2 fichiers source, ~51 lignes). Les constats sont vérifiés à la ligne, les dettes sont correctement qualifiées comme latentes (non bloquantes aujourd'hui), et les forces sont réelles.

## Problèmes bloquants

Aucun.

## Problèmes mineurs

Aucun.

## Points vérifiés et corrects

- `listTransfers()` retourne `transfers` sans copie (`src/transfers.js:9-11` : `return transfers`) — confirmé.
- Routage inline : un seul `if` sur `url.pathname === '/transfers' && req.method === 'GET'` (`src/server.js:13`) — confirmé.
- Guard `require.main === module` (`src/server.js:27`) — confirmé.
- `module.exports = server` à `src/server.js:30` — confirmé (dernière ligne du fichier de 30 lignes).
- Absence de script `start` dans `package.json` — confirmé : seul `"test": "node --test test/"` est déclaré.
- Encapsulation correcte : `src/server.js` n'accède pas à `seats` ni `sold` directement (projection `id, from, to, price, seatsLeft` aux lignes 14-20) — confirmé.
- Absence d'injection de dépendance sur `transfers` — confirmé : `const transfers = [...]` est une constante module-level dans `src/transfers.js:3`.
- Renvoi vers `SECURITY_ROBUSTNESS_AUDIT.md` pour le risque URL malformée — correct, pas de double-documentation.
- Gravité des dettes correctement calibrée : latentes pour le pilote, critiques à l'extension — nuance bien rendue.
- Aucun secret.

## Recommandations de correction

Aucune.
