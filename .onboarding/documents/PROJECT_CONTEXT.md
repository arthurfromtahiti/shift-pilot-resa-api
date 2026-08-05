# PROJECT_CONTEXT — shift-pilot-resa-api

> Confiance : high

## Nature et périmètre

`shift-pilot-resa-api` est un **pilote de démonstration SHIFT/Paperclip** — une API Node.js minimaliste pour consulter un catalogue de transferts inter-îles (Polynésie française) avec disponibilité en temps réel. Cet API constitue la partie backend d'un système de réservation dont le frontend (`shift-pilot-resa-web`, dépôt séparé) est consommateur.

**Périmètre implémenté** : un seul endpoint `GET /transfers` retourne la liste des 3 transferts disponibles avec le nombre de places restantes calculé pour chacun.

**Périmètre non implémenté** : aucun endpoint de réservation (booking, annulation, etc.) n'existe. Le champ `sold` (places vendues) est hardcodé et jamais incrémenté au runtime.

## Stack et architecture

- **Runtime** : Node.js ≥18 (vanilla, zero dépendances externes)
- **Test runner** : `node:test` natif + `node:assert/strict`
- **Démarrage** : `node src/server.js` (port défaut 3100)
- **Taille** : 2 fichiers source (~51 lignes) + 1 fichier test (16 lignes)

Architecture volontairement rudimentaire : séparation claire transport/domaine (`server.js` vs. `transfers.js`), pas de framework, pas d'ORM, pas de base de données. Données statiques en mémoire. Testabilité architecturale préservée via `require.main === module`.

## Domaines clés

### 1. Catalogue de transferts inter-îles
3 trajets définis en dur (`transfers.js:3-7`) : Papeete↔Moorea (40 places, 12 vendues), Papeete↔Bora Bora (60 places, 60 vendues — plein), Raiatea↔Tahaa (20 places, 5 vendues). Chaque transfert porte `id, from, to, seats, sold, price` ; le schéma est implicite (TypeScript absent).

### 2. Calcul de disponibilité
Règle centrale : `seatsLeft(transfer) = transfer.seats - transfer.sold`. Deux primitives exportées (non intégrées à HTTP — voir dettes) :
- `seatsLeft(t)` — places restantes pour un transfert.
- `isFull(t)` — booléen : saturation binaire (`seatsLeft === 0`).

Fonctions pures, testées, sans effet de bord.

### 3. Exposition HTTP
Un seul endpoint public : `GET /transfers` retourne un tableau JSON projeté (`id, from, to, price, seatsLeft`), sans exposer `seats` ni `sold` (données internes). Statut 200, Content-Type `application/json`. Toute autre requête : 404 sans distinction de méthode/route.

## Points d'attention critiques

### Crash sur URL malformée
`server.js:11` : `new URL(req.url, ...)` sans try/catch. Une requête HTTP/0.9, un scan de ports, ou un fuzzer produisant une URL non parseable fera crasher le process Node.js. **Risque actif**. Impact : service entièrement indisponible jusqu'à redémarrage manuel (pas de superviseur visible).

### Absence de CORS
Aucun header `Access-Control-Allow-Origin` posé. `shift-pilot-resa-web` (consommateur déclaré, `README.md:4`) sera bloqué par le navigateur si tournant sur une origine différente. **Risque bloquant pour le frontend**.

### Références mutables exposées
`listTransfers()` retourne le tableau interne sans copie (`transfers.js:10`). Un futur endpoint de réservation qui muterait `sold` via cette référence au lieu d'une fonction dédiée crée un vecteur de corruption silencieuse de l'état global. **Risque latent**.

### `isFull` orpheline
Exportée (`transfers.js:21`) mais non importée par `server.js`. La fonction n'est câblée à aucun endpoint HTTP. Un développeur futur ignorant son existence pourrait réécrire la règle de saturation indépendamment. **Risque documentaire**.

### Données statiques ≠ disponibilité réelle
`sold` jamais incrémenté → `seatsLeft` reflète des valeurs hardcodées, pas l'état réel de vente. Le service affiche que Bora Bora a 0 places restantes depuis le démarrage. Si le frontend présente cela comme « temps réel », c'est trompeur. **Acceptable en pilote, attention pour la production**.

## Dépendances externes

Aucune. `package.json:7` vide (hormis `node` ≥18). Zéro dépendance NPM = zéro risque de vulnérabilité transitive.

## Données et persistance

Tableau littéral en mémoire, réinitialisé à chaque redémarrage. Aucune base de données, aucun fichier, aucune cache. Toute réservation incrémentant `sold` serait perdue dès le redémarrage.

## Cas d'usage testés

Unique workflow HTTP couvert par `WORKFLOW_LISTE_TRANSFERTS` (audité, confiance high) :
1. Client HTTP → `GET /transfers`
2. Serveur parse URL, valide la route
3. Liste les 3 transferts avec `seatsLeft` calculé
4. JSON → client en statut 200

Calcul de disponibilité (`WORKFLOW_CALCUL_DISPONIBILITE`, confiance high) : deux primitives pures, testées, sans dépendance externe.

## Questions ouvertes

- **Persistance** : le champ `sold` sera-t-il incrémenté dans ce service (endpoint `POST /bookings`) ou synchronisé depuis un système externe (backoffice, PMS, API tierce) ?
- **Déploiement** : `shift-pilot-resa-web` tournera-t-il sur la même origine que l'API (proxy inverse) ou sur un port différent ? Détermine l'urgence de CORS.
- **Superviseur** : y a-t-il un gestionnaire de process (PM2, Docker restart policy) au-dessus de `node src/server.js`, ou le crash de process rend-il le service down jusqu'à intervention manuelle ?
- **Évolution architecturale** : le pilote sera-t-il renforcé (framework, router, validation) avant production, ou remplacé par une implémentation neuve ?

## Prochaines étapes critiques

1. **CORS** — ajouter `Access-Control-Allow-Origin` (`server.js:5-8`) — bloquant frontend.
2. **try/catch URL** — protéger le parsing à `server.js:11` — risque crash actif.
3. **Endpoint de réservation** — décider format (POST /bookings vs. autre), persistance (BD, fichier, API), et intégration avec `isFull` pour la logique.
4. **Tests HTTP** — couvrir `GET /transfers` et 404 (actuellement 0 tests du serveur).

---

**Maturité** : Pilote de démonstration. Fonctionnel pour la consultation publique, incomplet pour un service opérationnel de réservation.

**Confiance globale** : High. Le code source est petit, lisible, et les workflows/audits n'ont trouvé aucune incohérence entre implémentation et documentation.
