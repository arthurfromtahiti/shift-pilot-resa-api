# INDEX — shift-pilot-resa-api

Porte d'entrée des artefacts d'onboarding produits et validés pour le dépôt `shift-pilot-resa-api`.

| type | domaine | workflow | dépôt | fichier | date | niveau de preuve | titre |
|---|---|---|---|---|---|---|---|
| domaine | catalogue-transferts, disponibilite-places, exposition-http-api, qualite-tests | | shift-pilot-resa-api | domaines/CARTE_DES_DOMAINES.md | 2026-08-05 | établi | Carte des quatre domaines fonctionnels de l'API de transferts inter-îles |
| workflow | disponibilite-places | CALCUL_DISPONIBILITE | shift-pilot-resa-api | workflows/WORKFLOW_CALCUL_DISPONIBILITE.md | 2026-08-05 | établi | Calcul des places restantes et détection de saturation d'un transfert |
| workflow | catalogue-transferts, disponibilite-places | LISTE_TRANSFERTS | shift-pilot-resa-api | workflows/WORKFLOW_LISTE_TRANSFERTS.md | 2026-08-05 | établi | Lister les transferts inter-îles avec disponibilité en temps réel |
| workflow | catalogue-transferts, disponibilite-places | GET_TRANSFERS | shift-pilot-resa-api | workflows/WORKFLOW_GET_TRANSFERS.md | 2026-08-05 | établi | Consultation du catalogue de transferts disponibles |
| workflow | qualite-tests | SUITE_TESTS | shift-pilot-resa-api | workflows/WORKFLOW_SUITE_TESTS.md | 2026-08-05 | établi | Exécution de la suite de tests unitaires |
| audit | catalogue-transferts, disponibilite-places, exposition-http-api, qualite-tests | | shift-pilot-resa-api | audits/ARCHITECTURE_AUDIT.md | 2026-08-05 | établi | Audit de l'architecture générale : structure, séparation des responsabilités, dépendances |
| audit | catalogue-transferts, disponibilite-places, exposition-http-api, qualite-tests | | shift-pilot-resa-api | audits/CODE_HOTSPOTS_AUDIT.md | 2026-08-05 | établi | Identification des zones de code à risque ou à fort couplage |
| audit | catalogue-transferts, disponibilite-places | | shift-pilot-resa-api | audits/DATA_MODEL_AUDIT.md | 2026-08-05 | établi | Audit du modèle de données : structure du catalogue en mémoire et absence de persistance |
| audit | catalogue-transferts, disponibilite-places | | shift-pilot-resa-api | audits/FUNCTIONAL_AUDIT.md | 2026-08-05 | établi | Audit fonctionnel : couverture réelle vs périmètre annoncé (réservation absente) |
| audit | exposition-http-api | | shift-pilot-resa-api | audits/SECURITY_ROBUSTNESS_AUDIT.md | 2026-08-05 | établi | Audit sécurité et robustesse de la couche HTTP (validation, en-têtes, gestion d'erreurs) |
| audit | qualite-tests | | shift-pilot-resa-api | audits/TESTING_AUDIT.md | 2026-08-05 | établi | Audit de la couverture de tests : périmètre actuel et lacunes identifiées |
| document | catalogue-transferts, disponibilite-places, exposition-http-api, qualite-tests | | shift-pilot-resa-api | documents/PROJECT_CONTEXT.md | 2026-08-05 | établi | Contexte projet : périmètre, objectifs, stack technique et positionnement du dépôt |
| document | catalogue-transferts, disponibilite-places, exposition-http-api | | shift-pilot-resa-api | documents/CDC_FONCTIONNEL.md | 2026-08-05 | établi | Cahier des charges fonctionnel : cas d'usage, exigences et contraintes du service |
| document | | | shift-pilot-resa-api | documents/CARTOGRAPHIE_CODE.md | 2026-08-05 | établi | Cartographie du code source : fichiers, rôles et relations entre modules |
| document | catalogue-transferts, disponibilite-places, exposition-http-api, qualite-tests | | shift-pilot-resa-api | documents/CAHIER_RECETTE.md | 2026-08-05 | établi | Cahier de recette : scénarios de validation fonctionnelle et critères d'acceptation |
| document | | | shift-pilot-resa-api, shift-pilot-resa-web | documents/ECOSYSTEME.md | 2026-08-05 | medium | Synthèse transverse des deux workspaces Shift Pilot Resa (api + web) et de leurs interactions |
| journal-fabrication | catalogue-transferts, disponibilite-places, exposition-http-api, qualite-tests | | shift-pilot-resa-api | relectures/RELECTURE_CARTE_DES_DOMAINES.md | 2026-08-05 | établi | Verdict de relecture de la carte des domaines |
| journal-fabrication | disponibilite-places | CALCUL_DISPONIBILITE | shift-pilot-resa-api | relectures/RELECTURE_WORKFLOW_CALCUL_DISPONIBILITE.md | 2026-08-05 | établi | Verdict de relecture du workflow calcul de disponibilité |
| journal-fabrication | catalogue-transferts, disponibilite-places | LISTE_TRANSFERTS | shift-pilot-resa-api | relectures/RELECTURE_WORKFLOW_LISTE_TRANSFERTS.md | 2026-08-05 | établi | Verdict de relecture du workflow liste des transferts |
| journal-fabrication | catalogue-transferts, disponibilite-places | GET_TRANSFERS | shift-pilot-resa-api | relectures/RELECTURE_WORKFLOW_GET_TRANSFERS.md | 2026-08-05 | établi | Verdict de relecture du workflow GET /transfers |
| journal-fabrication | qualite-tests | SUITE_TESTS | shift-pilot-resa-api | relectures/RELECTURE_WORKFLOW_SUITE_TESTS.md | 2026-08-05 | établi | Verdict de relecture du workflow suite de tests |
| journal-fabrication | catalogue-transferts, disponibilite-places, exposition-http-api, qualite-tests | | shift-pilot-resa-api | relectures/RELECTURE_ARCHITECTURE_AUDIT.md | 2026-08-05 | établi | Verdict de relecture de l'audit d'architecture |
| journal-fabrication | catalogue-transferts, disponibilite-places, exposition-http-audit, qualite-tests | | shift-pilot-resa-api | relectures/RELECTURE_CODE_HOTSPOTS_AUDIT.md | 2026-08-05 | établi | Verdict de relecture de l'audit des points chauds du code |
| journal-fabrication | catalogue-transferts, disponibilite-places | | shift-pilot-resa-api | relectures/RELECTURE_DATA_MODEL_AUDIT.md | 2026-08-05 | établi | Verdict de relecture de l'audit du modèle de données |
| journal-fabrication | catalogue-transferts, disponibilite-places | | shift-pilot-resa-api | relectures/RELECTURE_FUNCTIONAL_AUDIT.md | 2026-08-05 | établi | Verdict de relecture de l'audit fonctionnel |
| journal-fabrication | exposition-http-api | | shift-pilot-resa-api | relectures/RELECTURE_SECURITY_ROBUSTNESS_AUDIT.md | 2026-08-05 | établi | Verdict de relecture de l'audit sécurité et robustesse |
| journal-fabrication | qualite-tests | | shift-pilot-resa-api | relectures/RELECTURE_TESTING_AUDIT.md | 2026-08-05 | établi | Verdict de relecture de l'audit de tests |
| journal-fabrication | catalogue-transferts, disponibilite-places, exposition-http-api | | shift-pilot-resa-api | relectures/RELECTURE_CDC_FONCTIONNEL.md | 2026-08-05 | établi | Verdict de relecture du cahier des charges fonctionnel |
| journal-fabrication | | | shift-pilot-resa-api | relectures/RELECTURE_CARTOGRAPHIE_CODE.md | 2026-08-05 | établi | Verdict de relecture de la cartographie du code |
| journal-fabrication | catalogue-transferts, disponibilite-places, exposition-http-api, qualite-tests | | shift-pilot-resa-api | relectures/RELECTURE_PROJECT_CONTEXT.md | 2026-08-05 | établi | Verdict de relecture du contexte projet |
| journal-fabrication | catalogue-transferts, disponibilite-places, exposition-http-api, qualite-tests | | shift-pilot-resa-api | relectures/RELECTURE_CAHIER_RECETTE.md | 2026-08-05 | établi | Verdict de relecture du cahier de recette |
| journal-fabrication | | | shift-pilot-resa-api | relectures/RELECTURE_ECOSYSTEME.md | 2026-08-05 | établi | Verdict de relecture de la synthèse transverse ECOSYSTEME |
