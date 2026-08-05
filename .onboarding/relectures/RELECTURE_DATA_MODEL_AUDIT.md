# Relecture — DATA_MODEL_AUDIT.md

## Verdict global

**Bon** — Audit du modèle de données rigoureux et honnête : le schéma est décrit avec précision, les absences de contraintes sont correctement qualifiées en `HYPOTHÈSE`, les risques conditionnels sont explicitement posés comme tels ("si une route POST est ajoutée"). La table récapitulative des champs est un excellent ajout de lisibilité.

## Problèmes bloquants

Aucun.

## Problèmes mineurs

- **"sold sans chemin d'écriture — VÉRIFIÉ_CODE. Recherche `grep -niE "sold\s*=" src/`"** : la commande grep citée est présentée comme la preuve, mais le résultat de cette recherche n'est pas reproduit verbatim dans l'audit (seule la conclusion est donnée). La règle `VÉRIFIÉ_CODE` recommande `fichier:ligne`. En l'occurrence, les seules occurrences de `sold` dans `src/` sont `src/transfers.js:4`, `src/transfers.js:5`, `src/transfers.js:6` (déclaration initiale) et `src/transfers.js:14` (dans `seatsLeft = seats - sold`). La conclusion reste exacte ; la preuve est vérifiable. Mineure.

## Points vérifiés et corrects

- Table des champs (`id`, `from`, `to`, `seats`, `sold`, `price`) et valeurs : confirmée contre `src/transfers.js:3-7`. ✓
- Encapsulation : `seats` et `sold` absents de la projection `src/server.js:14-20`. ✓
- `seatsLeft(t) = t.seats - t.sold` (`src/transfers.js:13-15`). ✓
- Absence de contraintes : correctement labellée `HYPOTHÈSE` — aucun code de validation dans `src/transfers.js`. ✓
- `sold` uniquement en déclaration initiale (`src/transfers.js:4-6`), jamais modifié. ✓
- `id` : entiers séquentiels 1, 2, 3. ✓
- Absence de dimension temporelle : confirmée. ✓
- `price` sans unité monétaire : correctement labellé `HYPOTHÈSE` sur le XPF. ✓
- Recommandation 3 (réinitialiser `sold` Bora Bora) : actionnable, pointant `src/transfers.js:5`. ✓
- Zéro secret dans les constats. ✓

## Recommandations de correction

Aucune correction nécessaire. La preuve du grep non reproduit in extenso est un point de style ; le constat reste exact et vérifiable.
