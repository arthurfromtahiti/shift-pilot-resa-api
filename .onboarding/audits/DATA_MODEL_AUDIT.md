# Modèle de données — Audit

> Confiance : high
> Mode : RÉCONCILIATION SHIA-571 (HEAD `8a108d1`). Évolution SHIA-396 : ajout de la Map `reservations` (second état mutable) et de `cancelReservation()` (second point de mutation de `transfer.sold`). Le constat initial « `bookSeats` est la seule fonction qui modifie `sold` » est désormais inexact.

## Compréhension globale

Le modèle de données de `shift-pilot-resa-api` est intentionnellement minimal : un tableau JavaScript codé en dur en mémoire représente le catalogue, et une Map in-memory stocke les réservations actives. Il n'y a pas de base de données, pas de schéma formel, pas de migrations. Tout l'état mutable est perdu au redémarrage du process.

## Résumé exécutif

Deux structures de données constituent l'intégralité du modèle : le tableau `transfers` (catalogue statique + champ `sold` mutable) et la Map `reservations` (registre UUID → réservation). La structure est simple et cohérente. Depuis SHIA-396, `transfer.sold` est muté par deux fonctions : `bookSeats` (incrémentation) et `cancelReservation` (décrémentation) — le constat initial d'un seul point de mutation était obsolète. L'invariant `sold ≥ 0` et `sold ≤ seats` est maintenu comportementalement par les deux fonctions, pas structurellement. Deux points méritent l'attention : (1) le catalogue inclut un transfert initialisé à capacité maximale (`id: 2`, Papeete → Bora Bora, 60/60) — vraisemblablement une donnée de test non documentée (`HYPOTHÈSE`, l'intention n'est pas explicite dans le code) ; (2) `cancelReservation` n'a pas de garde explicite si `transfers.find()` retourne `undefined` (impossible en flow normal).

## Constats détaillés

**Structure de l'entité `transfer` (`VÉRIFIÉ_CODE`)** : `src/transfers.js:5-9` déclare le tableau `transfers` avec trois entrées, chacune de forme `{ id: number, from: string, to: string, seats: number, sold: number, price: number }`. Les champs `id`, `from`, `to`, `seats` et `price` ne sont jamais mutés — seul `sold` l'est (via `transfer.sold += seats` dans `bookSeats`, ligne 30, et `transfer.sold -= reservation.seats` dans `cancelReservation`, ligne 41). Il n'existe aucune classe, aucun type formel, aucune validation de structure à la création.

**Map `reservations` — second état mutable (`VÉRIFIÉ_CODE`)** : `src/transfers.js:11` déclare `const reservations = new Map()`. Elle stocke les associations `reservationId (UUID) → { transferId: number, seats: number }`. Elle est mutée par `bookSeats` (`reservations.set(...)`, ligne 32) et `cancelReservation` (`reservations.delete(...)`, ligne 42). C'est le registre de cohérence : une annulation valide d'abord que l'UUID existe dans la Map avant de modifier `transfer.sold`. La Map et le tableau `transfers` doivent rester cohérents — si l'un est modifié sans l'autre, l'état est corrompu. En pratique, les deux mutations sont atomiques et synchrones dans leurs fonctions respectives.

**Deux points de mutation de `transfer.sold` (`VÉRIFIÉ_CODE`)** :
- `bookSeats` : `transfer.sold += seats` — incrémentation lors d'une réservation (`src/transfers.js:30`)
- `cancelReservation` : `transfer.sold -= reservation.seats` — décrémentation lors d'une annulation (`src/transfers.js:41`)

Les deux opérations modifient l'état in-memory de façon volatile (l'état est perdu au redémarrage). Elles ne sont pas irréversibles entre elles : une réservation créée par `bookSeats` peut être annulée par `cancelReservation`. L'invariant `0 ≤ sold ≤ seats` est maintenu comportementalement par les gardes de `bookSeats` (ligne 29 : `seatsLeft(transfer) < seats`) et implicitement par `cancelReservation` (qui soustrait exactement ce qui a été ajouté).

**Catalogue statique codé en dur (`VÉRIFIÉ_CODE`)** : les trois transferts sont instanciés à l'initialisation du module. Tout ajout, modification ou suppression d'un transfert passe par un changement de code et un redéploiement.

**Transfert 2 toujours plein au démarrage (`VÉRIFIÉ_CODE` + `HYPOTHÈSE`)** : le transfert `id: 2` (Papeete → Bora Bora) est déclaré avec `seats: 60, sold: 60` (`src/transfers.js:7`) — `VÉRIFIÉ_CODE`. `sold` égale `seats` dès l'initialisation du module : ce n'est pas un état atteint par des réservations. Ce transfert est utilisé par `test/server.test.js:66-70` pour couvrir le cas 409 mais figure aussi dans le catalogue réel retourné par `GET /transfers` et est systématiquement exclu par le filtre `?available=true` dès le démarrage. L'intention derrière cet état initial (donnée de test délibérément figée, ou représentation d'un état métier réel) n'est pas documentée dans le code source — `HYPOTHÈSE`.

**Invariant de capacité géré par code, pas par structure (`VÉRIFIÉ_CODE`)** : l'invariant `sold ≤ seats` est garanti par la garde `seatsLeft(transfer) < seats` dans `bookSeats` (`src/transfers.js:29`). L'invariant `sold ≥ 0` est garanti implicitement par `cancelReservation` qui ne soustrait que ce qui a été précédemment ajouté. Rien dans la structure des données ne les impose — si quelqu'un écrit directement `transfer.sold = 9999` depuis un autre point du code, les invariants sont violés sans erreur.

**Pas d'identifiant auto-incrémenté (`VÉRIFIÉ_CODE`)** : les IDs (`1`, `2`, `3`) sont assignés manuellement dans le tableau. Il n'y a pas de générateur d'ID pour les transferts (les réservations utilisent `randomUUID()`, `src/transfers.js:3`).

**Volatilité totale de l'état (`VÉRIFIÉ_CODE`)** : `transfer.sold` et la Map `reservations` sont mutés en mémoire dans le processus Node.js. Un redémarrage du process réinitialise `sold` aux valeurs du tableau (`12`, `60`, `5`) et vide la Map — toutes les réservations effectuées depuis le dernier démarrage sont perdues.

## Forces

- **Deux entités claires** : `transfers` (catalogue + stock) et `reservations` (registre UUID) — chacune avec des responsabilités nettes.
- **Projection publique correcte** : `GET /transfers` expose `{ id, from, to, price, seatsLeft }` et masque `seats` et `sold` (`src/server.js:16-22`). Les champs internes de gestion du stock ne fuient pas dans l'API publique.
- **Deux points de mutation identifiés et symétriques** : `bookSeats` incrémente et enregistre ; `cancelReservation` décrémente et supprime — la symétrie est claire.
- **Cohérence Map / tableau assurée** : `cancelReservation` vérifie l'existence dans la Map avant de muter le tableau — pas de décrément orphelin.

## Dettes techniques

- **Pas de couche de persistance** : le modèle est entièrement in-memory et volatile. Toute introduction d'une base de données repart de zéro.
- **Transfert 2 toujours complet au démarrage** : `id: 2` initialisé avec `sold == seats` — probable état de test non documenté comme tel dans le code, source de confusion pour un utilisateur réel (`src/transfers.js:7`).
- **Invariant non structurel** : la borne inférieure `sold ≥ 0` et la borne supérieure `sold ≤ seats` reposent entièrement sur les fonctions `bookSeats` et `cancelReservation`. Tout contournement viole les invariants silencieusement.
- **Absence de garde dans `cancelReservation` sur `transfers.find()`** : la ligne 40 suppose que le transfert existe dans le tableau (garanti en flow normal) mais n'a pas de vérification défensive explicite (`src/transfers.js:40`).

## Zones critiques

- **`src/transfers.js:5-9`** : données initiales mélangent transferts disponibles et un transfert déjà plein au démarrage (id: 2). Un senior noterait `sold: 60` égal à `seats: 60` comme suspect — vraisemblablement un état de test, mais sans commentaire ni documentation l'attestant.
- **`src/transfers.js:30`** et **`src/transfers.js:41`** : les deux seuls points de mutation de `sold`. Toute dérive de l'invariant de capacité passe nécessairement par l'un d'eux.
- **`src/transfers.js:11`** : `const reservations = new Map()` — état global dont la cohérence avec le tableau `transfers` doit être maintenue en permanence.

## Risques

- **Perte de toutes les réservations au redémarrage** : comportement attendu et documenté pour le pilote, mais risque critique si le service est utilisé en production sans persistance — `VÉRIFIÉ_CODE`.
- **Inventaire fictif (transfert 2 toujours complet)** : un client interrogeant l'API verra le transfert Papeete → Bora Bora comme complet dès le démarrage — `VÉRIFIÉ_CODE` (`src/transfers.js:7`).
- **Violation de l'invariant de capacité par bug** : si `bookSeats` reçoit une valeur `seats` négative (protection en place), ou si la Map `reservations` contenait une valeur corrompue non atteignable via les chemins normaux, `transfer.sold` pourrait dériver — `HYPOTHÈSE` (scénario de corruption non observé dans le dépôt ; protection comportementale en place via les gardes de `bookSeats` et `cancelReservation`).
- **TypeError latent dans `cancelReservation`** : `transfers.find()` ligne 40 retournerait `undefined` si `reservation.transferId` ne correspond à aucun élément du tableau — crash TypeError à la ligne 41. Impossible en flow normal, mais sans protection explicite — `HYPOTHÈSE` (`src/transfers.js:40-41`).

## Recommandations priorisées

1. **Corriger le seed de données** : initialiser `id: 2` avec `sold: 0` pour en faire un transfert disponible, ou le retirer du catalogue réel et le réserver aux tests — `src/transfers.js:7`. Priorité : **moyenne**.
2. **Identifier et documenter le contrat de migration** : avant d'introduire une base de données, décider si `id` devient auto-incrémenté, quel ORM/query builder est utilisé, et si des contraintes de base reprennent les invariants actuellement portés par le code.
3. **Ajouter une garde défensive dans `cancelReservation`** : `if (!transfer) return { ok: false, reason: "internal_error" }` après la ligne 40 — `src/transfers.js:40`. Priorité : **basse** (défense en profondeur, cas impossible en flow normal).

## Questions ouvertes

- Le catalogue est-il destiné à être éditable en prod (ajout de nouveaux transferts) sans redéploiement ? Si oui, une interface d'administration ou un fichier de configuration externe est nécessaire.
- La perte de données au redémarrage est-elle acceptable en phase de beta ? À quel moment la migration vers une persistance devient-elle bloquante pour les utilisateurs ?

## Journal de réconciliation

| Élément | Version précédente | Version actuelle (HEAD `8a108d1`) | Action |
|---|---|---|---|
| Points de mutation de `sold` | **`bookSeats` seule** (`src/transfers.js:25`) | **`bookSeats` ET `cancelReservation`** (`src/transfers.js:30` et `41`) | Constat **corrigé** — était inexact |
| Map `reservations` | Mentionnée marginalement | **Documentée** comme second état mutable (`src/transfers.js:11`) | **Ajoutée** |
| `cancelReservation` | Absente | **`src/transfers.js:36-44`** — symétrie avec `bookSeats` documentée | **Ajoutée** |
| Structure `transfer` lignes | `src/transfers.js:3-7` | **`src/transfers.js:5-9`** (décalage dû à la Map ligne 11 ajoutée après l'import) | Numéro **mis à jour** |
| Transfert 2 pré-complet | `src/transfers.js:5` | **`src/transfers.js:7`** | Numéro **mis à jour** |
| `bookSeats` seule mutation | Identifié comme force "Seul point de mutation" | **Retiré** — remplacé par "Deux points symétriques" | Force **mise à jour** |
| Volatilité de l'état | `sold` in-memory | **`sold` + Map `reservations`** in-memory | **Étendu** |
