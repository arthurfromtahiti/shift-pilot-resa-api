# Points chauds du code — Audit

> Confiance : high

## Compréhension globale

Avec 3 fichiers source et ~68 lignes de code, la notion de « hotspot » se réduit à quelques loci très précis. Il n'existe pas de fichier gonflé, pas de couplage circulaire, pas de code mort significatif. Les zones à risque sont deux : `src/server.js:11` (URL parsing sans garde), et `src/transfers.js:9-11` (référence mutable exposée). Un troisième point — `isFull` exportée mais non câblée à HTTP — est une bombe à retardement documentaire pour un développeur futur.

## Résumé exécutif

La base de code est trop petite pour présenter des hotspots classiques (fichier de 600 lignes, classe God, couplage afférent élevé). Les risques sont concentrés sur deux lignes précises dans deux fichiers. Le risque le plus sévère est `src/server.js:11` : une exception non attrapée dans le handler HTTP peut faire crasher le process sur n'importe quelle requête malformée. Le second risque, `src/transfers.js:9-11`, est latent : `listTransfers()` retourne la référence interne du tableau, ce qui devient un vecteur de corruption silencieuse dès l'ajout d'un endpoint mutable. La fonction `isFull` est exportée sans être consommée par le serveur HTTP — son existence non câblée représente un risque de réimplémentation divergente par un développeur futur.

## Constats détaillés

**Hotspot 1 : `src/server.js:11` — parsing URL non gardé**

`VÉRIFIÉ_CODE` : `const url = new URL(req.url, \`http://${req.headers.host}\`);` est appelé pour chaque requête HTTP entrante, sans bloc `try/catch`. Le constructeur `URL` lève une `TypeError: Invalid URL` lorsque l'URL n'est pas parseable. Exemples déclencheurs : une requête HTTP/0.9 sans chemin, un scan de ports envoyant une ligne de requête non conforme (`CONNECT example.com:443 HTTP/1.1`), ou un payload d'un fuzzer. Cette ligne est la seule dans le codebase où une exception peut échapper au handler — et elle se trouve sur le chemin critique de chaque requête. Le risque est amplifié par l'absence de tout gestionnaire `process.on('uncaughtException')` dans le code source (`src/server.js` relu en entier).

Ce hotspot est directement lié au workflow `LISTE_TRANSFERTS` (l'unique workflow HTTP du service) : tout appel à `GET /transfers` passe par cette ligne. Un crash ici rend le service entièrement indisponible.

**Hotspot 2 : `src/transfers.js:9-11` — référence mutable retournée**

`VÉRIFIÉ_CODE` : 
```js
function listTransfers() {
  return transfers;  // référence directe au tableau module-level
}
```
L'appelant actuel (`src/server.js:14`) utilise `.map()` sans muter. Mais `listTransfers()` est une API publique du module — tout futur code qui appelle `listTransfers()` et modifie un élément retourné mute l'état global du process. Ce pattern est un vecteur de bugs silencieux : la mutation ne lève pas d'erreur, ne produit pas de log, et se manifeste des requêtes plus tard.

Ce point est central au workflow `CALCUL_DISPONIBILITE` : si `sold` est muté par un chemin indirect (futur endpoint de réservation passant par `listTransfers()`), les calculs de disponibilité deviennent imprévisibles.

**Hotspot 3 : `isFull` — exportée, non consommée côté HTTP**

`VÉRIFIÉ_CODE` : `src/transfers.js:17-21` définit et exporte `isFull`. `src/server.js:3` importe `{ listTransfers, seatsLeft }` — `isFull` en est absent. `isFull` n'est utilisée que dans `test/transfers.test.js:9-12`. `HYPOTHÈSE` : l'export était préparatoire pour un futur endpoint qui filtrerait les transferts complets ou bloquerait une réservation sur un transfert plein. Sans cette connaissance, un développeur ajoutant ce feature pourrait réécrire la règle `seatsLeft(t) === 0` indépendamment, créant une divergence potentielle si la définition de saturation évolue.

**Absence de code mort significatif**

`VÉRIFIÉ_CODE` : revue de tous les exports — `listTransfers`, `seatsLeft`, `isFull` sont les trois exports de `transfers.js`. `listTransfers` et `seatsLeft` sont consommés par `server.js:3`. `isFull` est consommée par le test (`test/transfers.test.js:3`). `server` est exporté par `server.js:30` (consommé par les tests potentiels). Il n'existe pas de code mort inutilisé.

**Complexité cyclomatique**

`VÉRIFIÉ_CODE` : toutes les fonctions sont à complexité 1-2. `sendJson` : 0 branche. `listTransfers` : 0 branche. `seatsLeft` : 0 branche. `isFull` : 0 branche. Le handler HTTP : 1 branche (`if pathname === '/transfers' && method === 'GET'`). Pas de boucles imbriquées, pas de récursion.

## Forces

- Complexité cyclomatique minimale : toutes les fonctions sont triviales à lire et à tester.
- Guard `require.main === module` : `src/server.js:27` — architecture testable, pas de side-effect à l'import.
- Pas de code mort inutile : tous les exports sont consommés quelque part.

## Dettes techniques

- **`src/server.js:11` sans `try/catch`** — vecteur de crash actif sur requête malformée.
- **`listTransfers()` retourne une référence** (`src/transfers.js:10`) — vecteur de mutation silencieuse.
- **`isFull` non câblée à HTTP** — risque de réimplémentation divergente dans le futur.

## Zones critiques

- `src/server.js:11` — parsing URL : chemin critique de toutes les requêtes, sans protection d'erreur.
- `src/transfers.js:9-11` — `listTransfers` : API publique exposant l'état interne mutable.

## Risques

- **Crash de process** sur `src/server.js:11` (URL malformée, hôte manquant) : service entièrement indisponible jusqu'au redémarrage.
- **Mutation silencieuse de l'état global** via `listTransfers()` (`src/transfers.js:10`) : bugs intermittents difficiles à diagnostiquer si plusieurs endpoints modifient les objets retournés.
- **Réimplémentation divergente de `isFull`** : si un futur développeur ne voit pas la fonction exportée (`src/transfers.js:17-21`) et réécrit `seatsLeft(t) === 0` localement, deux définitions de saturation coexisteron — un désaccord silencieux.

## Recommandations priorisées

1. **Wrapper `new URL(...)` dans un `try/catch`** avec réponse `400 Bad Request` — `src/server.js:11` — priorité haute, risque actif
2. **Retourner `[...transfers]` dans `listTransfers()`** — `src/transfers.js:10` — priorité moyenne, risque latent
3. **Documenter `isFull`** (commentaire ou JSDoc sur l'export) sur son rôle préparatoire — `src/transfers.js:17` — priorité basse, risque documentaire

## Questions ouvertes

- Y a-t-il un superviseur de process (PM2, Docker restart policy) qui redémarrerait automatiquement le serveur après un crash ? Sans lui, le service reste down jusqu'à intervention manuelle.
- `isFull` est-elle prévue pour être câblée à un endpoint existant dans `shift-pilot-resa-web` ou dans un futur endpoint de ce service ?
