# Relecture — ARCHITECTURE_AUDIT.md

## Verdict global

**À corriger** — Les observations de code sont globalement exactes et bien référencées, mais deux inférences prospectives sont présentées comme des faits vérifiés et une affirmation de risque est trop large.

## Problèmes bloquants

**[BLOQUANT-1] Prévision de découpage qualifiée comme fait**

Le constat `src/transfers.js:5-46` est vérifié : données, état et fonctions cohabitent. En revanche, « devra être découpé en au moins deux responsabilités » et « créera une rupture de contrat » décrivent une évolution future non observée. À qualifier `HYPOTHÈSE` (ou recommandation), car aucune persistance n'est présente dans le dépôt.

## Problèmes mineurs

**[MINEUR-1] Supply chain surqualifiée**

« Aucune dépendance de production » est vérifié par `package.json:1-6`. « Aucune surface d'attaque via la chaîne de dépendances » ne découle pas de ce seul fait : le risque supply chain est réduit, non nul au sens général. Reformuler en risque réduit/absence de dépendances tierces déclarées.

## Points vérifiés et corrects

- Séparation HTTP/domaine (`src/server.js:1-66`, `src/transfers.js:1-46`).
- Trois blocs de routage (`src/server.js:13`, `25-26`, `50-51`).
- Port, garde d'entrée et export (`src/server.js:62-66`).
- Aucun secret recopié.

## Recommandation

Séparer strictement faits observés et projections futures, puis resoumettre.
