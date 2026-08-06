# Modèle de données — Audit

> Confiance : high

## Compréhension globale

Le modèle de données de `shift-pilot-resa-api` est intentionnellement minimal : un unique tableau JavaScript codé en dur en mémoire représente l'intégralité du catalogue et l'état des réservations. Il n'y a pas de base de données, pas de schéma formel, pas de migrations. Tout l'état mutable est perdu au redémarrage du process.

## Résumé exécutif

Une seule entité, `transfer`, portant six champs, stockée dans un tableau global in-memory. La structure est simple, cohérente et bien documentée dans la carte des domaines. Deux points méritent l'attention : (1) le catalogue de départ inclut un transfert pré-rempli à capacité maximale (`id: 2`, Papeete → Bora Bora, 60/60 sièges vendus) — ce qui ressemble à une donnée de test figée dans le seed de production ; (2) le seul champ muté (`sold`) n'est protégé par aucune invariant de borne inférieure côté données — c'est la logique `bookSeats` qui assure l'invariant `sold ≥ 0`, sans filet de sécurité dans la structure elle-même. Pour un pilote, ce modèle est parfaitement adapté. Pour un service réel, la migration vers une base de données exigera des décisions structurantes (schéma, contraintes, transactions) sans point de départ formel.

## Constats détaillés

**Structure de l'entité `transfer` (`VÉRIFIÉ_CODE`)** : `src/transfers.js:3-7` déclare le tableau `transfers` avec trois entrées, chacune de forme `{ id: number, from: string, to: string, seats: number, sold: number, price: number }`. Les champs `id`, `from`, `to`, `seats` et `price` ne sont jamais mutés — seul `sold` l'est (via `transfer.sold += seats` dans `bookSeats`, `src/transfers.js:25`). Il n'existe aucune classe, aucun type formel, aucune validation de structure à la création.

**Catalogue statique codé en dur (`VÉRIFIÉ_CODE`)** : les trois transferts sont instanciés à l'initialisation du module. Il n'y a pas de lecture depuis une source externe (fichier de config, base de données, API) — les données vivent dans le code source lui-même. Cela signifie que tout ajout, modification ou suppression d'un transfert passe par un changement de code et un redéploiement.

**Donnée de test figée dans le seed (`VÉRIFIÉ_CODE`)** : le transfert `id: 2` (Papeete → Bora Bora) est déclaré avec `seats: 60, sold: 60` (`src/transfers.js:5`), soit un taux de remplissage de 100 %. Ce n'est pas un état que le service peut atteindre naturellement au démarrage — c'est un état de test (transfert complet) intégré dans les données de départ. Il est utilisé par `test/server.test.js:42` (test 409) mais il fait aussi partie du catalogue réel retourné par `GET /transfers`. Un utilisateur interrogeant l'API verra ce transfert comme complet dès la première requête, ce qui peut créer de la confusion si le catalogue est présenté comme réel.

**Invariant de capacité géré par code, pas par structure (`VÉRIFIÉ_CODE`)** : l'invariant `seatsLeft(transfer) ≥ 0` (équivalent : `sold ≤ seats`) est garanti par la garde `if (seatsLeft(transfer) < seats)` dans `bookSeats` (`src/transfers.js:24`). Rien dans la structure des données ne l'impose — si quelqu'un écrit directement `transfer.sold = 9999` depuis un autre point du code, l'invariant est violé sans erreur. La protection est donc comportementale, pas structurelle.

**Pas d'identifiant auto-incrémenté (`VÉRIFIÉ_CODE`)** : les IDs (`1`, `2`, `3`) sont assignés manuellement dans le tableau (`src/transfers.js:3-7`). Il n'y a pas de générateur d'ID. Tout ajout de transfert dans le catalogue nécessite un ID choisi manuellement et unique.

**Volatilité totale de l'état (`VÉRIFIÉ_CODE`)** : `transfer.sold` est muté en mémoire dans le processus Node.js. Un redémarrage du process réinitialise `sold` aux valeurs du tableau (`12`, `60`, `5`) — toutes les réservations effectuées depuis le dernier démarrage sont perdues. C'est explicitement documenté dans WORKFLOWS.md et accepté pour le pilote.

## Forces

- **Entité unique et claire** : une seule structure `transfer` avec des responsabilités nettes — le modèle est facile à lire et à comprendre en entier en moins de 10 lignes (`src/transfers.js:3-7`).
- **Projection publique correcte** : `GET /transfers` expose `{ id, from, to, price, seatsLeft }` et masque `seats` et `sold` (`src/server.js:14-20`). Les champs internes de gestion du stock ne fuient pas dans l'API publique.
- **Seul point de mutation** : `bookSeats` est la seule fonction qui modifie `sold` (`src/transfers.js:25`). La mutation est localisée et traçable.

## Dettes techniques

- **Pas de couche de persistance** : le modèle est entièrement in-memory et volatile. Il n'existe pas de frontière entre « données » et « état du process ». Toute introduction d'une base de données repart de zéro.
- **Donnée de test dans le seed de production** : `id: 2` à 60/60 vend est un état de test figé dans les données initiales — confusion pour un utilisateur réel, difficulté à distinguer une donnée intentionnelle d'un état accidentel (`src/transfers.js:5`).
- **Invariant non structurel** : la borne inférieure `sold ≥ 0` et la borne supérieure `sold ≤ seats` ne sont pas imposées par la structure — elles reposent entièrement sur `bookSeats`. Tout contournement de cette fonction (écriture directe, bug dans l'initialisation du catalogue) viole l'invariant silencieusement.

## Zones critiques

- **`src/transfers.js:3-7`** : les données initiales mélangent données de catalogue réelles et état de test (transfert 2 complet). Un senior noterait immédiatement le `sold: 60` égal à `seats: 60` comme suspect.
- **`src/transfers.js:25`** (`transfer.sold += seats`) : seule mutation de données. Si `seats` est mal validé (cf. audit sécurité), c'est ici que l'invariant peut être violé.

## Risques

- **Perte de toutes les réservations au redémarrage** : comportement attendu et documenté pour le pilote, mais risque critique si le service est utilisé en production sans migration vers une base de données — `VÉRIFIÉ_CODE`.
- **Inventaire fictif (transfert 2 toujours complet)** : un client interrogeant l'API verra le transfert Papeete → Bora Bora comme complet dès le démarrage, ce qui peut induire en erreur si ce transfert est censé être réel — `VÉRIFIÉ_CODE` (`src/transfers.js:5`).
- **Violation de l'invariant de capacité par bug de validation** : si `bookSeats` reçoit une valeur `seats` négative (cf. audit sécurité), `transfer.sold` peut descendre sous zéro — l'invariant est rompu sans détection automatique — `VÉRIFIÉ_CODE` (`src/transfers.js:24-25`).

## Recommandations priorisées

1. **Corriger le seed de données** : soit initialiser `id: 2` avec `sold: 0` pour en faire un transfert disponible, soit le retirer du catalogue réel et le réserver aux tests — `src/transfers.js:5`. Priorité : **moyenne** (impacte la clarté du produit dès le premier démarrage).
2. **Ajouter une validation de l'invariant de borne** dans `bookSeats` : vérifier que `seats` est un entier positif avant toute mutation — `src/transfers.js:21-27` (voir aussi audit sécurité, recommandation 1). Priorité : **haute**.
3. **Identifier et documenter le contrat de migration** : avant d'introduire une base de données, décider si `id` devient auto-incrémenté, quel ORM/query builder est utilisé, et si des contraintes de base reprennent les invariants actuellement portés par le code.

## Questions ouvertes

- Le catalogue est-il destiné à être éditable en prod (ajout de nouveaux transferts) sans redéploiement ? Si oui, une interface d'administration ou un fichier de configuration externe est nécessaire.
- La perte de données au redémarrage est-elle acceptable en phase de beta ? À quel moment la migration vers une persistance devient-elle bloquante pour les utilisateurs ?
