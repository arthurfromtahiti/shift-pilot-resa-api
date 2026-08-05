# Modèle de données — Audit

> Confiance : high

## Compréhension globale

Le modèle de données de `shift-pilot-resa-api` tient en sept lignes : un tableau JavaScript constant de trois objets codés en dur en mémoire (`src/transfers.js:3-7`). Il n'y a ni base de données, ni ORM, ni schéma de validation, ni migration. C'est un état de prototype assumé — le commentaire de tête du fichier le dit explicitement (`src/transfers.js:1`). L'audit porte donc moins sur la qualité du schéma que sur les décisions implicites et les tensions à résoudre si le projet évolue vers une vraie persistance.

## Résumé exécutif

Entité unique : `Transfer` — modélisée comme un objet JavaScript litéral à six champs : `id` (entier), `from` (string), `to` (string), `seats` (entier, capacité totale), `sold` (entier, places vendues), `price` (entier, montant sans unité explicite).

Aucune contrainte d'intégrité n'est appliquée : `sold` peut théoriquement dépasser `seats`, `price` peut être négatif, `id` n'est pas unicité-garantie. En pratique, les trois enregistrements sont corrects ; la fragilité est latente pour toute route d'écriture future.

Le champ `sold` est la donnée la plus sensible du modèle : il représente les places vendues, mais aucune route ne l'incrémente (`grep -niE "sold" src/` → uniquement la donnée initiale et `seatsLeft = seats - sold`). Il est figé à sa valeur de départ : `12` (Papeete→Moorea), `60` (Papeete→Bora Bora, complet), `5` (Raiatea→Tahaa). Bora Bora est marqué « complet » dès le démarrage.

La projection API expose `{ id, from, to, price, seatsLeft }` (`src/server.js:14-20`) et masque `seats` et `sold` — décision correcte qui préserve l'encapsulation du modèle de stock interne.

Aucune donnée temporelle (date/heure du transfert, créé le, modifié le). Aucun identifiant stable de type UUID. Aucune relation entre entités.

## Constats détaillés

**Schéma de l'entité Transfer — VÉRIFIÉ_CODE.** `src/transfers.js:3-7` déclare un tableau `const transfers` avec trois objets :

| Champ | Type observé | Valeurs | Exposé via API |
|---|---|---|---|
| `id` | entier | 1, 2, 3 | oui |
| `from` | string | `"Papeete"`, `"Raiatea"` | oui |
| `to` | string | `"Moorea"`, `"Bora Bora"`, `"Tahaa"` | oui |
| `seats` | entier | 40, 60, 20 | non (masqué dans la projection) |
| `sold` | entier | 12, 60, 5 | non (masqué ; remplacé par `seatsLeft`) |
| `price` | entier | 3500, 21000, 1800 | oui |

La fonction calculée `seatsLeft(t) = t.seats - t.sold` (`src/transfers.js:13-15`) est exposée à la place des champs bruts.

**Encapsulation du stock — VÉRIFIÉ_CODE.** La projection de réponse (`src/server.js:14-20`) n'inclut pas `seats` ni `sold` : seul `seatsLeft` est retourné. Cette décision préserve la liberté de faire évoluer la représentation interne du stock (par exemple passer de `sold` à `remaining` directement) sans changer l'interface API. C'est une bonne pratique de conception, même involontaire.

**Absence de contraintes — HYPOTHÈSE.** Aucun code de validation ne vérifie que `sold <= seats`, que `price >= 0`, ou que `id` est unique. Avec des données codées en dur et sans route d'écriture, aucune contrainte ne peut être violée en pratique. Hypothèse : si une route POST est ajoutée sans validation, ces invariants pourront être cassés — `seatsLeft` deviendrait négatif, les prix pourraient être incohérents.

**Champ `sold` sans chemin d'écriture — VÉRIFIÉ_CODE.** Recherche `grep -niE "sold\s*=" src/` → résultats : uniquement `src/transfers.js:4-6` (déclaration des valeurs initiales). Il n'existe aucun code qui modifie `sold`. Le stock est figé à son état de départ pour toute la durée de vie du processus.

**Absence d'identifiant stable (UUID) — VÉRIFIÉ_CODE.** Les `id` sont des entiers séquentiels `1`, `2`, `3` (`src/transfers.js:4-6`). Dans un système distribué ou paginé, ce schéma favorise les collisions et rend l'insertion difficile. Pour un pilote à trois enregistrements fixes, c'est sans conséquence.

**Absence de dimension temporelle — VÉRIFIÉ_CODE (par absence).** Aucun champ `date`, `departure_at`, `created_at`, `updated_at` dans le schéma. L'entité `Transfer` décrit un trajet permanent (Papeete→Moorea existe indéfiniment) plutôt qu'une occurrence datée (ferry du 5 août à 14h). Si le produit vise à terme des créneaux de réservation, le modèle devra être étendu avec une dimension temporelle.

**Unité monétaire non documentée — VÉRIFIÉ_CODE.** `price` est un entier brut : `3500`, `21000`, `1800`. Aucun champ `currency`, aucun commentaire, aucune variable nommée `XPF` ou `currency`. Hypothèse : il s'agit de francs Pacifique (XPF), cohérent avec la géographie (Polynésie française) — non confirmé.

## Forces

- **Encapsulation du stock** : `seats` et `sold` sont masqués de la réponse API ; seul `seatsLeft` est exposé. (`src/server.js:14-20`)
- **Commentaire de scope** : `src/transfers.js:1` qualifie explicitement les données de « pilote de démonstration », ce qui empêche de les traiter comme une source de vérité production.
- **Séparation calcul / données** : les fonctions `seatsLeft` et `isFull` sont des fonctions pures séparées de la déclaration du tableau (`src/transfers.js:9-19`), ce qui les rend testables indépendamment des données.

## Dettes techniques

- **Données hardcodées sans schéma formel** (`src/transfers.js:3-7`) : aucun type, aucune validation, aucune migration. Acceptable pour un pilote ; incompatible avec une évolution vers la persistance sans refactoring complet.
- **`sold` sans chemin de mise à jour** (`src/transfers.js:4-6`) : le champ existe mais est entièrement statique. Bora Bora est complet (sold:60 = seats:60) sans qu'aucune réservation n'ait eu lieu.
- **Unité monétaire non spécifiée** : `price` est un entier sans devise documentée.
- **Absence de dimension temporelle** : le modèle ne peut pas représenter des créneaux horaires sans modification structurelle.

## Zones critiques

- **`src/transfers.js:3-7` — le tableau `transfers`** : toute évolution du produit (ajout d'un champ, d'un trajet, d'une dimension temporelle, d'une devise) passe par ce tableau et ses trois records hardcodés. C'est le point de changement unique du modèle.

## Risques

- **Invariants du stock cassables sans validation** : si une route POST/PUT incrémente `sold` sans vérifier `sold <= seats`, `seatsLeft` deviendrait négatif — valeur absurde retournée au client. Preuve de l'absence de validation : `src/transfers.js` en intégralité.
- **Perte du stock au redémarrage** : tout `sold` mis à jour en mémoire est réinitialisé à la valeur hardcodée au prochain démarrage du processus (`src/transfers.js:3-7`). Acceptable en pilote, bloquant en production avec une route d'écriture.
- **`sold` préinitialisé comme si des réservations avaient eu lieu** : Bora Bora est complet depuis le démarrage (`sold:60`, `seats:60`, `src/transfers.js:5`). Un client verrait une offre « complet » sans avoir jamais pu réserver — confusion possible lors de tests produit.

## Recommandations priorisées

1. **Documenter l'unité monétaire** — ajouter un champ `currency: "XPF"` (ou équivalent) dans le schéma ou en constante exportée — avant toute consommation du prix par `shift-pilot-resa-web`. — `src/transfers.js:3-7`
2. **Introduire une validation d'invariants** (au moins `sold <= seats`, `price >= 0`) avant d'implémenter toute route d'écriture — la validation peut être une fonction pure dans `src/transfers.js`. — `src/transfers.js:13-19`
3. **Réinitialiser `sold` à `0`** pour Bora Bora dans les données de démonstration (`src/transfers.js:5`) si le pilote est utilisé pour tester le parcours de réservation — actuellement, Bora Bora apparaît complet sans aucune réservation.
4. **Planifier le schéma de persistance** (PostgreSQL ou SQLite) avec les contraintes `CHECK (sold <= seats)`, `CHECK (price >= 0)`, `UNIQUE (id)`, avant tout passage en production.

## Questions ouvertes

- L'unité monétaire est-elle bien le XPF (franc Pacifique) ? Aucune preuve dans le code.
- Le modèle `Transfer` représente-t-il un trajet permanent (liaison permanente) ou un créneau daté (ferry du 5 août à 14h) ? La réponse détermine si une dimension temporelle doit être ajoutée au schéma.
- Y a-t-il des règles métier sur la modification du prix (grille tarifaire dynamique, promotions) ? Aucune trace dans le code actuel.
- La clé `id` sera-t-elle préservée comme entier séquentiel ou migrée vers UUID lors du passage à une base de données ?
