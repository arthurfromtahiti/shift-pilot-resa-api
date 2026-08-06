# Relecture — CARTOGRAPHIE_CODE

## Verdict global

**Bon** — La cartographie est exhaustive, précise et intégralement traçable aux audits. Chaque domaine, export, import, point critique et anti-pattern est sourcé avec le fichier et la ligne correspondants. Le diagramme de flux de requête est fidèle au code. Un point mineur signalé sur la section "Évolutions prévisibles" (projections techniques non sourcées dans les audits), mais clairement étiquetée comme telle — non bloquant.

---

## Problèmes bloquants

Aucun.

---

## Problèmes mineurs

**[M1] "Évolutions prévisibles" — recommandations non entièrement sourcées dans les audits (§ Évolutions prévisibles, lignes ~258-268)**

Les items "Possiblement ajouter un pool de connexion/cache" et "Adapter `listTransfers()` pour retourner une promesse (changement d'API)" sont des projections d'ingénierie raisonnables mais non présentes dans les audits amont (`ARCHITECTURE_AUDIT.md § Recommandations` ne mentionne pas de pool de connexion ni de promesse). L'item "POST /bookings" est sourcé dans `FUNCTIONAL_AUDIT.md:55`. La section est clairement étiquetée "prévisibles" (pas "prouvées"), ce qui atténue le risque d'invention — mais une note explicite `(HYPOTHÈSE — extrapolation non sourcée dans les audits)` renforcerait l'honnêteté du document.

---

## Points vérifiés et corrects

- **Domaine 1 — Transport HTTP** : server.js 30 lignes, exports (`server`), imports (`listTransfers`, `seatsLeft`, `node:http`, `node:url`) — confirmés dans `ARCHITECTURE_AUDIT.md § Séparation des responsabilités`.
- **Domaine 2 — Logique métier** : transfers.js 21 lignes, tableau littéral 3 transferts, 3 exports (`listTransfers`, `seatsLeft`, `isFull`) — confirmés dans `CODE_HOTSPOTS_AUDIT.md`, `WORKFLOW_CALCUL_DISPONIBILITE.md`.
- **Hotspot 1 — URL Parsing** : server.js:11, TypeError, pas de try/catch, risque crash — `CODE_HOTSPOTS_AUDIT.md § Hotspot 1`, `SECURITY_ROBUSTNESS_AUDIT.md § Crash sur URL malformée`.
- **Hotspot 2 — Référence mutable** : transfers.js:10, `return transfers` sans copie — `CODE_HOTSPOTS_AUDIT.md § Hotspot 2`, `ARCHITECTURE_AUDIT.md § Référence mutable exposée`.
- **Hotspot 3 — isFull orpheline** : exportée non importée par server.js — `CODE_HOTSPOTS_AUDIT.md § Hotspot 3`.
- **Diagramme de flux HTTP** : flux complet de la requête (parse URL → routeur → listTransfers → map → seatsLeft → sendJson) conforme à `WORKFLOW_LISTE_TRANSFERTS.md § Étapes principales`.
- **Dépendances internes** : acyclique, server.js → transfers.js, test → transfers.js uniquement — `ARCHITECTURE_AUDIT.md § Compréhension globale`.
- **Bonnes pratiques** : séparation transport/domaine, fonctions pures, guard `require.main === module`, `sendJson` centralisé — `ARCHITECTURE_AUDIT.md § Forces`.
- **Anti-patterns** : routing inline, pas de copie défensive, pas de validation de schéma, pas d'error handling — `ARCHITECTURE_AUDIT.md § Dettes techniques`, `CODE_HOTSPOTS_AUDIT.md`.
- **Données des 3 transferts** : valeurs précises (seats, sold, seatsLeft) — `WORKFLOW_LISTE_TRANSFERTS.md § Données`.
- **Port et PORT env var** : port 3100, surchargeable via `PORT` — `SECURITY_ROBUSTNESS_AUDIT.md` ("La seule variable d'environnement lue est `PORT` (`src/server.js:26`)").
- **Arborescence** : conforme à l'état réel du dépôt.

---

## Recommandations de correction

1. **[M1]** Dans la section "Évolutions prévisibles", ajouter une note en tête : `Les éléments suivants sont des projections d'ingénierie non documentées dans les audits existants — marqués (HYPOTHÈSE).` et annoter spécifiquement "pool de connexion/cache" et "retourner une promesse" avec `(HYPOTHÈSE)`.
