# Sécurité & Robustesse — Audit

> Confiance : high

## Compréhension globale

`shift-pilot-resa-api` est une API publique en lecture seule, sans authentification, sans base de données, sans traitement d'entrée utilisateur au-delà du pathname de l'URL. Sa surface d'attaque est quasi nulle dans son état actuel : il n'y a pas de donnée sensible, pas de secret, pas d'écriture. L'unique risque de robustesse prouvé est l'absence de `try/catch` dans le handler HTTP, qui peut conduire à une absence de réponse en cas d'exception inattendue.

## Résumé exécutif

Pas de secrets dans le code (`package.json` : zéro dépendance externe, zéro credential). Les données exposées sont entièrement publiques : noms de trajet, prix, places. Aucune route d'écriture n'existe — les risques d'injection ou de modification non autorisée sont inexistants dans ce périmètre.

Le seul vecteur de robustesse identifié : le callback `http.createServer` ne contient aucun `try/catch` (`src/server.js:10-23`). Une exception non attrapée dans `new URL()`, `listTransfers()`, le `.map()` ou `JSON.stringify()` provoquerait une erreur non gérée au niveau du handler — le client verrait soit une connexion abruptement fermée, soit une réponse sans corps, selon la version de Node.js et le moment de l'exception. Cela n'est pas un risque de sécurité mais un risque de disponibilité.

`req.headers.host` est utilisé comme base pour parser `req.url` (`src/server.js:11`). Si un client HTTP/1.0 omet l'en-tête `Host`, `req.headers.host` vaut `undefined`, et `new URL(req.url, 'http://undefined')` s'exécutera sans exception — le pathname sera correctement extrait car `new URL` tolère ce format. Ce cas est marginal et sans conséquence de sécurité, mais il est relevé pour honnêteté.

Aucun en-tête de sécurité HTTP n'est posé (pas de CORS, pas de `X-Content-Type-Options`, pas de `Strict-Transport-Security`). Pour un pilote d'API JSON, c'est un défaut mineur attendu, à corriger avant mise en production.

## Constats détaillés

**Absence de secrets dans le code — VÉRIFIÉ_CODE.** `package.json` ne déclare aucune dépendance externe (`src/transfers.js` et `src/server.js` n'importent que `node:http`, `node:url`, `node:test`, `node:assert/strict`). Aucun token, clé API, mot de passe, chaîne de connexion ni variable d'environnement sensible n'est présent dans le dépôt. Les seules valeurs hardcodées sont des données métier publiques (prix, noms de villes) et le port par défaut `3100`.

**Aucun traitement d'entrée utilisateur — VÉRIFIÉ_CODE.** La seule entrée du système est l'URL de la requête HTTP. Le code en extrait uniquement `url.pathname` (`src/server.js:11-13`) pour le routage — il ne lit pas `url.searchParams`, `req.body`, ni aucun header spécifique hors `Host`. Le risque d'injection est inexistant dans ce périmètre.

**Absence de `try/catch` dans le handler — VÉRIFIÉ_CODE.** Le callback de `http.createServer` (`src/server.js:10-24`) ne contient aucune gestion d'exception. En pratique, les seuls chemins d'exception possibles sont : (1) `new URL(req.url, ...)` si `req.url` est `null` (HTTP malformé) ; (2) une exception dans `listTransfers()` (impossible avec le code actuel, tableau constant) ; (3) `JSON.stringify()` si le graphe contient une référence circulaire (impossible avec le modèle actuel). Avec le code existant, aucune de ces exceptions ne peut survenir — mais le pattern reste fragile pour tout ajout futur.

**Utilisation de `req.headers.host` — VÉRIFIÉ_CODE.** `src/server.js:11` : `` new URL(req.url, `http://${req.headers.host}`) ``. L'absence de header `Host` (requête HTTP/1.0) produit `` `http://undefined` `` comme base, ce que `URL` accepte sans exception. Le pathname est extrait correctement. Ce n'est pas un vecteur d'attaque, mais l'URL parsée aurait un hostname bizarre si jamais utilisée autrement que pour son pathname.

**Pas de CORS ni d'en-têtes de sécurité — VÉRIFIÉ_CODE.** `sendJson` (`src/server.js:5-8`) ne pose que `Content-Type: application/json`. Aucun `Access-Control-Allow-Origin`, `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`. Pour un service backend consommé par `shift-pilot-resa-web` sur le même domaine ou en développement local, l'absence de CORS peut bloquer les appels cross-origin en production. Pour une mise en production, ces en-têtes sont nécessaires.

**Pas d'authentification ni d'autorisation — VÉRIFIÉ_CODE.** N'importe quel client peut appeler `GET /transfers` sans credential. Pour un catalogue public de transferts inter-îles, c'est une décision légitime. Si une route d'écriture (prise de réservation) est ajoutée, l'authentification doit être introduite simultanément.

**Pas de limitation de débit ni de timeout — VÉRIFIÉ_CODE (absence).** Les défauts Node.js s'appliquent. Pour un pilote, c'est acceptable. Pour une mise en production, un reverse proxy (Nginx, Caddy) doit prendre en charge ces aspects.

## Forces

- **Zéro secret dans le code** : aucune valeur sensible dans `src/`, `test/` ni `package.json`.
- **Surface d'entrée minimale** : seul `url.pathname` est extrait de la requête ; aucun corps, aucun paramètre, aucun header spécifique n'est traité.
- **Données 100 % publiques** : le catalogue de transferts ne contient aucune donnée personnelle ni confidentielle.
- **Pas de dépendance externe** : pas de supply chain, pas de `node_modules` à auditer, pas de CVE possible sur des packages tiers.

## Dettes techniques

- **Absence de `try/catch` dans le handler HTTP** (`src/server.js:10-24`) : la robustesse repose sur l'impossibilité actuelle d'une exception dans le code minimal — fragile dès l'ajout de logique.
- **Pas d'en-têtes CORS** (`src/server.js:5-8`) : bloquant pour une consommation cross-origin en production.
- **Pas de `.gitignore`** : aucun fichier sensible n'existe aujourd'hui (pas de `.env`), mais l'absence de `.gitignore` expose le dépôt à un commit accidentel de fichiers locaux si l'environnement de développement évolue.

## Zones critiques

- **`src/server.js:10-23` — handler sans filet d'exception** : un senior qui ajoute une route lisant une base de données ou appelant un service externe découvrira que la moindre exception y est fatale pour la connexion sans retour d'erreur HTTP structuré au client.

## Risques

- **Dégradation silencieuse à l'ajout d'une route d'écriture** : si une route `POST /reservations` est ajoutée sans introduire simultanément authentification et `try/catch`, l'API passera d'un service public bénin à un service d'écriture non authentifié. Preuve du contexte actuel : `src/server.js:13` (seule route, lecture) et absence de tout `POST` dans `src/server.js`.
- **Absence de réponse en cas d'exception imprévue** : sans `try/catch`, une exception dans le handler HTTP peut laisser la connexion sans réponse ni fermeture propre, bloquant le client indéfiniment (selon les timeouts client). Impact actuel : faible (code actuel sans chemin d'exception). Impact futur : moyen à fort dès la première route non triviale.
- **Appel cross-origin bloqué sans CORS** : `shift-pilot-resa-web` consomme cette API. Si les deux ne partagent pas le même origin en production, tous les appels navigateur seront bloqués par le CORS browser. Preuve : `src/server.js:5-8` (pas d'en-tête CORS dans `sendJson`).

## Recommandations priorisées

1. **Ajouter un `try/catch` global autour du handler** (`src/server.js:10-23`) qui retourne `500 { error: "Internal server error" }` en cas d'exception — avant tout ajout de route.
2. **Ajouter les en-têtes CORS** dans `sendJson` (`src/server.js:5-8`), au minimum `Access-Control-Allow-Origin: *` en développement, restreint à l'origin de `shift-pilot-resa-web` en production.
3. **Créer un `.gitignore`** minimal (`.env`, `node_modules/`, etc.) avant tout élargissement de l'environnement de développement.
4. **Planifier l'authentification** avant l'implémentation de toute route d'écriture (réservation, modification du stock).

## Questions ouvertes

- L'API sera-t-elle derrière un reverse proxy (Nginx, Caddy) qui gère CORS, rate limiting et TLS ? Aucune configuration infra trouvée dans le dépôt.
- Le port `3100` sera-t-il exposé directement ou via un proxy ? L'absence de HTTPS dans le code est normale dans le premier cas, problématique dans le second.
- Si une route d'écriture est ajoutée, quel mécanisme d'authentification est envisagé (session, JWT, API key) ?
