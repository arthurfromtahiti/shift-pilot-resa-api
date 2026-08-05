# Audit fonctionnel — Audit

> Confiance : high

## Compréhension globale

`shift-pilot-resa-api` est nommée « API de réservation de transferts inter-îles » mais n'implémente que le versant lecture du catalogue. Aucune route de réservation n'existe. L'API répond à un objectif de démonstration (pilote SHIFT/Paperclip) et non à un produit de réservation complet. La cohérence fonctionnelle est satisfaisante dans ce périmètre restreint — mais des signaux d'incomplétude sont visibles dans le code lui-même (champ `sold` jamais mis à jour, `isFull` implémentée mais non exposée).

## Résumé exécutif

L'API expose une seule fonctionnalité : `GET /transfers` retourne les trois transferts inter-îles disponibles avec leur prix et le nombre de places restantes. Cette fonctionnalité est correctement implémentée et cohérente avec les workflows documentés.

Ce qui est absent mais annoncé par le nom du produit : la création d'une réservation (prise de place), la modification du stock (`sold`), l'authentification d'un client réservant. Ces absences ne sont pas des bugs ; elles sont le fait d'un périmètre de pilote.

Deux signaux fonctionnels méritent attention : (1) Bora Bora est complet dès le démarrage (`sold:60 = seats:60`), ce qui signifie qu'un utilisateur verra ce trajet « complet » sans avoir pu réserver — comportement étrange pour une démonstration ; (2) `isFull()` est implémentée, exportée et testée, mais jamais exposée dans la réponse HTTP. Un client doit donc calculer lui-même `seatsLeft === 0` pour savoir si un transfert est complet, alors que l'API possède la logique en interne.

La réponse ne contient ni devise, ni date/heure de départ, ni délai d'expiration de l'offre, ni lien vers une route de réservation. Pour un pilote de démonstration, ces lacunes sont acceptables ; elles deviennent des questions de conception dès que le produit évolue.

## Constats détaillés

**Fonctionnalité livrée — VÉRIFIÉ_CODE.** `GET /transfers` (`src/server.js:13`) retourne un tableau JSON de trois objets `{ id, from, to, price, seatsLeft }`. Les champs `seats` et `sold` sont masqués — décision correcte d'encapsulation. Le calcul `seatsLeft = seats - sold` est exact (`src/transfers.js:13-15`). La réponse est statique (données en mémoire), sans appel externe.

**Réservation absente — VÉRIFIÉ_CODE.** Recherche `grep -niE "post|put|delete|patch|book|reserv|resa" src/` → aucun résultat hormis le nom du projet dans les chemins. Aucune route d'écriture, aucun mécanisme de prise de réservation, aucun décrément de `sold`. La logique de réservation n'existe pas dans ce dépôt.

**Bora Bora complet au démarrage — VÉRIFIÉ_CODE.** `src/transfers.js:5` : `{ id: 2, from: "Papeete", to: "Bora Bora", seats: 60, sold: 60, price: 21000 }`. `seatsLeft = 60 - 60 = 0`. Ce transfert est retourné dans la réponse de `GET /transfers` avec `seatsLeft: 0` — comme un transfert complet — sans qu'aucune réservation n'ait eu lieu. Pour un pilote de démonstration, cela illustre correctement le comportement de la donnée `sold`, mais peut induire en erreur lors de tests produit (le client voit une offre toujours indisponible).

**`isFull()` non exposée — VÉRIFIÉ_CODE.** `src/transfers.js:17-19` implémente `isFull(transfer) = seatsLeft(transfer) === 0`. Cette fonction est exportée (`src/transfers.js:21`) et testée (`test/transfers.test.js:9-12`), mais non importée dans `src/server.js` (`src/server.js:3`). La réponse API ne contient pas de champ `isFull` ni de filtre sur la disponibilité. Un client souhaitant n'afficher que les transferts disponibles doit calculer `seatsLeft === 0` lui-même. Hypothèse : une route de filtrage (`?available=true`) ou un champ `isFull` dans la réponse était prévu mais n'a pas été implémenté.

**Absence de devise — VÉRIFIÉ_CODE.** Le champ `price` est un entier brut (`3500`, `21000`, `1800`, `src/transfers.js:3-7`) sans unité ni devise documentée. L'API ne retourne pas de champ `currency`. Un client qui affiche le prix doit connaître la devise hors de l'API.

**Absence de dimension temporelle — VÉRIFIÉ_CODE.** Aucun champ `date`, `departure_at`, `arrival_at` dans le schéma ni dans la réponse. Le modèle décrit des liaisons permanentes (Papeete→Moorea), pas des créneaux datés. Pour un vrai système de réservation de transferts inter-îles (navettes, ferries), la dimension temporelle est centrale.

**Cohérence du catalogue — VÉRIFIÉ_CODE.** Les trois liaisons couvertes (Papeete→Moorea, Papeete→Bora Bora, Raiatea→Tahaa) sont géographiquement cohérentes avec la Polynésie française. Le catalogue est volontairement réduit pour le pilote.

**Cohérence de la projection — VÉRIFIÉ_CODE.** La réponse `{ id, from, to, price, seatsLeft }` (`src/server.js:14-20`) est compacte et lisible. Elle expose exactement ce qu'un client web a besoin pour afficher la liste des transferts disponibles avec leur tarif. Aucun champ inutile ou redondant.

## Forces

- **Réponse API compacte et bien projetée** : `{ id, from, to, price, seatsLeft }` expose exactement les champs utiles côté client, sans exposer les données internes de stock. (`src/server.js:14-20`)
- **Données initiales cohérentes avec le domaine** : les noms de villes, les capacités (40, 60, 20 places) et les ordres de grandeur des prix sont vraisemblables pour des transferts inter-îles en Polynésie.
- **Signal explicite « pilote »** : `src/transfers.js:1` commente explicitement « pilote de démonstration », ce qui évite de traiter ces données comme une source de vérité.

## Dettes techniques

- **Nom du produit non honoré** (`README.md:3`) : l'API de « réservation » n'implémente pas la réservation. La dette est connue ; elle est documentée ici pour traçabilité.
- **`isFull` implémentée mais non exposée** (`src/transfers.js:17-21`) : logique de filtrage disponible mais morte côté API — décision à clarifier.
- **Bora Bora complet au démarrage** (`src/transfers.js:5`) : l'offre de démonstration présente un trajet « sold out » sans qu'aucune réservation ne l'explique — confusion possible lors de tests produit.
- **Devise non documentée dans la réponse** : le client doit connaître la devise hors de l'API.

## Zones critiques

- **L'écart entre le nom « resa » et le périmètre réel** : le nom `shift-pilot-resa-api` et `README.md:3` («API de réservation ») signalent un produit plus complet que ce qui est livré. Un senior (ou un développeur de `shift-pilot-resa-web`) pourrait chercher des routes de réservation et ne pas comprendre pourquoi elles n'existent pas. Cette zone est à documenter clairement dans les documents de référence produit.

## Risques

- **`shift-pilot-resa-web` attend peut-être un champ `isFull`** : si le front a été développé en anticipant que l'API retournerait `isFull` ou que `seatsLeft === 0` est le seul moyen de détecter la complétude, tout changement de logique côté API est un breaking change silencieux. Preuve : `src/server.js:14-20` (pas de champ `isFull` dans la réponse), `src/transfers.js:17-19` (logique disponible mais non câblée).
- **Confusion Bora Bora « complet »** : une démonstration du produit avec `shift-pilot-resa-web` montrera Papeete→Bora Bora comme indisponible dès la première page de catalogue. Ce comportement peut être mal interprété comme un bug par un testeur qui ne connaît pas les données initiales.

## Recommandations priorisées

1. **Aligner `sold` de Bora Bora avec l'usage de démonstration** — passer `sold` à une valeur < `seats` (ex. `sold: 45`) pour que le pilote montre un transfert partiellement rempli plutôt que complet d'emblée. — `src/transfers.js:5`
2. **Décider du statut de `isFull`** — soit l'exposer dans la réponse (`isFull: seatsLeft(t) === 0`) dans la projection de `GET /transfers`, soit la retirer de l'export public pour éviter la confusion. — `src/server.js:14-20`, `src/transfers.js:17-21`
3. **Documenter la devise** — ajouter un champ `currency: "XPF"` dans la réponse API ou une note dans `README.md` — pour que `shift-pilot-resa-web` puisse afficher le format correct.
4. **Clarifier le périmètre dans le README** — préciser que la réservation (écriture) est hors scope du pilote actuel — pour que tout développeur entrant comprenne immédiatement l'état du produit. — `README.md`

## Questions ouvertes

- La route de prise de réservation (`POST /reservations` ou `POST /transfers/:id/book`) est-elle dans le backlog du projet, ou le périmètre sera-t-il élargi uniquement dans `shift-pilot-resa-web` ?
- `isFull` est-elle destinée à alimenter un filtre côté API (`GET /transfers?available=true`) ou sera-t-elle calculée côté client ?
- La devise est-elle XPF (franc Pacifique) ? Le format d'affichage (1 800 XPF, 1 800 F CFP) est-il défini côté `shift-pilot-resa-web` ?
- Les trois liaisons du catalogue sont-elles définitives pour le pilote, ou d'autres trajets sont-ils prévus ?
