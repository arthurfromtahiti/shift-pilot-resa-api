# Architecture — Audit

> Confiance : high
> Mode : RÉCONCILIATION SHIA-571 (HEAD `8a108d1`). Deux évolutions impactent la structure : SHIA-396 a ajouté `cancelReservation()` + l'endpoint DELETE (troisième route), SHIA-408 a câblé `isFull()` et ajouté le query param `?available=true`. Le codebase est passé de ~80 à ~114 lignes de production.

## Compréhension globale

`shift-pilot-resa-api` est un service HTTP Node.js sans framework, délibérément minimal. Le code source tient en deux fichiers (~114 lignes), avec une séparation nette entre logique métier (`src/transfers.js`) et couche HTTP (`src/server.js`). L'architecture est celle d'un pilote de démonstration — elle est cohérente avec ce positionnement. Les évolutions récentes (annulation, filtre de disponibilité) ont suivi la même structure sans modifier les principes architecturaux.

## Résumé exécutif

Le projet affiche une séparation des responsabilités correcte pour sa taille : la logique métier ne connaît pas HTTP, et la couche HTTP délègue tout calcul au domaine. C'est sa principale force structurelle. En revanche, l'architecture souffre de deux fragilités : (1) le module métier (`src/transfers.js`) mélange les données statiques du catalogue et la logique de mutation — toute évolution vers une persistance vraie touchera ce même fichier sans frontière claire ; (2) le routage manuel dans `src/server.js` ne passe pas à l'échelle : chaque nouvel endpoint ajoute un bloc `if/regex` dans la même fonction de création du serveur, sans abstraction de routeur. À trois endpoints, c'est encore lisible ; au-delà, c'est ingérable.

## Constats détaillés

**Séparation des couches (`VÉRIFIÉ_CODE`)** : `src/transfers.js` contient exclusivement la logique métier — tableau de données, calculs de disponibilité, mutations par réservation et annulation — sans aucune dépendance à `http` ou à tout module d'entrée/sortie. Réciproquement, `src/server.js` ne comporte aucun calcul métier : il parse les requêtes, appelle les fonctions du domaine et sérialise les réponses. La frontière est respectée sur la totalité des 114 lignes actuelles (`src/server.js:1-66`, `src/transfers.js:1-46`).

**Module de données + logique dans le même fichier (`VÉRIFIÉ_CODE`)** : `src/transfers.js:5-9` déclare le tableau `transfers` (les données statiques), ligne 11 la Map `reservations` (l'état mutable des réservations), et lignes 13-46 les cinq fonctions qui opèrent dessus, dans le même module. Pour un pilote en mémoire, c'est acceptable. Si une persistance est introduite, un découpage en responsabilités distinctes (repository / service) serait probablement nécessaire — `HYPOTHÈSE` conditionnelle à une décision non encore prise, pas un état observé.

**Routage manuel sans abstraction (`VÉRIFIÉ_CODE`)** : `src/server.js:10-59` contient une unique fonction callback de `http.createServer` qui teste `url.pathname` et `req.method` par comparaison directe ou regex. Trois blocs de dispatching coexistent :
- `if (url.pathname === "/transfers" && req.method === "GET")` (`src/server.js:13`)
- `if (reserveMatch && req.method === "POST")` avec regex `/^\/transfers\/(\d+)\/reserve$/` (`src/server.js:25-26`)
- `if (cancelMatch && req.method === "DELETE")` avec regex `/^\/transfers\/(\d+)\/reservations\/([^/]+)$/` (`src/server.js:50-51`)

L'ajout d'un quatrième endpoint exigera d'insérer un nouveau bloc dans cette même fonction, avec les risques d'ambiguïté de pattern et de lisibilité dégradée.

**Port configurable via variable d'environnement (`VÉRIFIÉ_CODE`)** : `process.env.PORT || 3100` (`src/server.js:62`). C'est la seule configuration externalisée.

**Export du module serveur (`VÉRIFIÉ_CODE`)** : `module.exports = server` (`src/server.js:66`). La garde `require.main === module` (`src/server.js:63-65`) protège le démarrage automatique. Les tests démarrent une instance sur un port éphémère (`server.listen(0, ...)` dans `test/server.test.js:9`).

## Forces

- **Séparation domaine / HTTP réelle** : aucune logique métier dans `server.js`, aucune dépendance I/O dans `transfers.js` — la frontière tient sur l'intégralité des 114 lignes actuelles (`src/transfers.js:1-46`, `src/server.js:1-66`).
- **Testabilité structurelle** : l'export du serveur et la garde `require.main` permettent aux tests HTTP de démarrer une instance isolée sans effet de bord (`test/server.test.js:8-15`).
- **Absence de dépendances externes** : `package.json` ne déclare aucune dépendance de production (`package.json:1-6`). La surface d'attaque via la chaîne de dépendances est fortement réduite — le risque supply chain est minimal dans ce contexte, non nul au sens général.
- **Croissance cohérente** : les deux évolutions récentes (SHIA-396, SHIA-408) ont respecté l'architecture existante — aucune nouvelle dépendance entre les couches, aucun contournement de la séparation.

## Dettes techniques

- **Catalogue de données, état mutable et logique métier dans le même module** : `src/transfers.js` mélange données statiques (`transfers`, lignes 5-9), état mutable des réservations (`reservations`, ligne 11) et cinq fonctions de manipulation (lignes 13-46). Une migration vers une persistance externe nécessiterait probablement une extraction et une redéfinition des exports — `HYPOTHÈSE` conditionnelle à une décision non encore prise.
- **Routage sans abstraction** : la fonction de dispatching dans `src/server.js:10-59` croît linéairement avec le nombre d'endpoints. Au-delà de 4-5 routes, la lisibilité et la maintenabilité dégradent significativement sans introduction d'un routeur.
- **Configuration non externalisée** : le catalogue des transferts (`src/transfers.js:5-9`), les messages d'erreur (`"Transfer not found"`, `"Transfer full"`) et le port par défaut (3100) sont tous codés en dur.

## Zones critiques

- **`src/server.js` lignes 10-59** : point de routage unique. Toute nouvelle route sera ajoutée ici, dans la même fonction de création du serveur.
- **`src/transfers.js` lignes 5-9** : données statiques mélangées à la logique. Un senior noterait immédiatement que la frontière persistance/service n'existe pas.
- **`src/transfers.js` ligne 11** : `const reservations = new Map()` — état mutable global du process, à côté des données statiques. Ces deux natures d'état (catalogue immuable + réservations mutables) dans le même module sont conceptuellement distinctes mais non séparées.

## Risques

- **Scalabilité du routage** : chaque endpoint ajoute de la complexité à une fonction centrale et augmente le risque de conflits entre patterns regex — `HYPOTHÈSE`, structurellement inévitable si le service s'étend.
- **Absence de frontière persistance/service** : si une base de données est introduite, le fichier `src/transfers.js` devrait être découpé — `HYPOTHÈSE` (projection conditionnelle) ; le fait observé est l'absence de frontière interne entre catalogue et logique (`VÉRIFIÉ_CODE`, `src/transfers.js:5-46`).

## Recommandations priorisées

1. **Introduire un routeur minimal** avant l'ajout d'un quatrième endpoint — même une table de routes en objet suffit à éviter la prolifération des blocs `if` dans `src/server.js:10-59`. Priorité : **basse** (trois routes actuellement, risque faible aujourd'hui, coût croissant).
2. **Séparer données et logique métier** dans `src/transfers.js` en prévision de la persistance — créer un `transferRepository` qui expose le tableau (ou un accès DB à terme) et garder les fonctions pures dans `transfers.js`. Priorité : **basse** jusqu'à l'introduction de la base, haute dès que la base est décidée.

## Questions ouvertes

- Quel framework HTTP (si un framework est choisi) guidera l'extension du routage ? L'ajout d'Express, Fastify ou Hono changerait profondément `src/server.js`.
- La séparation des couches doit-elle être formalisée (architecture hexagonale, ports/adapters) ou rester pragmatique pour ce niveau de service ?

## Journal de réconciliation

| Élément | Version précédente | Version actuelle (HEAD `8a108d1`) | Action |
|---|---|---|---|
| Taille codebase | ~80 lignes (`src/server.js:51`, `src/transfers.js:30`) | **~114 lignes** (`src/server.js:67`, `src/transfers.js:47`) | **Mis à jour** |
| Nombre d'endpoints | 2 (GET, POST) | **3** (GET, POST, DELETE) | **Mis à jour** |
| Zone de routage | `src/server.js:10-44` (2 blocs) | **`src/server.js:10-59`** (3 blocs) | **Mis à jour** |
| PORT ligne | `src/server.js:47` | **`src/server.js:62`** | Numéro **mis à jour** |
| `require.main` garde | `src/server.js:48` | **`src/server.js:63-65`** | Numéro **mis à jour** |
| `module.exports` | `src/server.js:51` | **`src/server.js:66`** | Numéro **mis à jour** |
| Couche métier références | `src/transfers.js:1-30`, fonctions `9-27` | **`src/transfers.js:1-46`**, fonctions `13-46` | **Mis à jour** |
| `cancelReservation` | Absent | **`src/transfers.js:36-44`** — nouvelle fonction, mentionne la `reservations Map` ligne 11 | **Ajouté** |
| Séparation des couches | Confirmée sur ~80 lignes | **Confirmée sur ~114 lignes** — évolutions respectent la frontière | **Confirmé et étendu** |
