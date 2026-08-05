# Architecture — Audit

> Confiance : high

## Compréhension globale

`shift-pilot-resa-api` est un service Node.js minimaliste de 2 fichiers source (~51 lignes au total) sans framework ni dépendance externe. L'unique frontière architecturale est la séparation entre transport HTTP (`src/server.js`) et logique de domaine/données (`src/transfers.js`). Il n'existe pas de couche de persistance, pas de middleware, pas d'abstraction de routage.

## Résumé exécutif

L'architecture est volontairement rudimentaire, cohérente avec la mention explicite de « pilote de démonstration » (`src/transfers.js:1`). La séparation transport/domaine est propre et suffisante pour l'échelle actuelle (1 route, 3 fonctions). Deux risques structurels méritent attention avant toute évolution : `listTransfers()` expose une référence mutable au tableau interne, et le routage ad hoc (`if/else` direct dans le handler) ne scalera pas au-delà de 2-3 routes sans refactoring. L'absence de script de démarrage dans `package.json` est une dette documentaire légère. Aucun problème bloquant pour l'usage pilote actuel ; les dettes deviennent critiques dès l'ajout d'un endpoint de réservation.

## Constats détaillés

**Séparation des responsabilités** — `VÉRIFIÉ_CODE` : `src/server.js:3` importe uniquement `{ listTransfers, seatsLeft }` de `./transfers`. Le serveur ne connaît pas la structure interne du tableau `transfers` ; il construit sa projection (`id, from, to, price, seatsLeft`) sans accéder aux champs `seats` ou `sold` directement (`src/server.js:14-20`). Cette encapsulation est correcte et explicitement respectée.

**Référence mutable exposée** — `VÉRIFIÉ_CODE` : `listTransfers()` retourne `transfers` sans copie (`src/transfers.js:9-11: return transfers`). `transfers` est la constante module-level déclarée à `src/transfers.js:3`. Tout appelant disposant du résultat peut écrire `listTransfers()[0].sold = 999` et muter l'état global du module. L'appelant actuel (`src/server.js:14`) utilise `.map()` qui lit sans muter, mais le contrat n'est pas garanti par le code lui-même.

**Routage inline** — `VÉRIFIÉ_CODE` : la logique de routage est un `if` unique sur `url.pathname` et `req.method` (`src/server.js:13`), suivi d'un `sendJson(res, 404, ...)` catch-all (`src/server.js:23`). Pour une route, c'est lisible. Pour 4-5 routes (catalogue, réservation, annulation, statut), ce pattern devient illisible et source d'erreurs.

**Guard `require.main === module`** — `VÉRIFIÉ_CODE` (`src/server.js:27`) : ce guard isole l'écoute du port de l'import du module, permettant aux tests d'importer `server` sans démarrer de listener. C'est une pratique Node.js standard, correctement appliquée.

**Absence de script de démarrage** — `VÉRIFIÉ_CODE` : `package.json:6` définit uniquement `"test": "node --test test/"`. Démarrer le serveur requiert `node src/server.js` ; le port par défaut est 3100 (`src/server.js:26`). Ce n'est pas documenté dans `package.json`, seulement implicitement dans le code.

**Absence d'injection de dépendance sur la source de données** — `VÉRIFIÉ_CODE` : le tableau `transfers` est une constante module-level (`src/transfers.js:3`). Pour substituer la source (base de données, fichier, API externe), il faudra modifier `transfers.js` lui-même — il n'existe pas de mécanisme d'injection.

## Forces

- Séparation transport/domaine claire : `src/server.js` ne connaît pas la structure interne des objets `transfer` (`src/server.js:14-20`).
- Zéro dépendance externe : surface d'attaque supply-chain nulle, pas de `node_modules` à auditer (`package.json:1-7`).
- Guard `require.main === module` : architecture testable par construction (`src/server.js:27`).
- `sendJson` centralisé : la sérialisation JSON et le `Content-Type` sont gérés en un seul endroit (`src/server.js:5-8`).

## Dettes techniques

- **Référence mutable** : `listTransfers()` expose le tableau interne sans copie défensive (`src/transfers.js:10`). Toute évolution qui modifie `sold` au runtime devra gérer ce risque explicitement.
- **Routage ad hoc** : le `if/else` inline dans le handler (`src/server.js:13-23`) ne scalera pas au-delà de 2-3 routes.
- **Pas de script `start`** dans `package.json` — dette documentaire et opérationnelle légère.

## Zones critiques

- `src/server.js:11` — parsing URL sans `try/catch` (voir `SECURITY_ROBUSTNESS_AUDIT.md`) : si le routage est étendu, tout appel à `url.pathname` repose sur ce parsing potentiellement defaillant.
- `src/transfers.js:9-11` — `listTransfers()` retourne la référence brute : point d'entrée de toute mutation accidentelle de l'état global.

## Risques

- **Crash sur URL malformée** : le handler HTTP n'attrape pas les exceptions de `new URL(...)` (`src/server.js:11`). Une requête malformée peut faire crasher le process (voir `SECURITY_ROBUSTNESS_AUDIT.md`). Ce risque est architectural : il n'existe pas de couche de récupération d'erreur.
- **Couplage fort données/logique** : `transfers.js` est à la fois le store de données et le module de logique métier. Toute modification des règles de disponibilité ou de la source de données touche le même fichier.

## Recommandations priorisées

1. **Ajouter un `try/catch` autour du parsing URL** — risque crash actif — `src/server.js:11`
2. **Retourner une copie dans `listTransfers()`** — prévenir la mutation accidentelle — `src/transfers.js:10` (`return [...transfers]` ou `return transfers.slice()`)
3. **Ajouter un script `start`** dans `package.json` — dette documentaire/opérationnelle légère

## Questions ouvertes

- L'architecture sera-t-elle renforcée (framework, router, ORM) avant de passer en production, ou le pilote sera-t-il remplacé par une implémentation de zéro ?
- La source de données restera-t-elle en mémoire ou sera-t-elle remplacée par une base — ce choix détermine entièrement l'ampleur du refactoring nécessaire.
