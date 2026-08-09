# Relecture — FUNCTIONAL_AUDIT.md

## Verdict global

**Approuvé** — Corrections appliquées : source frontend recitée en `.onboarding/documents/ECOSYSTEME.md:14-22` (BLOQUANT-1 résolu) ; priorité `seatsLeft`/`availableSeats` ramenée à « à confirmer après audit du dépôt frontend » avec statut `HYPOTHÈSE` explicite (MINEUR-2 résolu). L'audit distingue maintenant correctement API observée / intégration frontend hypothétique.

## Problèmes bloquants

**[BLOQUANT-1] Source frontend introuvable telle que citée — RÉSOLU**

~~Le constat cite `documents/ECOSYSTEME.md:14-22`, mais ce chemin n'existe pas dans le checkout.~~ Corrigé : la source est maintenant citée `.onboarding/documents/ECOSYSTEME.md:14-22` ; `VÉRIFIÉ_CODE` restreint à `src/server.js:16-22` ; l'attente `availableSeats` et l'affichage `undefined` qualifiés en `HYPOTHÈSE`.

## Problèmes mineurs

**[MINEUR-1] « trois workflows frontend bloqués » — RÉSOLU**

Portée revue : l'impact CORS sur réservation et annulation est maintenant présenté comme prospectif (`HYPOTHÈSE`/incertitude), pas comme établi.

**[MINEUR-2] Priorité haute fondée sur un contrat frontend non vérifiable — RÉSOLU**

La priorité « haute » de l'alignement `seatsLeft`/`availableSeats` est remplacée par « à confirmer après audit du dépôt frontend ». Le risque conserve le statut `HYPOTHÈSE` et le constat API reste `VÉRIFIÉ_CODE` (`src/server.js:21`). La distinction API observée / intégration frontend hypothétique est maintenant explicite.

## Points vérifiés et corrects

- Routage et statuts HTTP (`src/server.js:13-57`).
- Ambiguïté du 409 (`src/transfers.js:29`, `src/server.js:43-45`).
- Seed complet id 2 (`src/transfers.js:7`).
- Aucun secret recopié.

## Recommandation

Corriger le chemin source et scinder systématiquement API observée / intégration frontend hypothétique.
