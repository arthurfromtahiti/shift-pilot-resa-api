# Architecture — Audit

> Confiance : high

## Compréhension globale

`shift-pilot-resa-api` est un service HTTP Node.js sans framework, délibérément minimal. Le code source tient en deux fichiers (~80 lignes), avec une séparation nette entre logique métier (`src/transfers.js`) et couche HTTP (`src/server.js`). L'architecture est celle d'un pilote de démonstration, pas d'un service de production — elle est cohérente avec ce positionnement.

## Résumé exécutif

Le projet affiche une séparation des responsabilités correcte pour sa taille : la logique métier ne connaît pas HTTP, et la couche HTTP délègue tout calcul au domaine. C'est sa principale force structurelle. En revanche, l'architecture souffre de deux fragilités : (1) le module métier (`src/transfers.js`) mélange les données statiques du catalogue et la logique de mutation — toute évolution vers une persistance vraie touchera ce même fichier sans frontière claire ; (2) le routage manuel dans `src/server.js` ne passe pas à l'échelle : chaque nouvel endpoint ajoute un bloc `if/regex` dans la même fonction de création du serveur, sans aucune abstraction de routeur. À deux endpoints, c'est lisible ; à dix, c'est ingérable. Ces points sont prévisibles pour un pilote et n'appellent pas de refactoring immédiat, mais ils doivent être nommés avant toute extension du service.

## Constats détaillés

**Séparation des couches (`VÉRIFIÉ_CODE`)** : `src/transfers.js` contient exclusivement la logique métier — tableau de données, calculs de disponibilité, mutation par réservation — sans aucune dépendance à `http` ou à tout module d'entrée/sortie. Réciproquement, `src/server.js` ne comporte aucun calcul métier : il parse les requêtes, appelle les fonctions du domaine et sérialise les réponses. La frontière est respectée sur la totalité des 80 lignes actuelles (`src/server.js:1-51`, `src/transfers.js:1-30`).

**Module de données + logique dans le même fichier (`VÉRIFIÉ_CODE`)** : `src/transfers.js:3-7` déclare le tableau `transfers` (les données) et lignes `9-27` les fonctions qui opèrent dessus, dans le même module. Pour un pilote en mémoire, c'est acceptable. Dès qu'on introduit une vraie persistance (PostgreSQL, Mongo…), ce fichier devra être découpé en au moins deux responsabilités (repository / service), sans qu'il existe aujourd'hui de frontière interne à respecter.

**Routage manuel sans abstraction (`VÉRIFIÉ_CODE`)** : `src/server.js:10-44` contient une unique fonction callback de `http.createServer` qui teste `url.pathname` et `req.method` par comparaison directe ou regex (`/^\/transfers\/(\d+)\/reserve$/`, `src/server.js:23`). Il n'y a pas de table de routes, pas de middleware, pas de framework de routage. L'ajout d'un troisième endpoint (par ex. `DELETE /transfers/:id/cancel`) exigera d'insérer un nouveau bloc `if/match` dans cette même fonction, qui devient alors responsable de l'ordre des vérifications, des conflits potentiels entre patterns, et de la lisibilité globale.

**Port configurable via variable d'environnement (`VÉRIFIÉ_CODE`)** : `process.env.PORT || 3100` (`src/server.js:47`). C'est la seule configuration externalisée ; tout le reste (catalogue de données, paramètres métier) est codé en dur. Pour un pilote, c'est suffisant, mais ce n'est pas extensible.

**Export du module serveur (`VÉRIFIÉ_CODE`)** : `module.exports = server` (`src/server.js:51`) — le serveur est exporté, ce qui permet aux tests d'importer et de démarrer une instance sur un port éphémère (`server.listen(0, ...)` dans `test/server.test.js:9`). C'est une bonne pratique qui rend le code testable sans modifier la logique principale. La garde `require.main === module` protège correctement le démarrage automatique (`src/server.js:48`).

## Forces

- **Séparation domaine / HTTP réelle** : aucune logique métier dans `server.js`, aucune dépendance I/O dans `transfers.js` — la frontière tient sur l'intégralité du code actuel (`src/transfers.js:1-30`, `src/server.js:1-51`).
- **Testabilité structurelle** : l'export du serveur et la garde `require.main` permettent aux tests HTTP de démarrer une instance isolée sans effet de bord (`test/server.test.js:8-12`). Un test n'a pas besoin de mocker `http.createServer`.
- **Absence de dépendances externes** : `package.json` ne déclare aucune dépendance de production. Aucune surface d'attaque via la chaîne de dépendances, aucun risque de rupture par mise à jour tierce.

## Dettes techniques

- **Catalogue de données et logique métier dans le même module** : `src/transfers.js` mélange données statiques (`const transfers = [...]`, lignes 3-7) et fonctions de manipulation (lignes 9-27). Une migration vers une persistance externe demandera une extraction et créera une rupture de contrat sur les exports actuels.
- **Routage sans abstraction** : la fonction de dispatching dans `src/server.js:10-44` croît linéairement avec le nombre d'endpoints. Au-delà de 3-4 routes, la lisibilité et la maintenabilité dégradent significativement sans introduction d'un routeur.
- **Configuration non externalisée** : le catalogue des transferts (`src/transfers.js:3-7`), les codes d'erreur (`"Transfer not found"`, `"Transfer full"`) et le port par défaut (3100) sont tous codés en dur. Toute personnalisation exige un changement de code.

## Zones critiques

- **`src/server.js` lignes 10-44** : point de routage unique. Toute nouvelle route sera ajoutée ici, dans la même fonction de création du serveur. Un senior regarderait en premier cette zone pour évaluer le coût d'ajout d'un endpoint et les risques de conflits de pattern.
- **`src/transfers.js` lignes 3-7** : données statiques mélangées à la logique. Un senior noterait immédiatement que la frontière persistance/service n'existe pas — preuve que le projet n'a pas encore abordé la question de la durabilité.

## Risques

- **Scalabilité du routage** : chaque endpoint ajoute de la complexité à une fonction centrale et augmente le risque de conflits entre patterns regex — `HYPOTHÈSE`, non mesuré mais structurellement inévitable si le service s'étend.
- **Absence de frontière persistance/service** : si une base de données est introduite, le fichier `src/transfers.js` devra être découpé. En l'état, il n'y a pas de contrat clair entre « comment les données sont stockées » et « ce que la logique métier garantit » — `VÉRIFIÉ_CODE` (`src/transfers.js:3-27`).

## Recommandations priorisées

1. **Introduire un routeur minimal** avant l'ajout d'un troisième endpoint — même une table de routes en objet suffit à éviter la prolifération des blocs `if` dans `server.js:10-44`. Priorité : basse (deux routes actuellement, risque faible aujourd'hui, coût croissant).
2. **Séparer données et logique métier** dans `src/transfers.js` en prévision de la persistance — créer un `transferRepository` qui expose le tableau (ou un accès DB à terme) et garder les fonctions pures dans `transfers.js`. Priorité : basse jusqu'à l'introduction de la base, haute dès que la base est décidée.

## Questions ouvertes

- Quel framework HTTP (si un framework est choisi) guidera l'extension du routage ? L'ajout d'Express, Fastify ou Hono changerait profondément `src/server.js`.
- La séparation des couches doit-elle être formalisée (architecture hexagonale, ports/adapters) ou rester pragmatique pour ce niveau de service ?
