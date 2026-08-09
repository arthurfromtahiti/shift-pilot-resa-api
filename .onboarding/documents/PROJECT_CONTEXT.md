# PROJECT_CONTEXT — shift-pilot-resa-api

> Confiance : high

## Nature et périmètre

`shift-pilot-resa-api` est un **pilote de démonstration SHIFT/Paperclip** — une API Node.js minimaliste pour consulter un catalogue de transferts inter-îles (Polynésie française) avec disponibilité en temps réel. Cet API constitue la partie backend d'un système de réservation dont le frontend (`shift-pilot-resa-web`, dépôt séparé) est consommateur.

**Périmètre implémenté** : trois endpoints HTTP fonctionnels :
1. `GET /transfers` — retourne le catalogue des 3 transferts avec places restantes ; filtrable via `?available=true` (SHIAAAAAAAAAAAAAAAAAAAAAAAA-408)
2. `POST /transfers/:id/reserve` — réserve N sièges sur un transfert, retourne un UUID de réservation (SHIAAAAAAAAAAAAAAAAAAAAAAAA-61)
3. `DELETE /transfers/:id/reservations/:reservationId` — annule une réservation, libère les sièges (SHIAAAAAAAAAAAAAAAAAAAAAAAA-353)

Le champ `sold` est incrémenté à chaque réservation, décrémenté à chaque annulation (mutations en mémoire) ; la volatilité des données persiste (pas de base de données).

## Stack et architecture

- **Runtime** : Node.js ≥18 (vanilla, zero dépendances externes)
- **Test runner** : `node:test` natif + `node:assert/strict`
- **Démarrage** : `node src/server.js` (port défaut 3100)
- **Taille** : 2 fichiers source (~112 lignes) + 2 fichiers test (~196 lignes : 140 + 56 lignes respectivement)

Architecture volontairement rudimentaire : séparation claire transport/domaine (`server.js` vs. `transfers.js`), pas de framework, pas d'ORM, pas de base de données. Données statiques en mémoire. Testabilité architecturale préservée via `require.main === module`.

## Domaines clés

### 1. Catalogue de transferts inter-îles
3 trajets définis en dur (`transfers.js:3-7`) : Papeete↔Moorea (40 places, 12 vendues), Papeete↔Bora Bora (60 places, 60 vendues — plein), Raiatea↔Tahaa (20 places, 5 vendues). Chaque transfert porte `id, from, to, seats, sold, price` ; le schéma est implicite (TypeScript absent).

### 2. Calcul de disponibilité
Règle centrale : `seatsLeft(transfer) = transfer.seats - transfer.sold`. Deux primitives exportées et intégrées à HTTP :
- `seatsLeft(t)` — places restantes pour un transfert (fonction pure, projetée dans `GET /transfers` et retournée après réservation/annulation).
- `isFull(t)` — fonction pure, booléen : saturation binaire (`seatsLeft === 0`), utilisée pour filtrer les transferts saturés via `?available=true`.

Note : `seatsLeft()` et `isFull()` sont des fonctions pures (sans effet de bord, déterministes), tandis que `bookSeats()` et `cancelReservation()` produisent intentionnellement des mutations d'état.

### 3. Réservation de sièges [SHIAAAAAAAAAAAAAAAAAAAAAAAA-61]
Endpoint `POST /transfers/:id/reserve` : client envoie un entier optionnel `seats` (défaut 1) ; le serveur valide la capacité, incrémente `sold`, génère un UUID, enregistre la réservation en registre Map en mémoire. Réponse 200 `{ reservationId, transferId, seatsLeft }` en succès ; 404 si transfert inexistant ; 409 si capacité insuffisante ; 400 si validation invalide.

### 4. Annulation de réservation [SHIAAAAAAAAAAAAAAAAAAAAAAAA-353]
Endpoint `DELETE /transfers/:id/reservations/:reservationId` : client fournit un UUID ; le serveur valide la cohérence entre `transferId` (URL) et `reservation.transferId`, décrémente `sold`, supprime du registre. Réponse 200 `{ seatsLeft }` en succès ; 404 si réservation inexistante ou incohérence de transfert.

### 5. Exposition HTTP (3 endpoints)
- `GET /transfers` — catalogue projeté (`id, from, to, price, seatsLeft`), filtrable via `?available=true` ; toujours 200
- `POST /transfers/:id/reserve` — créer réservation ; 200/400/404/409
- `DELETE /transfers/:id/reservations/:reservationId` — annuler réservation ; 200/404
- Toute autre requête : 404 sans distinction de méthode/route

Données internes `seats` et `sold` jamais exposées — projection JSON masquée correctement.

## Points d'attention critiques

### Crash sur URL malformée
`server.js:11` : `new URL(req.url, ...)` sans try/catch. Une requête HTTP/0.9, un scan de ports, ou un fuzzer produisant une URL non parseable fera crasher le process Node.js. **Risque actif**. Impact : service entièrement indisponible jusqu'à redémarrage manuel (pas de superviseur visible).

### Absence de CORS
Aucun header `Access-Control-Allow-Origin` posé. `shift-pilot-resa-web` (consommateur déclaré, `README.md:4`) sera bloqué par le navigateur si tournant sur une origine différente. **Risque bloquant pour le frontend**.

### Références mutables exposées
`listTransfers()` retourne le tableau interne sans copie (`transfers.js:10`). Un futur endpoint de réservation qui muterait `sold` via cette référence au lieu d'une fonction dédiée crée un vecteur de corruption silencieuse de l'état global. **Risque latent**.

### Filtre de disponibilité [SHIAAAAAAAAAAAAAAAAAAAAAAAA-408]
`isFull()` est maintenant importée et utilisée pour filtrer les transferts saturés sur `GET /transfers?available=true` (`server.js:14-15`). Plus de fonction orpheline.

### Données volatiles et persistance éphémère
`sold` est incrémenté par les réservations et décrémenté par les annulations ; en cas de redémarrage du serveur, les valeurs reviennent aux données hardcodées. Le service affiche l'état en mémoire courant, mais une interruption du process perd tous les changements de `sold`. Si le frontend anticipe une persistance cross-restart, c'est un risque. **Acceptable en pilote, approche revisitée pour production**.

## Dépendances externes

Aucune. `package.json:7` vide (hormis `node` ≥18). Zéro dépendance NPM = zéro risque de vulnérabilité transitive.

## Données et persistance

Tableau littéral en mémoire, réinitialisé à chaque redémarrage. Aucune base de données, aucun fichier, aucune cache. Toute réservation incrémentant `sold` serait perdue dès le redémarrage.

## Cas d'usage testés

Trois workflows HTTP documentés (tous audités, confiance high) :

1. **Consultation catalogue** (`WORKFLOW_CONSULTATION_CATALOGUE`) :
   - Client HTTP → `GET /transfers` (ou `?available=true`)
   - Serveur parse URL, valide la route, applique filtre optionnel via `isFull()`
   - Liste les 3 transferts (ou sous-ensemble) avec `seatsLeft` calculé
   - JSON → client en statut 200

2. **Réservation de sièges** (`WORKFLOW_RESERVATION_SIEGE`) :
   - Client HTTP → `POST /transfers/:id/reserve { seats: N }`
   - Serveur valide capacité, incrémente `sold`, génère UUID, retourne 200 `{ reservationId, transferId, seatsLeft }`
   - Ou retourne 404/409/400 selon l'erreur

3. **Annulation de réservation** (`WORKFLOW_ANNULATION_SIEGE`) :
   - Client HTTP → `DELETE /transfers/:id/reservations/:UUID`
   - Serveur valide cohérence ID, décrémente `sold`, supprime du registre, retourne 200 `{ seatsLeft }`
   - Ou retourne 404

Calcul de disponibilité : deux primitives pures (`seatsLeft`, `isFull`), testées, sans dépendance externe.

## Questions ouvertes

- **Persistance** : le champ `sold` sera-t-il incrémenté dans ce service (endpoint `POST /bookings`) ou synchronisé depuis un système externe (backoffice, PMS, API tierce) ?
- **Déploiement** : `shift-pilot-resa-web` tournera-t-il sur la même origine que l'API (proxy inverse) ou sur un port différent ? Détermine l'urgence de CORS.
- **Superviseur** : y a-t-il un gestionnaire de process (PM2, Docker restart policy) au-dessus de `node src/server.js`, ou le crash de process rend-il le service down jusqu'à intervention manuelle ?
- **Évolution architecturale** : le pilote sera-t-il renforcé (framework, router, validation) avant production, ou remplacé par une implémentation neuve ?

## Dettes et recommandations

**Implémentées** ✓ :
- Endpoints de réservation et annulation (SHIAAAAAAAAAAAAAAAAAAAAAAAA-61, SHIAAAAAAAAAAAAAAAAAAAAAAAA-353)
- Filtre `?available=true` + fonction `isFull()` câblée (SHIAAAAAAAAAAAAAAAAAAAAAAAA-408)

**À traiter** :
1. **CORS** — ajouter `Access-Control-Allow-Origin` (`server.js:5-8`) — bloquant frontend si API et UI sur origines différentes.
2. **try/catch URL** — protéger le parsing à `server.js:11` — risque crash actif.
3. **Sémantique 409** — message `"Transfer full"` ambigu (couvre deux cas : complet vs. pas assez de places pour la demande).
4. **Divergence `seatsLeft` / `availableSeats`** — l'API retourne `seatsLeft` ; le frontend probablement attend `availableSeats` (voir ECOSYSTEME.md).

---

**Maturité** : Pilote de démonstration. Fonctionnel pour consultation et réservation stateless, incomplet pour production (pas de persistance, pas d'authentification).

**Confiance globale** : High. Le code source est petit, lisible, et les workflows/audits ont validé la cohérence implémentation/documentation — trois endpoints (GET, POST, DELETE) et filtre de disponibilité câblés.
