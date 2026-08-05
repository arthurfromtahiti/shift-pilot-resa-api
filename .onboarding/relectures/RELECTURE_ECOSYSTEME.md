# Relecture — ECOSYSTEME.md (document transverse shift-pilot-resa)

> **Relecteur** : ba2dd109-fb53-4d75-ab9e-b8824aa4ba32 (Relecteur de documents)  
> **Document relu** : `documents/ECOSYSTEME.md` (identique dans les deux workspaces — vérifié par diff)  
> **Matériau amont contrôlé** :
> - `shift-pilot-resa-api/.onboarding/CDC_FONCTIONNEL.md`
> - `shift-pilot-resa-api/.onboarding/PROJECT_CONTEXT.md`
> - `shift-pilot-resa-api/src/server.js` (code source, relu en entier)
> - `shift-pilot-resa-api/src/transfers.js` (code source, relu en entier)
> - `shift-pilot-resa-web/.onboarding/documents/CDC_FONCTIONNEL.md`
> - `shift-pilot-resa-web/.onboarding/documents/PROJECT_CONTEXT.md`
> - `shift-pilot-resa-web/js/app.js` (code source, relu en entier)
> - `shift-pilot-resa-web/index.html` (code source, relu en entier)
> **Tour de relecture** : 2 (corrections du tour 1 intégrées)

---

## Verdict global

**Approuvé.**

Les trois défauts bloquants et les deux problèmes mineurs signalés en tour 1 ont tous été corrigés de façon satisfaisante. Le document est factuel, traçable, et respecte la grille ECOSYSTEME (relations entre workspaces sans redécrire l'interne).

---

## Vérification des corrections demandées au tour 1

### B1 — Invention « cela semble fonctionnel en déploiement local »

**Correction effectuée** : la phrase a été remplacée par « la divergence est effective dès maintenant : le front lit `t.availableSeats` qui n'existe pas dans la réponse API, et affiche `undefined` pour le nombre de places. »  
**Verdict** : ✓ Conforme — formulation honnête et traçable au code.

### B2 — État testable trompeur (affichait les places côté API comme si elles s'affichaient au front)

**Correction effectuée** : l'état est maintenant qualifié « État retourné par l'API — NB : ces places ne s'affichent pas à l'écran du voyageur en l'état actuel, en raison de la divergence `seatsLeft` / `availableSeats`. »  
**Verdict** : ✓ Conforme — distinction API / affichage front clairement posée.

### B3 — Référence `index.html:5` erronée (ligne 5 = `<title>`, pas `<ul>`)

**Correction effectuée** : remplacé par `index.html:9`.  
**Vérification directe** : ligne 9 de `index.html` est bien `<ul id="transfers-list"></ul>`.  
**Verdict** : ✓ Conforme.

### M1 — Formulation sous-entendant que le mapping seatsLeft / availableSeats fonctionne

**Correction effectuée** : « L'API retourne actuellement `seatsLeft` — le champ attendu n'existe pas. Tout changement de nom supplémentaire aggraverait l'écart existant. »  
**Verdict** : ✓ Conforme — plus aucune ambiguïté sur le statut actuel.

### M2 — Divergence présentée comme incertitude documentaire

**Correction effectuée** : question 1 reformulée en « **DIVERGENCE CONFIRMÉE** » avec question de décision d'harmonisation (quel nom retenir ?).  
**Verdict** : ✓ Conforme — le défaut est traité comme établi, pas comme hypothétique.

---

## Points vérifiés dans cette passe

- **Description des workspaces** (lignes 7-8) : traçable aux PROJECT_CONTEXT de chaque workspace. ✓
- **Format du contrat web** (ligne 14) : tracé à CDC_FONCTIONNEL.md web, section « API distant ». ✓
- **Projection API** (ligne 15) : tracé à server.js:14-20 et CDC_FONCTIONNEL.md API. ✓
- **Référence server.js:14-20** : vérifié — le bloc `map()` construit bien `{ id, from, to, price, seatsLeft }`. ✓
- **Référence app.js:13** : vérifié — accède bien à `t.availableSeats`. ✓
- **Référence index.html:9** : vérifié — `<ul id="transfers-list"></ul>`. ✓
- **Risque CORS** : tracé à PROJECT_CONTEXT.md API, section « Absence de CORS ». ✓
- **Crash URL malformée / server.js:11** : vérifié — `new URL(req.url, ...)` sans try/catch. ✓
- **Données statiques / sold jamais incrémenté** : tracé à CDC_FONCTIONNEL.md et PROJECT_CONTEXT.md API. ✓
- **isFull orpheline** : tracé à PROJECT_CONTEXT.md API, section « isFull orpheline ». ✓
- **API injoignable (gestion d'erreur absente)** : preuve citée (CDC_FONCTIONNEL.md web, « Cas : API injoignable ») correcte. ✓
- **Réponse non-itérable** : tracé à CDC_FONCTIONNEL.md web. ✓
- **Questions ouvertes 2-6** : toutes traçables aux CDC et PROJECT_CONTEXT des deux workspaces. ✓
- **Tableau de résumé de confiance** : calibrage cohérent avec la matière amont. ✓
- **Identité des deux fichiers** : diff entre `shift-pilot-resa-api/documents/ECOSYSTEME.md` et `shift-pilot-resa-web/documents/ECOSYSTEME.md` = 0 différence. ✓

---

## Observation résiduelle non-bloquante

`js/app.js:4` est cité pour le fallback `http://localhost:3100` (section « Intégrations et déploiement »), mais le fallback apparaît sur la ligne 3 du fichier (ligne 4 = ligne vide). Le code reste parfaitement identifiable — ce n'est pas un bloquant, et ne justifie pas un nouveau cycle.

---

## Conclusion

Document approuvé pour publication. Toutes les corrections demandées ont été appliquées correctement. Le document remplit son rôle de synthèse transverse sans invention, sans redescription de l'interne des workspaces, et avec une hiérarchie de confiance honnête.
