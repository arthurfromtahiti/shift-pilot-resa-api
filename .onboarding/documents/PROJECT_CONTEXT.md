# PROJECT_CONTEXT — shift-pilot-resa-api

> **Confiance : high** — tous les constats sont issus de la lecture directe du code source et de la documentation déclarée.

## Résumé

**API HTTP de consultation de catalogue de transferts inter-îles**, Node.js natif, sans framework ni dépendance externe. C'est un **pilote de démonstration** SHIFT/Paperclip avec ~1,5 Ko de source répartie sur deux fichiers. Unique fonctionnalité implémentée : `GET /transfers` retourne trois trajets (Papeete↔Moorea, Papeete↔Bora Bora, Raiatea↔Tahaa) avec leurs prix et places restantes.

**Périmètre : lecture seule.** Malgré son nom « resa/réservation », aucune route d'écriture n'existe. Les données résident entièrement en mémoire, codées en dur ; aucune persistance.

**Consommateur désigné : `shift-pilot-resa-web`** (même projet Paperclip, dépôt séparé — hors périmètre de ce workspace).

---

## Contexte métier

### Nature du produit

Un service d'API pour consulter les liaisons de **transferts inter-îles** disponibles en Polynésie française (navettes, ferries de courte distance). Le modèle de revenu et les parcours utilisateurs complets (prise de réservation, paiement, gestion des annulations) relèvent du produit plus large ; cette API fournit le socle de lecture d'offre.

**Situation actuelle** : démonstration du cadre d'onboarding SHIFT/Paperclip ; état du code intentionnellement minimal et volontairement dépourvu de certaines fonctionnalités pour rester au scope d'un pilote.

### Acteurs

- **Clients externes** : applications web/mobile consommant l'API `GET /transfers` pour afficher le catalogue (ex. `shift-pilot-resa-web`).
- **Administrateur/opérateur** : gérant le catalogue (ajout/suppression de trajets, mise à jour des prix) — absent de ce périmètre.
- **Le système** : aucune intégration avec un back-office, une base de données, ou un service tiers (données en mémoire).

---

## Points d'attention clés

### 1. **Réservation absente du code**

La route de **prise de réservation** (décrément du stock, création d'enregistrement de réservation) n'existe **pas**. Recherche sur l'intégralité du dépôt : aucun `POST`, `PUT`, `DELETE`, `PATCH`. Cette absence est **volontaire** (état de pilote), non un bug — mais elle crée une tension sémantique :

- Le nom du service est `shift-pilot-resa-api` (« resa » = réservation).
- Le `README.md` le désigne comme « API de réservation ».
- Le modèle de données contient un champ `sold` (places vendues), qui n'est jamais incrémenté.
- Aucune route ne permet de passer une réservation.

**Impact** : un développeur intégrant `shift-pilot-resa-web` doit comprendre que la réservation (écriture) n'est **pas** implémentée ici, avant de la chercher ailleurs.

### 2. **Stock apparent sans réservation**

Bora Bora est initialisé avec `sold: 60` et `seats: 60` — la route retourne `seatsLeft: 0`, comme si le trajet était complet. Or, **aucune réservation n'a eu lieu**. C'est un artefact pédagogique pour montrer le comportement de `seatsLeft = seats - sold`. Impact pour une démonstration produit : le client web affichera ce trajet « complet » sans jamais avoir pu le réserver — confusion possible.

### 3. **Deux champs de stock masqués**

`seats` et `sold` n'apparaissent pas dans la réponse API. À leur place : une valeur calculée `seatsLeft`. C'est une décision correcte d'encapsulation, mais elle masque la sémantique interne si le client doit plus tard comprendre la capac

ité totale (ex. pour un graphique d'occupancy).

### 4. **Fonction `isFull` implémentée mais dormante**

La fonction `isFull(transfer)` existe, est exportée, et testée. Mais elle n'est jamais importée dans `src/server.js` et n'apparaît pas dans la réponse HTTP. Deux scénarios possibles :
- Préparation pour une route future de filtrage (`?available=true`).
- Legacy — logique en attente de décision fonctionnelle.

**Impact** : clarifier son rôle avant d'ajouter une nouvelle route.

---

## Domaines clés

| Domaine | Priorité | Confiance | Note |
|---------|----------|-----------|------|
| **Catalogue des transferts** | Cœur | high | Unique raison d'être du service. 3 trajets codés en dur en mémoire. |
| **Disponibilité et places** | Cœur | medium | Calcul de `seatsLeft` correct, mais stock figé (jamais incrémenté). |
| **Exposition HTTP** | Support | high | Routage, sérialisation JSON, gestion des 404 — fonctionnels. |
| **Tests unitaires** | Support | low | 3 tests couvrant la logique métier pure ; aucun test de la route HTTP. |

---

## État technique

### Forces

- **Zéro dépendance externe** : uniquement Node.js natif (`node:http`, `node:url`, `node:test`). Pas de framework, pas d'entretien de librairies tierces.
- **Séparation nette** : `src/server.js` (HTTP) / `src/transfers.js` (logique métier) — aucun mélange de responsabilités.
- **Testabilité** : le serveur est exporté (`module.exports = server`), rendant un test HTTP possible sans infrastructure.
- **Port configurable** : `process.env.PORT || 3100` permet un déploiement sans modification du code.

### Dettes / Risques

- **Routeur ad hoc** : le routage par `if` unique est viable pour une route ; la deuxième route accumule la logique dans le même callback (`src/server.js:10-23`). Risque d'explosion de la complexité.
- **Tableau mutable exposé** : `listTransfers()` retourne la référence du tableau sans copie. Si une route POST est ajoutée, un appelant pourrait muter le stock en place — risque latent.
- **Pas d'infrastructure de déploiement** : aucun Dockerfile, aucun `Procfile`, aucun `.github/workflows/`. À adresser avant tout déploiement hors pilote.

---

## Questions ouvertes

1. **La réservation vit-elle dans `shift-pilot-resa-web`, ou reste-t-elle hors périmètre ?** Clarifier le split de responsabilités entre les deux dépôts.
2. **Comment l'API sera-t-elle déployée ?** Conteneur, VM, PaaS ? Aucune configuration trouvée.
3. **Le port `3100` est-il un standard dans l'infrastructure de `shift-pilot-resa-web` ?** Reverse proxy, Docker Compose, configuration réseau.
4. **Quelle est la devise exacte des prix** (XPF = franc Pacifique) ? Le client doit le savoir pour afficher correctement.
5. **`isFull()` doit-elle être exposée en HTTP** (champ `isFull` dans la réponse ou filtre `?available=true`) ? Ou peut-elle être supprimée ?

---

## Checklist pour les développeurs entrants

- [ ] Lire **CDC_FONCTIONNEL.md** pour comprendre les règles métier de la réponse API.
- [ ] Lire **CARTOGRAPHIE_CODE.md** pour localiser la logique par domaine.
- [ ] Accepter que la prise de réservation n'existe **pas** dans ce dépôt (pilote lecture seule).
- [ ] Tester `npm test` pour valider les invariants de stock.
- [ ] Configurer le port via `PORT=XXX npm start` avant de déployer.

