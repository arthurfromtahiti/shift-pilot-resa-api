# Relecture — ECOSYSTEME.md

## Verdict global

**À corriger** — Un problème bloquant : affirmation factuelle fausse sur les valeurs de `sold`, en contradiction directe avec le code source et avec les calculs corrects du document lui-même. Un problème mineur de formulation ambiguë sur le mismatch de noms de champ. Tout le reste est traçable et correct.

---

## Problèmes bloquants

### 1. Valeurs de `sold` erronées (ligne 99 du document)

**Affirmation du document** :
> `sold` (places vendues) : jamais exposée en HTTP, jamais incrémentée (**reste à zéro pour Papeete→Moorea et Raiatea→Tahaa** ; égale à 60 pour Bora Bora)

**Code source réel** (`src/transfers.js:4-7`) :
```js
{ id: 1, from: "Papeete", to: "Moorea",    seats: 40, sold: 12, price: 3500  },
{ id: 2, from: "Papeete", to: "Bora Bora", seats: 60, sold: 60, price: 21000 },
{ id: 3, from: "Raiatea", to: "Tahaa",     seats: 20, sold:  5, price: 1800  },
```

- Papeete→Moorea : `sold: 12` (pas zéro)
- Raiatea→Tahaa : `sold: 5` (pas zéro)
- Bora Bora : `sold: 60` ✓

**Auto-contradiction** : le document calcule correctement `seatsLeft: 28` (= 40 − 12) et `seatsLeft: 15` (= 20 − 5) dans la section "Contrat API réel", ce qui prouve que le rédacteur avait les bonnes valeurs. L'affirmation "reste à zéro" est une erreur de transcription, pas une invention délibérée — mais elle fausse la compréhension de l'état pilote (le document fait croire que le stock est vierge pour deux des trois trajets, alors que 17 places ont déjà été vendues).

**Correction attendue** : remplacer par les valeurs réelles.

---

## Problèmes mineurs

### 2. Formulation ambiguë sur le mismatch `seatsLeft` / `availableSeats` (ligne 50)

**Affirmation du document** :
> Cet écart **fonctionne accidentellement** car les noms ne sont utilisés qu'en tant que clés de propriétés — JavaScript ignore l'absence de l'une dans l'affichage.

**Réalité** : `t.availableSeats` dans `js/app.js:13` accède une propriété inexistante (`undefined`) car l'API renvoie `seatsLeft`. L'affichage ne "fonctionne" pas — il produit `(undefined places)`. Le document se corrige lui-même correctement aux lignes 81 et 139-140, mais la formulation de la section "Mismatch détecté" laisse croire à un comportement silencieusement acceptable, ce qui est trompeur pour un lecteur qui n'irait pas jusqu'aux "Cassures observées".

**Correction attendue** : remplacer "fonctionne accidentellement" par un énoncé direct : le champ `availableSeats` reçoit `undefined` à l'exécution, produisant un affichage "(undefined places)" systématique.

---

## Points vérifiés et corrects

- **Endpoint `GET /transfers`** → `src/server.js:13` vérifié. ✓
- **Références de fichiers et numéros de ligne** (app.js:2-3, 6, 7, 10-15 ; server.js:10-13, 14-20, 26 ; transfers.js:3-7, 9-11, 13-15) → toutes vérifiées sur le code réel. ✓
- **Schéma de réponse JSON** (id, from, to, price, seatsLeft) → `src/server.js:14-20` exact. ✓
- **Calculs seatsLeft** : 28, 0, 15 → `src/transfers.js:13-15`, `src/transfers.js:3-7`. ✓
- **`seats` non exposé en HTTP** → `src/server.js:14-20` : `.map()` exclut `seats` et `sold`. ✓
- **PORT configurable** → `process.env.PORT || 3100` (`src/server.js:26`). ✓
- **Injection `window.API_BASE_URL`** → `js/app.js:2-3`. ✓
- **`for...of` sans validation, pas de `try/catch`** → `js/app.js:5-16`. ✓
- **Aucune route POST/mutation** → `src/server.js:10-24` : seule la branche GET /transfers est traitée. ✓
- **Les deux fichiers sont identiques** (déposés dans les deux workspaces). ✓
- **Marquage de confiance "medium"** : justifié par la lecture directe du code des deux workspaces ; honnête. ✓
- **Questions ouvertes** : toutes tracées à des observations de code réelles (CDC web §Questions ouvertes, CDC API §Délimitation). ✓
- **Responsabilités de chaque workspace** : délimitation correcte et traçable aux CDC de chaque workspace. ✓

---

## Synthèse

Le document exploite bien la matière disponible (aucune creux, aucune section de remplissage) et les preuves code sont citées avec précision. Un seul fait brut est erroné (valeurs de `sold`) et une formulation est trompeuse (mismatch "qui fonctionne"). Ces deux points sont localisés et corrigibles sans restructuration. Le rédacteur peut produire la version corrigée rapidement.
