# Sécurité & Robustesse — Audit

> Confiance : high

## Compréhension globale

La surface d'attaque est quasi nulle : un seul endpoint `GET /transfers` public, sans corps de requête, sans paramètre de query utilisé, sans dépendance externe. Les données exposées sont un catalogue public (routes, prix, places restantes) — aucune donnée personnelle, aucun secret. Malgré cette surface réduite, deux défauts de robustesse existent : un risque de crash sur URL malformée, et l'absence de headers CORS qui bloquera le frontend `shift-pilot-resa-web` en contexte navigateur.

## Résumé exécutif

Le codebase ne présente pas de vulnérabilité d'injection, d'exposition de secret, d'escalade de privilèges ni d'accès non autorisé à des données sensibles — les données sont publiques et hardcodées. Le risque principal est un crash de process par exception non attrapée dans le handler HTTP : `new URL(req.url, ...)` (`src/server.js:11`) lance une `TypeError` sur certains inputs malformés, sans `try/catch`. L'absence de headers CORS est le second problème concret : `shift-pilot-resa-web` (dépôt séparé, mentionné dans `README.md:4`) sera bloqué par le navigateur dès qu'il tournera sur une origine différente. Ces deux défauts sont corrigeables en quelques lignes. L'absence d'authentification est cohérente avec un endpoint de consultation publique, mais devra être adressée avant tout ajout d'endpoint mutable.

## Constats détaillés

**Crash sur URL malformée** — `VÉRIFIÉ_CODE` : `src/server.js:11` exécute `new URL(req.url, \`http://${req.headers.host}\`)` dans le callback de `http.createServer` sans bloc `try/catch`. Le constructeur `URL` lance une `TypeError: Invalid URL` lorsque `req.url` contient des caractères interdits ou une structure non parseable (ex. requêtes HTTP/0.9, scans de ports, proxy CONNECT). En Node.js ≥18, une exception non attrapée dans un callback `http.createServer` n'est pas silencieusement absorbée par le module `http` : elle remonte au processus. Sans `process.on('uncaughtException', ...)` (absent du codebase — `src/server.js` entier lu), le process crashe. C'est un vecteur de DoS involontaire par simple requête malformée.

**Cas `req.headers.host` absent** — `VÉRIFIÉ_CODE` : en HTTP/1.0, le header `Host` n'est pas obligatoire. Si `req.headers.host` vaut `undefined`, la base devient `'http://undefined'` — syntaxiquement valide, donc pas d'exception. Le parsing continue avec un hostname `'undefined'` (chaîne littérale) mais `url.pathname` reste correct. Ce cas dégradé ne crashe pas, mais le comportement est silencieusement inattendu.

**Absence de headers CORS** — `VÉRIFIÉ_CODE` : `sendJson` à `src/server.js:5-8` ne pose que `Content-Type: application/json`. `README.md:4` indique que l'API est consommée par `shift-pilot-resa-web` (dépôt séparé). Si les deux services tournent sur des origines différentes (ex. `:3100` vs `:3000`), les requêtes cross-origin d'un navigateur seront rejetées avec une erreur CORS avant même d'atteindre le serveur. Aucun header `Access-Control-Allow-Origin` n'est posé nulle part dans `src/server.js`.

**Absence d'authentification** — `VÉRIFIÉ_CODE` : `src/server.js` ne comporte aucun middleware de vérification d'identité (pas de token, pas de session, pas de header `Authorization` lu). Pour un endpoint de consultation publique (catalogue de transferts), c'est acceptable. `HYPOTHÈSE` : l'absence d'authentification est intentionnelle pour ce pilote ; elle devra être revue avant tout endpoint mutable (réservation, annulation).

**Absence de rate-limiting** — `VÉRIFIÉ_CODE` : aucun mécanisme de limitation du débit dans `src/server.js`. Pour un pilote de démonstration, c'est sans conséquence. En production, c'est un risque de surcharge.

**Aucune donnée sensible exposée** — `VÉRIFIÉ_CODE` : le catalogue exposé (`id, from, to, price, seatsLeft` — `src/server.js:15-19`) ne contient aucune donnée personnelle, aucun identifiant de session, aucun token. Les champs internes `seats` et `sold` ne sont pas exposés dans la projection HTTP. `package.json` ne contient aucun secret, aucune URL de base de données (`package.json:1-7`).

**Absence de secrets dans le code** — `VÉRIFIÉ_CODE` : revue complète des 4 fichiers sources — aucun token, mot de passe, clé API, DSN de base de données. La seule variable d'environnement lue est `PORT` (`src/server.js:26`), inoffensive.

## Forces

- Surface d'attaque quasi nulle : un seul endpoint `GET`, sans body parsing, sans query params utilisés.
- Aucune donnée sensible dans les réponses HTTP : `seats` et `sold` exclus de la projection (`src/server.js:15-19`).
- Zéro dépendance externe : pas de vulnérabilité NPM transitive possible (`package.json:7`).
- Pas de secret hardcodé dans le code source (revue complète des 4 fichiers).

## Dettes techniques

- **Pas de `try/catch` autour de `new URL(...)`** (`src/server.js:11`) : crash potentiel sur requête malformée.
- **Pas de headers CORS** : le frontend `shift-pilot-resa-web` sera bloqué par le navigateur en contexte cross-origin.
- **Pas de rate-limiting** : aucune protection contre la surcharge.

## Zones critiques

- `src/server.js:11` — parsing URL non gardé : seul point du code où une exception non attrapée peut faire crasher le process.

## Risques

- **DoS par requête malformée** : `new URL(req.url, ...)` sans `try/catch` (`src/server.js:11`). Impact : crash du process Node.js. Probabilité : faible sur un réseau contrôlé, non nulle sur internet.
- **Blocage CORS** : absence de `Access-Control-Allow-Origin` (`src/server.js:5-8`). Impact : `shift-pilot-resa-web` inutilisable depuis un navigateur sur une origine différente (`README.md:4`). Probabilité : certaine si les deux services tournent sur des ports différents.
- **Authentification absente avant extension** : `HYPOTHÈSE` — tout ajout d'un endpoint mutable (réservation) sans authentification crée un risque d'abus. Le risque n'est pas actif aujourd'hui (aucun endpoint mutable), mais le pattern du code ne prépare pas ce terrain.

## Recommandations priorisées

1. **Entourer `new URL(...)` d'un `try/catch`** et retourner un 400 sur exception — `src/server.js:11` — risque crash actif
2. **Ajouter `Access-Control-Allow-Origin`** dans `sendJson` ou dans un middleware — `src/server.js:5-8` — bloquant pour le frontend
3. **Prévoir une couche d'authentification** avant tout ajout d'endpoint mutable — décision architecturale à prendre en amont de l'implémentation

## Questions ouvertes

- `shift-pilot-resa-web` sera-t-il servi sur la même origine que l'API (ex. proxy inverse) ou sur un port différent ? La réponse détermine l'urgence du problème CORS.
- Un gestionnaire `process.on('uncaughtException', ...)` est-il posé au niveau superviseur (Docker, PM2) ou faut-il le gérer dans le code ?
