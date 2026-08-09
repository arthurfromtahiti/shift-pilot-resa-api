# INDEX — Artefacts Onboarding shift-pilot-resa-api

> Généré automatiquement à la publication — ne pas modifier manuellement.

| type | domaine | workflow | dépôt | fichier | date | version SHA | niveau de preuve | titre |
|---|---|---|---|---|---|---|---|---|
| domaine | catalogue-transferts, disponibilite-reservation, exposition-http-api, qualite-tests | | shift-pilot-resa-api | domaines/CARTE_DES_DOMAINES.md | 2026-08-09 | TBD | établi | Carte des domaines fonctionnels et techniques du service de réservation de transferts |
| workflow | catalogue-transferts | CONSULTATION_CATALOGUE | shift-pilot-resa-api | workflows/WORKFLOW_CONSULTATION_CATALOGUE.md | 2026-08-09 | TBD | contient une hypothèse | Flux de consultation du catalogue de transferts inter-îles (GET /transfers) |
| workflow | disponibilite-reservation | RESERVATION_SIEGE | shift-pilot-resa-api | workflows/WORKFLOW_RESERVATION_SIEGE.md | 2026-08-09 | TBD | contient une hypothèse | Flux de réservation de sièges sur un transfert (POST /transfers/:id/reserve) |
| workflow | disponibilite-reservation | ANNULATION_SIEGE | shift-pilot-resa-api | workflows/WORKFLOW_ANNULATION_SIEGE.md | 2026-08-09 | TBD | contient une hypothèse | Flux d'annulation de réservation de siège (DELETE /transfers/:id/reservations/:reservationId) |
| audit | catalogue-transferts, disponibilite-reservation, exposition-http-api, qualite-tests | | shift-pilot-resa-api | audits/ARCHITECTURE_AUDIT.md | 2026-08-09 | TBD | contient une hypothèse | Audit d'architecture — structure, découplage et maintenabilité de l'API |
| audit | exposition-http-api, disponibilite-reservation | | shift-pilot-resa-api | audits/SECURITY_ROBUSTNESS_AUDIT.md | 2026-08-09 | TBD | contient une hypothèse | Audit sécurité et robustesse — vecteurs d'attaque, validations et gestion des erreurs |
| audit | catalogue-transferts, disponibilite-reservation | | shift-pilot-resa-api | audits/DATA_MODEL_AUDIT.md | 2026-08-09 | TBD | établi | Audit du modèle de données — entités, champs et cohérence de l'état en mémoire |
| audit | disponibilite-reservation, exposition-http-api | | shift-pilot-resa-api | audits/CODE_HOTSPOTS_AUDIT.md | 2026-08-09 | TBD | contient une hypothèse | Audit des points chauds du code — complexité, fragilité et risques de maintenance |
| audit | qualite-tests | | shift-pilot-resa-api | audits/TESTING_AUDIT.md | 2026-08-09 | TBD | contient une hypothèse | Audit de la couverture de tests — scénarios couverts et lacunes identifiées |
| audit | catalogue-transferts, disponibilite-reservation | | shift-pilot-resa-api | audits/FUNCTIONAL_AUDIT.md | 2026-08-09 | TBD | contient une hypothèse | Audit fonctionnel — comportement observé vs comportement attendu |
| document | | | shift-pilot-resa-api | documents/CARTOGRAPHIE_CODE.md | 2026-08-09 | TBD | établi | Cartographie du code — arborescence, logique métier et implémentation détaillée |
| document | | | shift-pilot-resa-api | documents/ECOSYSTEME.md | 2026-08-09 | TBD | contient une hypothèse | Synthèse transverse de l'écosystème projet (shift-pilot-resa-api + shift-pilot-resa-web) |
| document | catalogue-transferts, disponibilite-reservation, exposition-http-api | | shift-pilot-resa-api | documents/CDC_FONCTIONNEL.md | 2026-08-09 | TBD | établi | Cahier des charges fonctionnel — capacités, acteurs et règles métier du service |
| document | | | shift-pilot-resa-api | documents/PROJECT_CONTEXT.md | 2026-08-09 | TBD | établi | Contexte et périmètre du projet — pilote de démonstration SHIFT/Paperclip |
| document | catalogue-transferts, qualite-tests | | shift-pilot-resa-api | documents/CAHIER_RECETTE.md | 2026-08-09 | TBD | établi | Plan de test et critères d'acceptation |
| journal-fabrication | catalogue-transferts, disponibilite-reservation, exposition-http-api, qualite-tests | | shift-pilot-resa-api | relectures/RELECTURE_CARTE_DES_DOMAINES.md | 2026-08-09 | TBD | établi | Verdict de relecture — CARTE_DES_DOMAINES.md |
| journal-fabrication | catalogue-transferts | CONSULTATION_CATALOGUE | shift-pilot-resa-api | relectures/RELECTURE_WORKFLOW_CONSULTATION_CATALOGUE.md | 2026-08-09 | TBD | établi | Verdict de relecture — WORKFLOW_CONSULTATION_CATALOGUE.md |
| journal-fabrication | disponibilite-reservation | RESERVATION_SIEGE | shift-pilot-resa-api | relectures/RELECTURE_WORKFLOW_RESERVATION_SIEGE.md | 2026-08-09 | TBD | établi | Verdict de relecture — WORKFLOW_RESERVATION_SIEGE.md |
| journal-fabrication | disponibilite-reservation | ANNULATION_SIEGE | shift-pilot-resa-api | relectures/RELECTURE_WORKFLOW_ANNULATION_SIEGE.md | 2026-08-09 | TBD | établi | Verdict de relecture — WORKFLOW_ANNULATION_SIEGE.md |
| journal-fabrication | catalogue-transferts, disponibilite-reservation, exposition-http-api, qualite-tests | | shift-pilot-resa-api | relectures/RELECTURE_ARCHITECTURE_AUDIT.md | 2026-08-09 | TBD | établi | Verdict de relecture — ARCHITECTURE_AUDIT.md |
| journal-fabrication | exposition-http-api, disponibilite-reservation | | shift-pilot-resa-api | relectures/RELECTURE_SECURITY_ROBUSTNESS_AUDIT.md | 2026-08-09 | TBD | établi | Verdict de relecture — SECURITY_ROBUSTNESS_AUDIT.md |
| journal-fabrication | catalogue-transferts, disponibilite-reservation | | shift-pilot-resa-api | relectures/RELECTURE_DATA_MODEL_AUDIT.md | 2026-08-09 | TBD | établi | Verdict de relecture — DATA_MODEL_AUDIT.md |
| journal-fabrication | disponibilite-reservation, exposition-http-api | | shift-pilot-resa-api | relectures/RELECTURE_CODE_HOTSPOTS_AUDIT.md | 2026-08-09 | TBD | établi | Verdict de relecture — CODE_HOTSPOTS_AUDIT.md |
| journal-fabrication | qualite-tests | | shift-pilot-resa-api | relectures/RELECTURE_TESTING_AUDIT.md | 2026-08-09 | TBD | établi | Verdict de relecture — TESTING_AUDIT.md |
| journal-fabrication | catalogue-transferts, disponibilite-reservation | | shift-pilot-resa-api | relectures/RELECTURE_FUNCTIONAL_AUDIT.md | 2026-08-09 | TBD | établi | Verdict de relecture — FUNCTIONAL_AUDIT.md |
| journal-fabrication | | | shift-pilot-resa-api | relectures/RELECTURE_DOCUMENTS_ETAPE4.md | 2026-08-09 | TBD | établi | Verdict de relecture — ensemble des documents de l'étape 4 (réserve ouverte : M1) |
| journal-fabrication | | | shift-pilot-resa-api | relectures/RELECTURE_CARTOGRAPHIE_CODE.md | 2026-08-05 | d869b94cff4acbb62895f11c469af6a0dcdeb9a3 | établi | Verdict de relecture — CARTOGRAPHIE_CODE.md |
| journal-fabrication | catalogue-transferts, disponibilite-reservation, exposition-http-api | | shift-pilot-resa-api | relectures/RELECTURE_CDC_FONCTIONNEL.md | 2026-08-05 | d869b94cff4acbb62895f11c469af6a0dcdeb9a3 | établi | Verdict de relecture — CDC_FONCTIONNEL.md |
| journal-fabrication | | | shift-pilot-resa-api | relectures/RELECTURE_PROJECT_CONTEXT.md | 2026-08-05 | d869b94cff4acbb62895f11c469af6a0dcdeb9a3 | établi | Verdict de relecture — PROJECT_CONTEXT.md |
| journal-fabrication | catalogue-transferts, qualite-tests | | shift-pilot-resa-api | relectures/RELECTURE_CAHIER_RECETTE.md | 2026-08-05 | d869b94cff4acbb62895f11c469af6a0dcdeb9a3 | établi | Verdict de relecture — CAHIER_RECETTE.md |
| journal-fabrication | | | shift-pilot-resa-api | relectures/RELECTURE_ECOSYSTEME.md | 2026-08-06 | 945fda856d402d6459fef6cb720b17d06495a192 | établi | Verdict de relecture — ECOSYSTEME.md |
