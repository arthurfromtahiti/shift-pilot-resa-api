# Relecture — CARTE_DES_DOMAINES.md (shift-pilot-resa-api)

## Verdict global

**Bon** — La carte est exploitable sans réserve bloquante. Les quatre domaines sont réels, distincts à la granularité de ce dépôt minimal, correctement sourcés et la réconciliation SHIA-408 est conforme au code courant (`src/server.js:14-15`). Aucun domaine plaqué ni pan fonctionnel non couvert n'a été trouvé.

## Problèmes bloquants

*Aucun.*

## Problèmes mineurs

*Aucun.*

## Points vérifiés et corrects

**Contrôle 1 — Domaine `catalogue-transferts` prouvé.**
Le tableau et ses champs sont présents dans `src/transfers.js:5-9`, `listTransfers()` dans `src/transfers.js:13-15`, et la route de lecture dans `src/server.js:13-23`. Le filtre `available=true` est réellement câblé par `src/server.js:14-15` et couvert par `test/server.test.js:135-140`. Les indices (`transfers`, `from`, `to`, `price`, `available`) sont spécifiques aux fonctions et routes citées, pas des catégories génériques couvrant tout le dépôt.

**Contrôle 2 — Domaine `disponibilite-reservation` prouvé.**
Les calculs et mutations sont vérifiables dans `src/transfers.js:17-43` : `seatsLeft`, `isFull`, `bookSeats`, `cancelReservation` et le registre `reservations`. Les trois chemins métier sont exposés par `src/server.js:13-23`, `src/server.js:25-48` et `src/server.js:50-57`. Les scénarios réservation/annulation, capacité, incohérence d'identifiant et double annulation sont couverts par `test/server.test.js:58-126` et `test/transfers.test.js:18-55`.

**Contrôle 3 — Domaine `exposition-http-api` réel et séparé.**
La couche transverse est matérialisée par `http.createServer`, `sendJson`, le parsing d'URL/query, le routage, le parsing JSON et le port dans `src/server.js:1-66`. Elle ne constitue pas une entité métier et sa séparation du catalogue/réservation est donc justifiée.

**Contrôle 4 — Domaine `qualite-tests` réel.**
Le script est défini dans `package.json:6`, les tests unitaires dans `test/transfers.test.js:1-56` et l'intégration HTTP dans `test/server.test.js:1-140`. Exécution effectuée pendant cette relecture : `npm test` → 21 tests, 21 pass, 0 fail. La confiance élevée annoncée pour cette suite est donc étayée par une observation reproductible, sans prétendre que les tests couvrent des exigences absentes.

**Contrôle 5 — Granularité.**
Quatre domaines pour ce dépôt de deux fichiers source sont dans la fourchette attendue et adaptés à la matière disponible. La séparation `catalogue-transferts` / `disponibilite-reservation` est défendable : le premier expose l'offre (`src/server.js:16-22`), le second porte le stock et les mutations (`src/transfers.js:17-43`). La carte signale honnêtement le chevauchement du filtre `available=true` (`CARTE_DES_DOMAINES.md:81-88`) au lieu de le masquer.

**Contrôle 6 — Domaine central correct.**
Le cœur fonctionnel annoncé est bien la réservation de sièges : `seats`, `sold`, `reservations` et les mutations sont dans `src/transfers.js:5-43`, et les routes métier correspondantes dans `src/server.js:25-57`. Aucun domaine d'authentification, persistance, notifications ou intégration externe n'a été inventé ; l'absence de base est cohérente avec `src/transfers.js:5-11` et l'absence de dépendances métier dans `package.json:1-6`.

**Contrôle 7 — Couverture du dépôt et oublis.**
J'ai parcouru `README.md`, `package.json`, `src/server.js`, `src/transfers.js`, `test/server.test.js` et `test/transfers.test.js`. Le README/stack sont reflétés dans la nature du projet (`README.md:3-7`), le code source est couvert par les domaines métier/technique, et les tests par `qualite-tests`. Aucun contrôleur, job, entité, persistance ou intégration non cartographié n'existe dans les fichiers suivis.

**Contrôle 8 — Champ « Dépend de la base ».**
Les quatre valeurs `non` sont justes : les données sont un tableau en mémoire (`src/transfers.js:5-9`), les réservations une `Map` (`src/transfers.js:11`), et les mutations se font directement sur l'objet (`src/transfers.js:30`, `src/transfers.js:40-42`). Aucun schéma, ORM ou accès base n'apparaît dans le dépôt parcouru.

**Contrôle 9 — Réconciliation et honnêteté des incertitudes.**
Le drift SHIA-408 décrit dans la carte correspond exactement à l'import `isFull` (`src/server.js:3`), à son usage (`src/server.js:15`) et au test du filtre (`test/server.test.js:135-140`). Les limites restantes — mémoire volatile, absence d'authentification et concurrence — sont explicitement conservées comme incertitudes (`CARTE_DES_DOMAINES.md:84-88`) et ne sont pas présentées comme des capacités existantes.

## Recommandations de correction

Aucune correction requise. La carte peut passer à l'étape suivante (analyse des workflows).
