# Architecture — Audit

> Confiance : high

## Compréhension globale

`shift-pilot-resa-api` est une API HTTP Node.js écrite sans framework, organisée en deux fichiers source totaling 53 lignes de code métier. La séparation entre couche HTTP (`src/server.js`) et couche données/calcul (`src/transfers.js`) est nette et intentionnelle. À ce niveau de taille, l'architecture est saine et sans surprises ; les risques identifiés sont des signaux d'alerte pour la croissance, non des défauts actuels.

## Résumé exécutif

Le projet adopte une architecture à deux couches : `src/transfers.js` porte les données en mémoire et les fonctions de calcul métier (`listTransfers`, `seatsLeft`, `isFull`) ; `src/server.js` porte la couche HTTP (routage, sérialisation JSON, écoute du port). Aucune dépendance externe : uniquement `node:http` et `node:url` (modules natifs).

La couche HTTP est un seul grand callback `http.createServer` qui route, appelle la logique métier, projette la réponse et sérialise en JSON — toutes ces responsabilités sont inline sur 15 lignes (`src/server.js:10-23`). Pour une route unique, c'est acceptable ; dès la deuxième route, ce callback devient le point d'accumulation naturel de toute la logique applicative.

Deux bonnes pratiques de conception sont présentes : le guard `require.main === module` (`src/server.js:27`) empêche le démarrage du serveur lors des imports en test ; `module.exports = server` (`src/server.js:30`) rend le serveur testable sans démarrage. Ces choix délibérés montrent que l'auteur a anticipé un usage en test.

La donnée (`transfers`) est un tableau module-level déclaré en `const` (`src/transfers.js:3-7`). `listTransfers()` retourne la référence directe du tableau (`src/transfers.js:9-11`), ce qui l'expose à une mutation externe sans avertissement.

L'architecture est adaptée au périmètre pilote. Son principal risque est structural : une seule route aujourd'hui, mais la forme actuelle du callback serveur ne guidera pas naturellement vers une organisation propre quand le périmètre s'étendra.

## Constats détaillés

**Séparation HTTP / métier — VÉRIFIÉ_CODE.** `src/server.js:3` importe uniquement `{ listTransfers, seatsLeft }` depuis `./transfers` ; la logique de calcul ne remonte jamais dans le fichier serveur autrement que par appel de fonction. La frontière est propre. En miroir, `src/transfers.js` ne contient aucune référence à `http`, `res`, `req` ou au format de réponse API — la logique métier est agnostique du protocole.

**Projection inline — VÉRIFIÉ_CODE.** La transformation du modèle interne vers le modèle de réponse API (exclusion de `seats` et `sold`, inclusion de `seatsLeft`) est réalisée directement dans le handler, sur `src/server.js:14-20`, sans fonction nommée ni couche dédiée. Pour une projection, c'est du code lisible. Pour deux ou trois projections, ce pattern conduit à de la logique de sérialisation éparpillée dans les handlers.

**Routage ad hoc — VÉRIFIÉ_CODE.** Le routage est un `if` unique sur `url.pathname === "/transfers" && req.method === "GET"` (`src/server.js:13`), suivi du handler par défaut `404` (`src/server.js:23`). Sans abstraction de routeur, ajouter une seconde route revient à chaîner des `if/else if` dans le même callback. Ce pattern plafonne rapidement.

**Tableau mutable exposé — VÉRIFIÉ_CODE.** `listTransfers()` retourne `transfers` sans copie (`src/transfers.js:9-11`). Un appelant ayant la référence pourrait pousser ou modifier des éléments ; la mutation serait persistante pour la durée de vie du processus. Pour un projet read-only sur des données statiques, c'est sans risque actuel — mais c'est une surface de bug latente si une route d'écriture est ajoutée sans revenir sur cette fonction.

**Guard module.main — VÉRIFIÉ_CODE.** `if (require.main === module)` (`src/server.js:27`) permet à `src/server.js` d'être importé par un test sans déclencher `server.listen`. Pattern correct et intentionnel.

**Absence de CI, de Dockerfile, de gestionnaire de processus — VÉRIFIÉ_CODE (par absence après recherche dans l'ensemble du dépôt).** Aucun `.github/`, aucun `Dockerfile`, aucun `Procfile`, aucun `ecosystem.config.js`, aucun script de démarrage de prod. Cohérent avec un pilote de démonstration, mais à adresser avant tout déploiement.

## Forces

- **Séparation HTTP/métier nette** : `src/server.js` ne contient aucune règle métier, `src/transfers.js` aucun code HTTP. (`src/server.js:3`, `src/transfers.js:1-21`)
- **Zéro dépendance externe** : `package.json` ne déclare aucune `dependency` ni `devDependency`. Aucune surface d'attaque supply-chain, aucune maintenance de librairies tierces.
- **Guard `require.main === module`** : testabilité du serveur sans effet de bord de démarrage. (`src/server.js:27`)
- **Port configurable** : `process.env.PORT || 3100` (`src/server.js:26`) permet un déploiement sans modifier le code.

## Dettes techniques

- **Projection non nommée** : la transformation modèle interne → réponse API est anonyme et inline (`src/server.js:14-20`). Pas une dette bloquante à ce stade, mais un signal de refactoring à anticiper.
- **Routeur implicite** : le routage par `if/else if` sur pathname/méthode dans le callback `createServer` (`src/server.js:10-23`) ne passe pas à l'échelle au-delà de deux ou trois routes.
- **`listTransfers()` retourne la référence mutable** (`src/transfers.js:9-11`) : pattern fragile si des routes d'écriture sont ajoutées.

## Zones critiques

- **`src/server.js:10-23` — le callback unique.** C'est ici que tout se passe : réception, parsing URL, routage, appel métier, projection, sérialisation. Un senior ouvrirait ce fichier en premier dès qu'il y a une regression sur la route ou un ajout de route — sa croissance est à surveiller.

## Risques

- **Explosion du callback serveur à la prochaine route** : la forme actuelle (un `if` suivi d'un `sendJson` par défaut) impose d'ajouter les routes inline dans le même callback. Impact : lisibilité et maintenabilité dégradées dès la deuxième route. Preuve : `src/server.js:13-23`.
- **Mutation silencieuse du catalogue** : si une route d'écriture appelle `listTransfers()` et modifie l'array retourné, tous les appels suivants à `GET /transfers` retourneront l'état altéré jusqu'au redémarrage. Preuve : `src/transfers.js:9-11`.

## Recommandations priorisées

1. **Introduire une couche de routage avant la deuxième route** — même minimale (`Map<string, Function>` ou switch) — pour éviter l'accumulation de logique dans le callback createServer. — `src/server.js:10-23`
2. **Nommer la projection de réponse** — extraire le `.map()` en fonction `formatTransfer(t)` dans `src/transfers.js` ou un fichier dédié — pour rendre la sérialisation testable indépendamment. — `src/server.js:14-20`
3. **Protéger le catalogue contre la mutation** — retourner `[...transfers]` ou `transfers.map(t => ({...t}))` dans `listTransfers()` avant d'ajouter toute route d'écriture. — `src/transfers.js:9-11`
4. **Ajouter infrastructure de déploiement** (Dockerfile ou équivalent, `.gitignore`, CI) avant tout déploiement hors pilote.

## Questions ouvertes

- Quelle est la stratégie d'évolution prévue ? Un framework Express/Fastify sera-t-il introduit, ou restera-t-on sur Node natif ?
- Le port `3100` est-il un standard dans l'infrastructure de `shift-pilot-resa-web` (reverse proxy, compose) ? Aucune configuration infra trouvée dans ce dépôt.
- Y a-t-il un environnement de déploiement cible (conteneur, PaaS, VM) ? Le README ne le mentionne pas.
