# Relecture — ECOSYSTEME.md

## Verdict global

**À corriger** — 4 défauts bloquants : une confiance globale "high" non justifiée par l'amont, une erreur factuelle sur l'opérateur de fallback (`|| 1` au lieu de `?? 1`), une étape de flux inventée (rafraîchissement automatique après réservation), et une section "Crédits et maintenance" hors périmètre d'un document de référence. La matière substantielle (divergence seatsLeft/availableSeats, CORS, seats validation) est correctement sourcée et exploitée.

---

## Problèmes bloquants

### B1 — Confiance "high" non traçable à l'amont

**Affirmation** : ligne 3 — `> **Confiance** : high`

**Preuve d'amont contradictoire** :
- `PROJECT_CONTEXT.md` du web (validé) : **"Confiance globale : medium–high"**
- `SECURITY_ROBUSTNESS_AUDIT.md` API : "Le service est un pilote de démonstration sans aucune couche de sécurité"
- L'intégration est cassée dès maintenant : `seatsLeft` vs `availableSeats` → `undefined places` affiché en production
- CORS non résolu : workflow principal bloqué dès déploiement multi-domaine

La confiance "high" signifie "fonctionnel et couvert" ; ici le flux principal produit `undefined places` en exécution réelle. La valeur correcte est **medium**, cohérente avec l'amont et avec la version `documents/ECOSYSTEME.md` du repo API (qui disait "medium").

**Correction attendue** : remplacer `high` par `medium` et optionnellement ajouter une ligne justificatrice (ex. "lecture du code exhaustive ; contrat d'intégration cassé sur seatsLeft/availableSeats").

---

### B2 — Erreur factuelle : `|| 1` au lieu de `?? 1` (Risque 3)

**Affirmation** : ligne 145 — `Fallback : \`const seats = body.seats || 1\` (masque erreur)`

**Preuve code** (`src/server.js:36`) :
```js
const result = bookSeats(id, seats ?? 1);
```

Le code utilise `??` (nullish coalescing — remplace uniquement `null`/`undefined`), pas `||` (logical OR — traiterait aussi `0` et `""` comme falsy). La différence est sémantique : avec `|| 1`, un appel `{ seats: 0 }` serait silencieusement remplacé par 1 ; avec `?? 1`, il ne l'est pas (0 est explicit et passerait dans bookSeats). Le `SECURITY_ROBUSTNESS_AUDIT.md` utilise le terme correct (`seats ?? 1` à la ligne de recommandation).

De plus, la variable n'est pas `body.seats` mais `seats` (déjà extraite par `seats = parsed.seats` à la ligne 32). La formulation du document reconstruit incorrectement le code source.

**Correction attendue** : remplacer "`const seats = body.seats || 1`" par "`seats ?? 1` (ligne 36 — `null`/`undefined` uniquement remplacé par 1)".

---

### B3 — Invention : rafraîchissement automatique des places (Flux 2, étape 6)

**Affirmation** : ligne 77 — "Autres voyageurs voyant la page mis à jour verront les places décrémentées"

**Preuve d'amont contradictoire** — `CDC_FONCTIONNEL.md` web, section "Inachevé ou indéterminable" :
> "Rafraîchissement en temps réel : la fonction `loadTransfers()` peut théoriquement être rappelée, **mais aucun déclencheur (polling, WebSocket) n'existe dans le code**"

La page web ne se rafraîchit jamais automatiquement. Une réservation effectuée via l'API ne sera visible par d'autres voyageurs que s'ils rechargent manuellement la page. L'étape 6 décrit un comportement inexistant, qui confond le lecteur sur la nature du système.

**Correction attendue** : supprimer l'étape 6 ou la reformuler : "D'autres voyageurs doivent recharger manuellement la page pour voir les places mises à jour — aucun mécanisme de rafraîchissement temps réel (polling, WebSocket) n'existe dans le code actuel."

---

### B4 — Section "Crédits et maintenance" hors périmètre d'un document de référence

**Affirmation** : lignes 272–283 — auteur IA, dates de runs, IDs d'issues internes, "Pour corriger ou suggérer, créer issue ou commenter PR."

Un document de référence d'onboarding (ECOSYSTEME.md, publié à l'identique dans deux repos) ne contient pas de méta-information d'outil (auteur Claude Code, run dates, références d'issues Paperclip). Ces données sont propres au processus de production, pas au contenu ; elles polluent le document et le datent artificiellement.

La phrase "Pour corriger ou suggérer, créer issue ou commenter PR" est particulièrement inappropriée dans un document déposé sur disque dans `.onboarding/` : elle instruite le lecteur vers un processus de contribution comme si le document était un wiki en ligne.

**Correction attendue** : supprimer entièrement la section "Crédits et maintenance" (lignes 272–284).

---

## Problèmes mineurs

### M1 — Référence ligne inexacte : "src/server.js:28" (Risque 3)

**Affirmation** : ligne 144 — "Implémentation : `src/server.js:28` extrait `body.seats` sans validation"

Le code à la ligne 28 est `req.on("end", () => {` — c'est l'ouverture du callback de fin de body, pas l'extraction de `seats`. L'extraction est à la ligne 32 (`seats = parsed.seats`). La référence est approximative, pas fausse dans l'esprit mais inexacte à la lecture.

**Correction attendue** : remplacer `:28` par `:29-34` (bloc try/catch d'extraction de `seats`).

---

### M2 — Référence ligne inexacte : "server.js:21-44" (Endpoint 2)

**Affirmation** : ligne 35 — "Implémentation API : `shift-pilot-resa-api/src/server.js:21–44`"

Le `CODE_HOTSPOTS_AUDIT.md` désigne cette zone comme `:23-42`. La ligne 21 est la fermeture du bloc GET (`}`), et la ligne 44 est le catch-all 404 (route distincte). La route POST débute à la ligne 23 et son bloc se termine à la ligne 41.

**Correction attendue** : remplacer `:21–44` par `:23–41`.

---

### M3 — Fichiers `documents/ECOSYSTEME.md` en doublon incohérent

Les deux repos contiennent un fichier `documents/ECOSYSTEME.md` **différent** du fichier canonique `.onboarding/documents/ECOSYSTEME.md`. Les versions `documents/` semblent être des artefacts intermédiaires de rédaction ; elles divergent significativement du document publié et créent une confusion sur quelle version fait foi.

**Correction attendue** : supprimer (ou archiver) `documents/ECOSYSTEME.md` dans les deux repos. Le document canonique est `.onboarding/documents/ECOSYSTEME.md`.

---

## Points vérifiés et corrects

- **Divergence seatsLeft/availableSeats** : bien identifiée et doublement sourcée (`src/server.js:19` pour l'API, `js/app.js:13` pour le front) — `FUNCTIONAL_AUDIT.md` et `CDC_FONCTIONNEL.md` web confirment.
- **Risque CORS** : correctement documenté et traceable au `SECURITY_ROBUSTNESS_AUDIT.md` (section "Absence de headers CORS").
- **Risque validation `seats`** : le bug en lui-même (pas le fallback — cf. B2) est correctement identifié et sourcé au `SECURITY_ROBUSTNESS_AUDIT.md`.
- **Formulaire réservation absent** : correctement sourcé au `CDC_FONCTIONNEL.md` web et à `WORKFLOW_RESERVATION_SIEGE.md`.
- **Endpoint POST /reserve documenté** : ajout bienvenu ; contrat (200, 404, 409) traceable au `FUNCTIONAL_AUDIT.md`.
- **Questions ouvertes** : les 5 questions sont pertinentes et traçables aux audits et CDC (champ dispo, CORS, formulaire, déploiement, persistance).
- **Checklist d'intégration** : utile et cohérente avec les risques identifiés dans l'amont.
- **Identité des fichiers entre les deux repos** : les deux `.onboarding/documents/ECOSYSTEME.md` sont bien identiques — contrainte de l'issue respectée.
- **Flux 1** (étapes 1-5) : séquence correcte et conforme au `CDC_FONCTIONNEL.md` web (DOMContentLoaded → fetch GET /transfers → rendu DOM).
- **Schéma "développement local"** : correct et traceable.
- **Schéma "production (hypothèse)"** : marqué "(hypothèse)" — acceptable, bien que le port 443/HTTPS ne soit pas sourcé ; le marquage le préserve d'être une invention.

---

## Recommandations de correction

Par ordre de priorité :

1. **Confiance (B1)** : remplacer `high` par `medium` ligne 3.
2. **Opérateur fallback (B2)** : corriger "`const seats = body.seats || 1`" → "`seats ?? 1` (ligne 36 — remplace uniquement `null`/`undefined` par 1)" et ajuster la référence à `server.js:29-34` pour l'extraction.
3. **Étape 6 Flux 2 (B3)** : supprimer ou corriger l'étape "Autres voyageurs voyant la page mis à jour verront les places décrémentées".
4. **Section Crédits (B4)** : supprimer les lignes 272–284 entières.
5. **Références lignes (M1, M2)** : corriger `server.js:28` → `:29-34` et `server.js:21-44` → `:23-41`.
6. **Doublons (M3)** : supprimer `documents/ECOSYSTEME.md` dans les deux repos.

Les corrections sont de surface (remplacements ponctuels) — la structure, la substance et les preuves du document sont saines.

---

## Passe 2 — Vérification des corrections (2026-08-06)

### Bilan des corrections appliquées

| Réf | Intitulé | Statut |
|-----|----------|--------|
| B1 | Confiance `high` → `medium` | ❌ NON CORRIGÉ |
| B2 | Opérateur `\|\|` → `??` + variable `body.seats` → `parsed.seats` | ⚠️ PARTIEL (opérateur corrigé, variable reste incorrecte) |
| B3 | Étape 6 Flux 2 — rafraîchissement automatique inventé | ❌ NON CORRIGÉ |
| B4 | Section "Crédits et maintenance" à supprimer | ❌ NON CORRIGÉ |
| M1 | Référence `:28` → `:29-34` | ⚠️ PARTIEL (changé en `:32`, plus précis mais différent de la cible) |
| M2 | Référence `:21–44` → `:23–41` | ❌ NON CORRIGÉ |
| M3 | Doublons `documents/ECOSYSTEME.md` | ❌ NON CORRIGÉ |

### Verdict passe 2

**À corriger à nouveau** — 3 bloquants sur 4 restent non appliqués (B1, B3, B4). Le B2 est partiellement corrigé (opérateur `??` OK, mais `body.seats` ligne 143 doit encore être corrigé en `parsed.seats`). M2 et M3 également toujours en attente.

#### B1 — Ligne 3 : `> **Confiance** : high` (toujours présent)
Doit être `medium`. Preuve : `PROJECT_CONTEXT.md` web dit "medium–high", flux principal produit `undefined places` en l'état.

#### B2 (résidu) — Ligne 143 : `extrait \`body.seats\` sans validation`
La variable n'est pas `body.seats` (accès au body brut) mais `parsed.seats` (accès à l'objet parsé, ligne 32 du server.js). Corriger en `extrait \`parsed.seats\` sans validation`.

#### B3 — Ligne 77 : rafraîchissement automatique (toujours présent)
`"Autres voyageurs voyant la page mis à jour verront les places décrémentées"` décrit un comportement inexistant. Supprimer ou reformuler : `"Autres voyageurs doivent recharger manuellement la page — aucun mécanisme de rafraîchissement (polling, WebSocket) n'existe."` 
Preuve : `CDC_FONCTIONNEL.md` web, section "Inachevé ou indéterminable" : "aucun déclencheur (polling, WebSocket) n'existe dans le code".

#### B4 — Lignes 272-284 : Section "Crédits et maintenance" (toujours présente)
Supprimer entièrement les lignes 272 à la fin du fichier.

#### M2 — Ligne 35 : `:21–44` → `:23–41`
La route POST débute ligne 23 et se termine ligne 41, pas 21–44.

#### M3 — Doublons `documents/ECOSYSTEME.md`
Les fichiers `shift-pilot-resa-api/documents/ECOSYSTEME.md` et `shift-pilot-resa-web/documents/ECOSYSTEME.md` existent toujours. À supprimer — la version canonique est `.onboarding/documents/ECOSYSTEME.md`.

### Note sur le périmètre de cette passe

La relecture confirme que les éléments substantiels du document (risques 1-5, questions ouvertes, checklist) restent corrects et sourcés. Seuls des corrections de surface (confiance, opérateurs, références, suppression) sont requises.
