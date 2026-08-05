# WORKFLOW_CALCUL_DISPONIBILITE — Calcul des places restantes et détection de saturation d'un transfert

## Classification
- **Type** : `data_flow`
- **Sous-type** : calcul de capacité / primitives métier
- **Visibilité** : `technical`
- **Acteur principal** : Module appelant (serveur HTTP ou suite de tests)
- **Acteurs** : `src/server.js` (utilise `seatsLeft`), `test/transfers.test.js` (utilise `seatsLeft` et `isFull`)
- **Criticité** : Moyenne — composant fondateur de la disponibilité ; une erreur ici fausse toute l'information exposée aux clients, mais les fonctions sont pures et testées
- **Confiance** : high
- **Justification** : `src/transfers.js` lu en intégralité (21 lignes). Fonctions pures, sans effets de bord, dont le comportement est entièrement déductible du code. Seul point d'incertitude : `isFull()` est exportée mais non consommée par le serveur HTTP — constaté par lecture de `src/server.js:3`.

## Objectif
Fournir deux primitives de calcul permettant de déterminer, pour un transfert donné, le nombre de places encore disponibles (`seatsLeft`) et si le transfert est complet (`isFull`). Ces fonctions encapsulent la règle métier de capacité et servent de brique réutilisable pour tout module qui a besoin d'évaluer la disponibilité sans accéder directement aux champs bruts `seats` et `sold`.

## Acteurs
- **`src/server.js`** : consomme `seatsLeft` dans le handler `GET /transfers` (`src/server.js:3, 19`)
- **`test/transfers.test.js`** : teste `seatsLeft` et `isFull` (`test/transfers.test.js:5-12`)
- **`isFull`** : exportée (`src/transfers.js:21`) mais non importée par `src/server.js` — consommée uniquement par les tests

## Points d'entrée
- `seatsLeft(transfer)` — `src/transfers.js:13` — appelé par `src/server.js:19` et `test/transfers.test.js:6`
- `isFull(transfer)` — `src/transfers.js:17` — appelé uniquement par `test/transfers.test.js:10-11` ; non câblé à une route HTTP

## Étapes principales
1. L'appelant fournit un objet `transfer` portant au minimum les champs `seats` (capacité totale) et `sold` (places vendues).
2. `seatsLeft(transfer)` retourne `transfer.seats - transfer.sold` (`src/transfers.js:14`).
3. `isFull(transfer)` appelle `seatsLeft(transfer)` en interne et retourne `seatsLeft(transfer) === 0` (`src/transfers.js:18`) — pas de duplication de la règle, réutilisation de la primitive.
4. Aucun effet de bord : ni lecture ni écriture dans le tableau `transfers`, ni I/O.

## Règles métier
- **Places restantes = capacité − vendues** : `seatsLeft(t) = t.seats - t.sold` (`src/transfers.js:14`). Règle arithmétique simple, sans pondération ni seuil.
- **Saturation = zéro place restante** : `isFull(t) = (seatsLeft(t) === 0)` (`src/transfers.js:18`). La saturation est binaire — pas de notion de « presque complet » dans le code.
- **Fonctions pures** : résultat entièrement déterminé par les paramètres d'entrée, aucun état global modifié.

## Données
- **Champ `seats`** : capacité totale déclarée du transfert (`src/transfers.js:3-7`, ex. `seats: 40`).
- **Champ `sold`** : places vendues, codé en dur dans le tableau en mémoire (`src/transfers.js:3-7`). Jamais incrémenté dynamiquement dans le code source actuel.
- Les fonctions ne lisent pas directement le tableau `transfers` — elles opèrent sur l'objet passé en paramètre, ce qui les rend testables indépendamment (`test/transfers.test.js:5-7` : appel avec `{ seats: 40, sold: 12 }` sans passer par `listTransfers()`).

## Intégrations
Aucune intégration externe explicite visible. Fonctions pures en mémoire, aucune dépendance externe.

## Risques
- **`sold` statique** : la valeur de `sold` ne change jamais à l'exécution (`src/transfers.js:3-7` — initialisation fixe). `seatsLeft` et `isFull` reflètent donc un état figé, pas l'état réel du marché. Si une réservation survenait, ces fonctions ne le verraient pas.
- **`isFull` orpheline côté HTTP** : la fonction est exportée (`src/transfers.js:21`) mais absente de l'import dans `src/server.js:3`. Si un futur endpoint doit bloquer les réservations sur un transfert complet, il devra importer `isFull` explicitement — risque de réimplémenter la règle indépendamment si ce contexte est oublié.
- **Aucune protection contre des données invalides** : si `transfer.sold > transfer.seats`, `seatsLeft` retourne un nombre négatif et `isFull` retourne `false` — résultat incohérent, non détecté (aucune validation d'entrée visible dans les fonctions).

## Questions ouvertes
- Pourquoi `isFull()` est-elle exportée (`module.exports`, `src/transfers.js:21`) mais non utilisée dans `src/server.js` ? Est-ce une préparation délibérée pour un futur endpoint de réservation ou un oubli de câblage ?
- Y aura-t-il un mécanisme pour incrémenter `sold` dynamiquement (endpoint de réservation, synchronisation externe) ? Sans cela, `seatsLeft` reste une constante.
- Faut-il gérer le cas `sold > seats` (survente) ou considérer cette contrainte garantie en amont ?

## Preuves
- `src/transfers.js` — lu en intégralité (21 lignes)
- `src/server.js` — lu en intégralité (30 lignes) : import `src/server.js:3` confirmant l'absence de `isFull`
- `test/transfers.test.js` — lu en intégralité (16 lignes)
