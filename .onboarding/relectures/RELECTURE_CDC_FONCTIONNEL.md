# Relecture — CDC_FONCTIONNEL

## Verdict global

**Bon** — Le CDC est substantiel, bien sourcé et fidèle au code. Chaque règle métier (`seatsLeft`, `isFull`, projection JSON) cite sa ligne de code. Les hypothèses sont regroupées et marquées. Les non-fonctionnalités (réservation, persistance, filtrage) sont explicitement délimitées. Deux points mineurs signalés ci-dessous, aucun bloquant.

---

## Problèmes bloquants

Aucun.

---

## Problèmes mineurs

**[M1] URL d'intégration non marquée HYPOTHÈSE (§ Intégrations déclarées, ligne ~165)**

> « Intégration attendue : `fetch('http://api:3100/transfers')` ou similaire »

La mention `ou similaire` en fait clairement un exemple, mais l'URL `http://api:3100` n'est présente dans aucun document amont (ni dans `WORKFLOW_LISTE_TRANSFERTS.md`, ni dans les audits, ni dans `README.md:4` qui mentionne seulement le nom du dépôt frontend). Elle devrait être préfixée `HYPOTHÈSE` ou reformulée en `http://localhost:3100/transfers` (seule URL prouvée par le code). Source amont consultée : `WORKFLOW_LISTE_TRANSFERTS.md § Intégrations` — zéro mention de l'URL d'appel.

**[M2] Déclencheur du parcours utilisateur non prouvé (§ Parcours utilisateur principal, ligne ~35)**

> « Déclencheur : accès au frontend `shift-pilot-resa-web`, affichage du catalogue. »

Le fait que le frontend provoque ce déclencheur est une inférence du `README.md:4` — aucun workflow ni audit ne précise le déclencheur UI-level. `WORKFLOW_LISTE_TRANSFERTS.md` parle de « Client HTTP externe » sans décrire le déclencheur frontal. Acceptable en contexte pilote mais devrait porter une balise `HYPOTHÈSE`.

---

## Points vérifiés et corrects

- **Règle seatsLeft** : `seats - sold`, sourçage `transfers.js:13-15` — confirmé dans `WORKFLOW_CALCUL_DISPONIBILITE.md § Règles métier` et `FUNCTIONAL_AUDIT.md`.
- **Règle isFull** : `seatsLeft === 0`, binaire, sourçage `transfers.js:17-19` — confirmé dans `WORKFLOW_CALCUL_DISPONIBILITE.md`.
- **Données du catalogue** : 3 transferts, valeurs id/from/to/seats/sold/price/seatsLeft — confirmées dans `WORKFLOW_LISTE_TRANSFERTS.md § Données` et `CODE_HOTSPOTS_AUDIT.md`.
- **Projection JSON** : exclusion de `seats` et `sold` — `VÉRIFIÉ_CODE` dans `FUNCTIONAL_AUDIT.md` (server.js:14-20).
- **404 catch-all** : toute URL non reconnue → `{ error: "Not found" }` statut 404 — `FUNCTIONAL_AUDIT.md § Route 404 catch-all`.
- **Crash URL malformée** : correctement qualifié comme risque actif — `SECURITY_ROBUSTNESS_AUDIT.md § Crash sur URL malformée`.
- **CORS absent** : bloquant pour le frontend — `SECURITY_ROBUSTNESS_AUDIT.md § Absence de headers CORS`.
- **isFull orpheline** : exportée non câblée — `FUNCTIONAL_AUDIT.md § isFull non exposée côté HTTP`, `CODE_HOTSPOTS_AUDIT.md § Hotspot 3`.
- **Hypothèses** : trois scénarios futurs pour `sold` (endpoint POST, synchro externe, fixture de test) — bien marqués HYPOTHÈSE, cohérents avec `FUNCTIONAL_AUDIT.md § Questions ouvertes`.
- **Questions ouvertes** : toutes tracées à des incertitudes réelles identifiées dans les audits.
- **Barre de qualité** : synthèse finale conforme au contenu — pas d'invention.

---

## Recommandations de correction

1. **[M1]** Remplacer `fetch('http://api:3100/transfers')` par `fetch('http://localhost:3100/transfers') (HYPOTHÈSE — URL illustrative, non confirmée)` ou supprimer la ligne si l'URL n'est pas prouvée.
2. **[M2]** Ajouter `(HYPOTHÈSE — déduit de README.md:4, non confirmé par un workflow)` après le déclencheur UI.
