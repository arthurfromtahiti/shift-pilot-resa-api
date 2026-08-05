# INDEX — Artefacts Onboarding shift-pilot-resa-api

> **Dernière mise à jour** : 2026-08-05  
> **Déclencheur** : Merge PR SHIAAAAAAAAAAAAAAAAAAAAAAAA-61 (ajout POST /transfers/:id/reserve)  
> **État** : ✓ Cohérent avec le code (commit 6ef5850)

## Structure des artefacts

### 1. **CARTE_DOMAINE.md**
**Quoi** : Modèle de données, fonctions du domaine métier, endpoints HTTP  
**Pour qui** : Développeurs backend, architectes métier  
**Contient** :
- Modèle `Transfer` (champs, invariants)
- Fonctions `listTransfers()`, `seatsLeft()`, `isFull()`, `bookSeats()`
- Endpoints `GET /transfers`, `POST /transfers/:id/reserve`
- Contrats JSON (200, 404, 409)
- Questions ouvertes

**Lire si** : vous développez une feature métier ou intégrez un nouveau frontend

---

### 2. **WORKFLOWS.md**
**Quoi** : Flux métier (cas d'usage, déroulement acteur/système, scénarios)  
**Pour qui** : Product owner, QA, développeurs intégration frontend  
**Contient** :
- **Workflow 1** : Consultation catalogue (GET /transfers) — flux principal
- **Workflow 2** : Réservation (POST /transfers/:id/reserve) — nouveau (SHIAAAAAAAAAAAAAAAAAAAAAAAA-61)
- Diagrammes séquence, états, transitions
- Scénarios de test (5 cas couverts)
- Interactions entre workflows
- Points critiques et mitigations (race conditions, persistance, auth)

**Lire si** : vous testez la réservation, débogez un flux, ou planifiez une feature future

---

### 3. **CARTOGRAPHIE_CODE.md**
**Quoi** : Structure code, implémentation détaillée, chemins critiques  
**Pour qui** : Développeurs backend, code reviewers, mainteneurs  
**Contient** :
- Arborescence fichiers
- `src/transfers.js` : logique métier (détail ligne par ligne)
- `src/server.js` : endpoints HTTP (parsing, routing, réponses)
- `test/server.test.js` : couverture tests
- Dépendances externes (modules natifs)
- Points d'interaction clé (mutation état, calculs réutilisés)
- Validation et points fragiles

**Lire si** : vous patchez une fonction, ajoutez un endpoint, ou comprenez la maintenance

---

### 4. **INDEX.md**
**Ce fichier** : Navigation entre artefacts  
**Pour qui** : Tous (entrypoint)

---

## Guide de lecture par rôle

### Je suis développeur backend
1. Commencer par **CARTE_DOMAINE.md** (modèle de données et API)
2. Puis **CARTOGRAPHIE_CODE.md** (où vit le code, comment il marche)
3. Consulter **WORKFLOWS.md** pour les cas d'usage lors de débogage

### Je suis développeur frontend
1. Commencer par **CARTE_DOMAINE.md** (endpoints et contrats JSON)
2. Puis **WORKFLOWS.md** (flux d'intégration : comment mon app appelle l'API)
3. Ignorer la plupart de CARTOGRAPHIE_CODE.md (détails backend)

### Je suis QA / testeur
1. Commencer par **WORKFLOWS.md** (cas d'usage et scénarios)
2. Consulter **CARTE_DOMAINE.md** pour contrats HTTP (200, 404, 409)
3. Référencer les tests existants dans CARTOGRAPHIE_CODE.md

### Je suis product owner / stakeholder
1. Lire **WORKFLOWS.md** uniquement (flux métier en français)
2. Ignorer CARTOGRAPHIE_CODE.md et la plupart de CARTE_DOMAINE.md

### Je fais un audit ou rédaction de doc
1. Lire cet INDEX
2. Parcourir tous les 3 artefacts en ordre CARTE → WORKFLOWS → CARTOGRAPHIE
3. Comparer avec le code réel pour vérifier cohérence

---

## Mises à jour de cette version

### SHIAAAAAAAAAAAAAAAAAAAAAAAA-61 (2026-08-05)

**Changement majeur** : Ajout de POST /transfers/:id/reserve (réservation de places)

**Fichiers modifiés au plan artefacts** :
- ✓ CARTE_DOMAINE.md : ajout fonction `bookSeats()`, endpoint POST, contrats 200/404/409
- ✓ WORKFLOWS.md : ajout Workflow 2 complet, interactions entre workflows, scénarios test
- ✓ CARTOGRAPHIE_CODE.md : détail imports (bookSeats), route POST, parsing JSON, mappage réponse
- ✓ Ce fichier (INDEX.md) : créé pour navigation

**Code impacté** :
- `src/transfers.js:21-27` — fonction `bookSeats()` (NEW)
- `src/server.js:3` — import bookSeats (UPDATED)
- `src/server.js:23-42` — route POST /transfers/:id/reserve (NEW)
- `test/server.test.js` — 3 cas POST /reserve (NEW)

**Pas modifié** :
- `src/server.js` GET /transfers (marche toujours, aucun changement)
- `src/transfers.js` listTransfers, seatsLeft, isFull (inchangés)
- Catalogue initial (idem)

---

## Cohérence

**État de vérification** : ✓ Validé 2026-08-05

| Artefact | Vs. Code | Vs. Tests | Notes |
|----------|----------|-----------|-------|
| CARTE_DOMAINE.md | ✓ | ✓ | Fonctions et contrats JSON alignés |
| WORKFLOWS.md | ✓ | ✓ | 5 scénarios test couverts par server.test.js |
| CARTOGRAPHIE_CODE.md | ✓ | ✓ | Ligne-par-ligne aligné avec src/*.js |

---

## Évolutions futures anticipées

1. **Annulation réservation**  
   DELETE /transfers/:id/cancel ou POST .../cancel  
   → Mettre à jour CARTE_DOMAINE (fonction `cancelSeats()`), WORKFLOWS (workflow annulation), CARTOGRAPHIE_CODE (implémentation)

2. **Authentification**  
   Token/session requise pour POST /reserve  
   → Mettre à jour CARTE_DOMAINE (contrat auth), WORKFLOWS (étape auth), CARTOGRAPHIE_CODE (header validation)

3. **Persistance BD**  
   Remplace `const transfers = []` par query DB  
   → Mettre à jour CARTOGRAPHIE_CODE (imports, transactions), WORKFLOWS (latence BD), CARTE_DOMAINE (invariants persistence)

4. **Frontend implémente formulaire réservation**  
   Aujourd'hui todo (workflow 2 écrit mais pas de UI)  
   → Vérifier cohérence contrats avec frontend, mises à jour minimes côté API

---

## Ressources externes

- **Code** : tous les fichiers src/, test/
- **Dépendances** : package.json (Jest, Supertest)
- **Intégration** : voir documents/ECOSYSTEME.md (relations avec shift-pilot-resa-web)
- **Issue parent** : SHIAAAAAAAAAAAAAAAAAAAAAAAA-60 (epic réservation)
- **PR ferme** : SHIAAAAAAAAAAAAAAAAAAAAAAAA-61 (merged main)

---

## Comment maintenir ces artefacts

**Trigger** : Après tout changement code affectant métier ou API

1. **Vérifier cohérence** :
   - Fonction ajoutée/modifiée → CARTE_DOMAINE section "Fonctions du domaine"
   - Endpoint ajouté/modifié → CARTE_DOMAINE section "Endpoints HTTP"
   - Flux affecté → WORKFLOWS section pertinente
   - Détail impl changé → CARTOGRAPHIE_CODE section pertinente

2. **Réecrire minimalement** :
   - Pas de réécriture complète si une fonction reste inchangée
   - Une feature new → une section new (ne pas fusionner)
   - Une correction → un correction (no reorg)

3. **Tester cohérence** :
   - Lire le code change → vérifier qu'artefact match
   - Lancer tests → s'assurer que scénarios dans WORKFLOWS passent
   - Chercher la fonction dans CARTOGRAPHIE_CODE → s'assurer qu'elle y est décrite

4. **Committer avec la feature** :
   - Artefacts mises à jour dans même PR que la feature
   - Pas de PR "doc only" à moins de grosse correction
   - Message commit : "feat(ISSUE-X): [feature] + maj .onboarding/"

---

## Questions / Rédacteur

**Rédacteur** : Claude Code (Anthropic)  
**Compétence** : maj-documentation (Paperclip)  
**Dernier audit** : 2026-08-05 post SHIAAAAAAAAAAAAAAAAAAAAAAAA-61

Pour corrections ou suggestions, ouvrir issue ou commenter la PR.
