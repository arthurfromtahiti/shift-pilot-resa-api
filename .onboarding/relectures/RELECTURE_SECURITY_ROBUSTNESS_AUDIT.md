# Relecture — SECURITY_ROBUSTNESS_AUDIT.md

## Verdict global

**À corriger** — Un défaut bloquant : la race condition est présentée comme `VÉRIFIÉ_CODE` alors qu'elle est **impossible en process unique** et doit être qualifiée `HYPOTHÈSE`. L'audit contredit directement le workflow `WORKFLOW_RESERVATION_SIEGE.md` (déjà validé dans cette même chaîne), qui qualifie correctement ce point. Les autres constats sont exemplaires.

## Problèmes bloquants

**[BLOQUANT-1] Race condition qualifiée `VÉRIFIÉ_CODE` — statut incorrect, contradiction avec un artefact validé**

L'audit affirme : « l'event loop peut interleaver deux requêtes POST simultanées : si deux requêtes lisent `seatsLeft` avant que l'une des deux n'ait écrit, elles peuvent toutes deux passer la garde avec le même stock » — statut `VÉRIFIÉ_CODE`.

Vérification effectuée :

1. `bookSeats` (`src/transfers.js:21-27`) est une fonction **synchrone** — aucun `await`, aucun callback à l'intérieur. Une fois le callback `req.on("end")` déclenché, `bookSeats` s'exécute jusqu'à son retour sans jamais rendre la main à l'event loop.

2. Node.js est **single-threaded** : le modèle d'exécution garantit qu'un callback ne peut pas être interrompu par un autre callback pendant son exécution synchrone. Deux callbacks `req.on("end")` simultanés s'exécutent séquentiellement, jamais en parallèle.

3. Le `WORKFLOW_RESERVATION_SIEGE.md` (validé dans cette chaîne) qualifie exactement ce point : « la race condition est **impossible en process unique**. Elle deviendrait réelle uniquement en mode cluster Node.js (plusieurs workers partageant un état commun), qui n'est ni configuré ni documenté dans ce dépôt. » Statut : `HYPOTHÈSE — mode cluster uniquement`.

Conclusion : l'absence de mécanisme de verrou est bien `VÉRIFIÉ_CODE` (vérifiable par lecture du code), mais l'inférence d'une race condition effective avec l'implémentation actuelle est une `HYPOTHÈSE` incorrecte pour le process unique. Présenter cette inférence comme `VÉRIFIÉ_CODE` est le défaut de discipline de preuve à éviter.

**Correction requise** : remplacer le statut `VÉRIFIÉ_CODE` sur la race condition par `HYPOTHÈSE — mode cluster uniquement`, préciser que la race condition est impossible avec la fonction synchrone actuelle en process unique, et aligner la formulation sur `WORKFLOW_RESERVATION_SIEGE.md` (`src/server.js:28-39`, `src/transfers.js:21-27`).

Note interne détectée mais non corrigée : l'audit dit lui-même « Documenté dans WORKFLOWS.md comme acceptable en pilote (traffic faible, single-thread) » — la mention *single-thread* devrait suffire à invalider le scénario de race condition décrit juste avant. L'incohérence est interne à l'audit.

## Problèmes mineurs

Aucun autre problème identifié.

## Points vérifiés et corrects

- **Bug `seats` négatif** (`VÉRIFIÉ_CODE`, `src/transfers.js:24-25`) : démonstration complète et exacte. `28 < -1` est `false` → garde non déclenchée → `transfer.sold += -1`. Reproduisible par lecture seule. ✓
- **Absence d'authentification** (`VÉRIFIÉ_CODE`, `src/server.js:23-42`) : aucun header d'autorisation requis. Confirmé. ✓
- **Absence de CORS** (`VÉRIFIÉ_CODE`) : aucun header `Access-Control-*` dans `sendJson` ni ailleurs dans `src/server.js`. Confirmé. ✓
- **Parsing JSON silencieux** (`VÉRIFIÉ_CODE`, `src/server.js:30-35`) : le `try/catch` sur `JSON.parse` absorbe les erreurs ; `seats = undefined` → `?? 1`. Confirmé. Note : si `body = ""` (vide), la condition `body ? ... : {}` évalue à `{}` sans appel à `JSON.parse` — comportement légèrement différent de la description mais conclusion identique. ✓
- **Header `Host` non validé** (`src/server.js:11`) : pratique risquée sur un service durci, sans impact d'injection dans ce contexte. Calibrage correct. ✓
- **Projection publique correcte** (`src/server.js:14-20`) : `seats` et `sold` masqués. ✓
- **Aucune dépendance externe** : surface supply chain nulle. ✓
- **Aucun secret recopié**. ✓

## Recommandations de correction

1. Corriger le constat « Race condition » : statut `HYPOTHÈSE — mode cluster uniquement`, expliquer que la synchronicité de `bookSeats` et le modèle single-threaded de Node.js rendent la race condition impossible en process unique, et préciser qu'elle deviendrait réelle uniquement avec des appels async (DB) ou en mode cluster. Supprimer la contradiction interne avec la mention "single-thread" déjà présente dans le texte.
