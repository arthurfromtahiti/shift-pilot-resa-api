# Modèle de données — Audit

> Confiance : high

## Compréhension globale

Le modèle de données est un tableau JavaScript en mémoire de 3 objets littéraux, déclaré dans `src/transfers.js:3-7`. Il n'existe aucune base de données, aucun ORM, aucune migration, aucune validation de schéma. Les données sont hardcodées et réinitialisées à chaque démarrage du process. La review de la carte des domaines a confirmé que tous les domaines sont marqués `Dépend de la base : non`.

## Résumé exécutif

Le modèle est intentionnellement minimal et cohérent avec la nature pilote du service. Trois constats méritent attention : `listTransfers()` expose une référence mutable au tableau interne, permettant une mutation accidentelle de l'état global sans mécanisme de protection ; le champ `sold` existe mais n'est jamais modifié à l'exécution, rendant la disponibilité calculée statique ; et l'absence de validation d'entrée dans les fonctions de calcul produit des résultats incohérents si les données ne respectent pas l'invariant `sold ≤ seats`. Ces dettes sont sans conséquence en pilote mais devront toutes être adressées avant tout ajout de logique de réservation.

## Constats détaillés

**Structure du catalogue** — `VÉRIFIÉ_CODE` : le tableau `transfers` (`src/transfers.js:3-7`) contient 3 objets avec les champs `id` (entier), `from` (chaîne, ville de départ), `to` (chaîne, ville d'arrivée), `seats` (entier, capacité totale), `sold` (entier, places vendues), `price` (entier, prix en XPF). Le schéma est implicite — aucun type TypeScript, aucun schéma JSON, aucun validateur.

```
{ id: 1, from: "Papeete", to: "Moorea",    seats: 40, sold: 12, price:  3500 }
{ id: 2, from: "Papeete", to: "Bora Bora", seats: 60, sold: 60, price: 21000 }
{ id: 3, from: "Raiatea", to: "Tahaa",     seats: 20, sold:  5, price:  1800 }
```

**Référence mutable exposée** — `VÉRIFIÉ_CODE` : `listTransfers()` retourne `transfers` directement (`src/transfers.js:10: return transfers`). L'appelant reçoit une référence au tableau interne du module, pas une copie. Une mutation sur le résultat (ex. `listTransfers()[0].sold = 999`) modifie l'état global du module — observable par tous les appels suivants dans le même process. L'appelant actuel (`src/server.js:14`) utilise `.map()` — opération de lecture pure — mais le contrat n'est pas garanti par le code.

**`sold` figé à l'exécution** — `VÉRIFIÉ_CODE` : le champ `sold` est initialisé dans le tableau littéral et n'est jamais modifié au runtime. Grep de `src/` : zéro occurrence de `sold =` ou `sold +=` (confirmé par la relecture `RELECTURE_WORKFLOW_CALCUL_DISPONIBILITE.md`). `seatsLeft(t)` calcule donc `t.seats - t.sold` sur une valeur de `sold` statique — la disponibilité affichée reflète l'état initial hardcodé, pas l'état réel de vente.

**Transfert id 2 plein dès le démarrage** — `VÉRIFIÉ_CODE` : `src/transfers.js:5` : `sold: 60, seats: 60`. Le transfert Papeete→Bora Bora est entièrement vendu dans les données initiales. `seatsLeft` retourne `0`, `isFull` retourne `true`. `HYPOTHÈSE` : c'est un fixture de test pour exercer le cas de saturation (`isFull` est testé avec `{ seats: 60, sold: 60 }` dans `test/transfers.test.js:10`). Il n'y a pas d'autre explication dans le code ou la documentation.

**Absence de validation des invariants** — `VÉRIFIÉ_CODE` : `seatsLeft(transfer)` (`src/transfers.js:13-15`) et `isFull(transfer)` (`src/transfers.js:17-19`) opèrent sur tout objet passé en paramètre sans vérifier que `transfer.sold` est un entier positif ni que `transfer.sold ≤ transfer.seats`. Si `sold > seats`, `seatsLeft` retourne un entier négatif et `isFull` retourne `false` — état incohérent, aucune erreur levée. Si `sold` ou `seats` sont `undefined`, `seatsLeft` retourne `NaN`, qui se sérialise en `null` dans JSON.

**Aucune persistance** — `VÉRIFIÉ_CODE` : `package.json:7` liste zéro dépendance externe. Aucun ORM, aucun driver de base de données, aucun accès fichier dans les sources. Un redémarrage du process remet `sold` à ses valeurs initiales.

## Forces

- Schéma des objets `transfer` cohérent sur les 3 entrées : mêmes champs, mêmes types (`src/transfers.js:3-7`).
- Encapsulation correcte : `seats` et `sold` ne sont pas exposés dans la projection HTTP — seul `seatsLeft` (valeur calculée) est transmis (`src/server.js:15-19`).
- Les fonctions de calcul (`seatsLeft`, `isFull`) opèrent sur le paramètre passé et non sur le tableau global — testables indépendamment des données en mémoire (`test/transfers.test.js:5-12`).

## Dettes techniques

- **`listTransfers()` retourne une référence mutable** (`src/transfers.js:10`) — absence de copie défensive.
- **`sold` n'est jamais modifié** — le champ est présent mais orphelin de toute logique de réservation.
- **Pas de validation de schéma** — comportements silencieusement incorrects si les données ne respectent pas `0 ≤ sold ≤ seats`.

## Zones critiques

- `src/transfers.js:9-11` — `listTransfers()` : point d'entrée de toute mutation accidentelle de l'état global.
- `src/transfers.js:13-15` — `seatsLeft()` : règle métier centrale, non gardée contre des entrées invalides.

## Risques

- **Corruption silencieuse de l'état** : si un futur endpoint modifie `sold` via la référence retournée par `listTransfers()` plutôt que via une fonction dédiée, la mutation est globale et non auditée.
- **`seatsLeft` négatif si survente** : l'API exposerait des valeurs négatives de `seatsLeft` sans erreur — un client serait contraint de les interpréter. Impact : confiance client dans les données.
- **Perte de réservations au redémarrage** : toute réservation incrémentant `sold` en mémoire serait perdue dès le redémarrage du process. Ce risque est inactif aujourd'hui (pas d'endpoint de réservation) mais structurel.

## Recommandations priorisées

1. **Retourner une copie shallow dans `listTransfers()`** — `src/transfers.js:10` : `return [...transfers]` — prévenir toute mutation accidentelle avant l'ajout d'un endpoint mutable
2. **Ajouter une validation des invariants** dans `seatsLeft` ou dans une fonction dédiée (`assertValidTransfer`) avant de traiter les réservations
3. **Décider du mécanisme de persistance** (`sold` persisté en base, fichier, ou API externe) avant d'implémenter un endpoint de réservation — ce choix architecture tout le reste

## Questions ouvertes

- Le champ `sold` est-il destiné à être incrémenté par un endpoint de réservation dans ce même service, ou par une synchronisation depuis un système externe (ex. backoffice, PMS) ?
- Le fixture transfert id 2 (`sold: 60`) sera-t-il remplacé par des données réelles avant mise en production, ou le catalogue sera-t-il alimenté depuis une base ?
- Faut-il gérer le cas de survente (`sold > seats`) ou garantir l'invariant en amont (validation à l'écriture) ?
