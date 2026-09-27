# Inventario de ramas del piloto

Corte: 2026-09-27. Base origin/main 58d1dd367fe7411ff5de1411b1dc17e6c845b665.
129 ramas locales; 73 worktrees. PR abierto #1 feature/landing-page conservado.
No se borran ramas remotas ni carpetas. Worktree asociado implica conservar;
uso activo no determinado, por lo que ninguno se archiva. Cambios son conteo
porcelain observado durante el inventario, no auditoria del contenido.
Ramas no ancestras quedan por revisar, incluso si hubo squash. No se fuerza borrado.
La rama mensual se conserva expresamente junto con el borrador sin seguimiento.

## Registro previo de candidatas a eliminar

Solo refs locales, ancestras de main, sin worktree ni PR abierto. Se revalidan
antes de git branch -d; un rechazo se conserva. SHA permite identificar el trabajo.

| Rama | SHA |
| --- | --- |
| analysis/clinical-system-blueprint-20260822 | 34c3bb27fca96d693b6e6755c73214da13da4c1a |
| analysis/stellar-testnet-pilot-integration-20260822 | d27b90d4b6916cfb8d28307ea6710e2400f910f5 |
| analysis/supabase-clinical-platform-readiness-20260826 | fef5f90f00f1ec70c19bfb3c78d17b2da79d11f6 |
| audit/medical-flow-capabilities-20260821 | aa1bf7b2c49784771aa49ef9845e8193e3f17cc8 |
| docs/onboarding-release-evidence | 43581f71d41dcd747228278a6b1d7668155e945b |
| docs/workspace-master-plan | 555aeaf551d1b3f39b1f4d3629d12aa0cf06adab |
| feat/cross-tab-session-sync | ed8fadc2986a527fa732ac9adf3b5fcfaa35a2e1 |
| feat/google-calendar-connection | 20796f6229ba4fdd08e9cff7af5c8e919331045a |
| feat/operations-pilot-release | a758b121b6ab160dc54249980d40453d8ad1ad6f |
| feat/privy-persistent-agenda | 01649bcdd89e66f7edef0ada6b3036b10265fdc6 |
| feature/supabase-auth-rbac-local-20260826 | fef5f90f00f1ec70c19bfb3c78d17b2da79d11f6 |
| feature/trustleaf-key-preflight-20260827 | 5b4c746b164bd79baa24f5d8ca893b78855df2cf |
| fix/admin-permission-label | 17f9fd9db7631df3c3642fa07c0ae4a0c9ea7e27 |
| fix/admin-session-loading | e41dc31e9ceb420543529ca75389547dc4a6350b |
| fix/calendar-operations-session | 3669c15b9fb442923ba0bc2fd40ff66cd7f95f18 |
| fix/dispensary-availability-states | faae503d77a8b220e17c12b27ba327689573be1d |
| fix/operations-recovery | 0d4bbe091352a2a088a5dd6f1e448fe1f99dddc8 |
| fix/pilot-business-conflicts | 80ce7200f731c3b745f783f8901c60feff74bcde |
| fix/professional-panel-status | b07602cf85d4d411f46ffa3a5230ee2ff9297d55 |
| fix/qr-admin-visual-qa-20260822 | 0b6405b192aedf347a966b0c07f079f7834e4a89 |
| fix/restore-safe-3d-landing-20260828 | 6412c423db79b54d24b4035f271edf47ffe0a16b |
| integrate/origin-main-preflight-20260813 | a9c0a0c8131ecc1446834243148913fb1e3936a3 |
| integration/qr-public-verifier-demo-20260822 | 940deb82c12c458de9b66b16a3a7c35e32f1ac50 |
| integration/stellar-receipt-pilot-sprint-20260822 | 49e73e1ec35e0c2854412e862b9202448da09215 |
| mvp-dispensary-operator-flow | b7413ddd0d3958e0b9a49d4474c2d47f75288da6 |
| mvp-testnet-patient-dispensary-flow | c15ade3096b1bf679b72b5532a27bf7ff7f191f0 |
| preview/synthetic-gate-20260827 | 1f1ebb66c41c1e2374e8674fc871a656c562fa5b |
| reactivate/pilot-chile-integration-20260813 | d1cabd55beb23d7e34f89cd4cf0a84d9d7fcf439 |
| release-hardening/synthetic-public-20260827 | 7bbcafb1f015f08d0352b4ce51ebd6adf6b7c094 |
| test/operations-workflow-validation | c7550635aea1f2c574c1646acda40c40ee320bcf |
| test/synthetic-actor-validation | da41d6022d6ba687d590244f3ba32fa16d32370b |

## Clasificacion completa antes de limpiar

| Rama | SHA | Estado | Worktree | Cambios |
| --- | --- | --- | --- | --- |
| analysis/chile-p0-technical-readiness-20260826 | 60fb01888e73997e73ad1f179725708973f2ba15 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-chile-p0-readiness | 0 |
| analysis/chile-real-pilot-regulatory-gate-20260825 | bef6369425c6dc41299e3d6f3c2a5af6e2a26901 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-chile-regulatory-gate | 0 |
| analysis/clinical-system-blueprint-20260822 | 34c3bb27fca96d693b6e6755c73214da13da4c1a | Integrada | Sin worktree | 0 |
| analysis/firestore-permissions-audit-20260822 | 93eb87fdaa2d0871d4c2f5decfa569b1fba17f22 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-analysis-firestore | 0 |
| analysis/key-ceremony-threat-model-20260825 | 92e0e79bbc8b3dc825d861ecb9821b3cfceaa6e4 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-key-threat | 0 |
| analysis/qr-public-verification-model-20260822 | d27b90d4b6916cfb8d28307ea6710e2400f910f5 | Integrada | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-analysis-qr-public | 3 |
| analysis/real-pilot-onboarding-evidence-20260826 | 663977a346462d5cae33e1543659bff5a863318f | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-real-pilot-onboarding-evidence | 0 |
| analysis/stellar-contract-architecture-20260822 | 6dd2812ea298676442ac5ef6933204864b9473cc | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-analysis-stellar | 0 |
| analysis/stellar-pilot-ux-20260822 | 90551a3ba5bf22d95f3c3c0e14745016eae3f1fc | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-analysis-ux | 0 |
| analysis/stellar-privacy-threat-20260822 | 2cb6265bf0adcf287d446e348a97ce06ced0e252 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-analysis-threat | 0 |
| analysis/stellar-testnet-pilot-integration-20260822 | d27b90d4b6916cfb8d28307ea6710e2400f910f5 | Integrada | Sin worktree | 0 |
| analysis/supabase-clinical-platform-readiness-20260826 | fef5f90f00f1ec70c19bfb3c78d17b2da79d11f6 | Integrada | Sin worktree | 0 |
| analysis/v2-kms-idp-options-20260825 | dab2cb4527efb331f5a1c7818b7bc2a9cfdfe910 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-v2-kms-idp | 0 |
| audit/medical-flow-capabilities-20260821 | aa1bf7b2c49784771aa49ef9845e8193e3f17cc8 | Integrada | Sin worktree | 0 |
| design/landing-3d-safe-rescue-20260814 | ecdc2594d2f41b4a0c6f2b996dee4c9736b88885 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-landing-rescue | 0 |
| design/landing-clean-rescue-20260813 | 56e7b1ac659c005a8fff4e42b27bf00265bbb804 | Trabajo por revisar | Sin worktree | 0 |
| design/product-map-and-directions | dfb34495560e0e4ce27ab7a208e1858966451e50 | Trabajo por revisar | Sin worktree | 0 |
| docs/browns-demo-readiness | 371af19926f5911d005897defb56419d9e79b649 | Activa | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-main-release | 1 |
| docs/dispensary-closeout-sprint | f6164e604911fc19c86ab295dfccd426b26a8ea6 | Trabajo por revisar | Sin worktree | 0 |
| docs/onboarding-release-evidence | 43581f71d41dcd747228278a6b1d7668155e945b | Integrada | Sin worktree | 0 |
| docs/workspace-master-plan | 555aeaf551d1b3f39b1f4d3629d12aa0cf06adab | Integrada | Sin worktree | 0 |
| feat/actor-workspace-search | 76e27b7c5b0ed8e4b832eebe1646aaa2c34e5c3d | Trabajo por revisar | Sin worktree | 0 |
| feat/admin-current-teams | 9849a950a81cbd5809849873f38b007a839a8835 | Trabajo por revisar | Sin worktree | 0 |
| feat/consultation-agenda-target | a7fdab8075dbd74d9e3676ba8665a5c4cf39ca1e | Trabajo por revisar | Sin worktree | 0 |
| feat/cross-tab-session-sync | ed8fadc2986a527fa732ac9adf3b5fcfaa35a2e1 | Integrada | Sin worktree | 0 |
| feat/dispensary-admin-onboarding | ebf766e0dc3bca4792703e185c15896430e5d753 | Trabajo por revisar | Sin worktree | 0 |
| feat/dispensary-attention-workspace | a73a5aa08f40eff66b5d038d1c1f0aa0d156a518 | Trabajo por revisar | Sin worktree | 0 |
| feat/dispensary-commerce-foundation | db376019d650ffc8e5f58cc405feb1b8d5ef4fc7 | Trabajo por revisar | Sin worktree | 0 |
| feat/dispensary-daily-inventory-history | d43c21e92a1139da309ba6b21387554684f556fa | Trabajo por revisar | Sin worktree | 0 |
| feat/dispensary-daily-onboarding | 2ef418b6a478852ecaa43a26f6c7d53e170136bd | Trabajo por revisar | Sin worktree | 0 |
| feat/dispensary-daily-workspace | 4f389b2cecd5170dbbb78ff0e7cf65c5cec41d70 | Trabajo por revisar | Sin worktree | 0 |
| feat/dispensary-desk-connected | 668d84f41f9f20aebca3b394670e2630755735c8 | Trabajo por revisar | Sin worktree | 0 |
| feat/dispensary-visual-preview | 58b283937a93d0719aeca49d8f329d5e72971109 | Trabajo por revisar | Sin worktree | 0 |
| feat/doctor-consultation-filters | 9ab17426c19106da198b1f3a0583392267b2ec3c | Trabajo por revisar | Sin worktree | 0 |
| feat/google-calendar-connection | 20796f6229ba4fdd08e9cff7af5c8e919331045a | Integrada | Sin worktree | 0 |
| feat/monthly-dispensing-quota | 01649bcdd89e66f7edef0ada6b3036b10265fdc6 | Integrada | Sin worktree | 0 |
| feat/operations-pilot-release | a758b121b6ab160dc54249980d40453d8ad1ad6f | Integrada | Sin worktree | 0 |
| feat/operator-email-invitations | 5fcfa4a19a762efcd09414f38f68a4116c1798d7 | Trabajo por revisar | Sin worktree | 0 |
| feat/privy-persistent-agenda | 01649bcdd89e66f7edef0ada6b3036b10265fdc6 | Integrada | Sin worktree | 0 |
| feat/qr-public-verifier-mock-20260822 | d27b90d4b6916cfb8d28307ea6710e2400f910f5 | Integrada | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-qr-public-mock | 0 |
| feat/receipt-contract-v1-local-20260822 | a6d542602d06bf334c2030802afaa019b439defe | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-receipt-contract | 0 |
| feat/receipt-ledger-port-backend-20260822 | 452235b411fdefa9d4abdb6f81a820f7f98a4329 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-receipt-backend | 0 |
| feat/receipt-pilot-ui-flow-20260822 | ef089a3b2bb75d4207891712da81bd5d29304c04 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-receipt-ui | 0 |
| feat/session-consistency | 8848de539c4b1e8d3c08d931f0f6d02ace450c73 | Trabajo por revisar | Sin worktree | 0 |
| feat/simulated-receipt-indexer-20260822 | 35a56b4152f47fbc5760bf705192d2b3c38e9d8f | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-sim-indexer | 0 |
| feat/simulated-testnet-adapter-20260822 | a385173c158b1777d70ad33110fff3ac49a76c4e | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-sim-testnet-adapter | 0 |
| feature/durable-availability-booking-20260829 | 21779351bc1ac351c66190ed5121a57ba6e5ee4e | Integrada | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-durable-availability-booking | 0 |
| feature/identity-bootstrap-admin-20260829 | 8ab4c42e451b38b0f54f7b3039d53356c27ffee8 | Integrada | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-identity-bootstrap-admin | 0 |
| feature/operational-flow-ui-20260829 | 9861adb2c435006b32f635760a5d5fca4cbaf7e5 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-operational-flow-ui | 0 |
| feature/operational-vertical-slice-20260829 | 20391178bea09a2e96b1986a4b3fd04ef6d488d5 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-operational-vertical-slice | 0 |
| feature/privy-supabase-auth-20260829 | fc5e0f8807d60c29a615ae4399c8e6fc44c74fb4 | Integrada | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-privy-supabase-auth | 0 |
| feature/supabase-auth-rbac-local-20260826 | fef5f90f00f1ec70c19bfb3c78d17b2da79d11f6 | Integrada | Sin worktree | 0 |
| feature/synthetic-prescription-lifecycle-20260813 | 885aa6f0c98052dd97aefca738a7b3821aebb9bd | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-lifecycle | 0 |
| feature/trust-registry-local-20260824 | fedce0b89550a5addca493c59e86020b26db5792 | Integrada | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-trust-registry | 0 |
| feature/trustleaf-key-preflight-20260827 | 5b4c746b164bd79baa24f5d8ca893b78855df2cf | Integrada | Sin worktree | 0 |
| feature/visual-e2e-pilot-flow-20260825 | ce91b01fb6b993459a2af345b3a98e2c52ed33c0 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-visual-e2e-pilot-flow | 0 |
| fix/actor-demo-links-20260828 | cd639b238b376e6abe890019d840696042636e20 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-supabase-readiness | 24 |
| fix/admin-permission-label | 17f9fd9db7631df3c3642fa07c0ae4a0c9ea7e27 | Integrada | Sin worktree | 0 |
| fix/admin-session-loading | e41dc31e9ceb420543529ca75389547dc4a6350b | Integrada | Sin worktree | 0 |
| fix/calendar-operations-session | 3669c15b9fb442923ba0bc2fd40ff66cd7f95f18 | Integrada | Sin worktree | 0 |
| fix/cancelled-agenda-color | 8ac5a2532c7af0daad95315e7e0d7ee48cb32ac4 | Trabajo por revisar | Sin worktree | 0 |
| fix/cancelled-agenda-history | 82999f976d4cae9c85f4fd555738caab02428ad2 | Trabajo por revisar | Sin worktree | 0 |
| fix/dispensary-availability-states | faae503d77a8b220e17c12b27ba327689573be1d | Integrada | Sin worktree | 0 |
| fix/dispensary-lifecycle-history | 25a9b0d9d7aff03beed062228277c6563b80f1e4 | Trabajo por revisar | Sin worktree | 0 |
| fix/operations-recovery | 0d4bbe091352a2a088a5dd6f1e448fe1f99dddc8 | Integrada | Sin worktree | 0 |
| fix/patient-delivery-receipts | 672a094a739a515a6c84da39df89e5fcf194025d | Trabajo por revisar | Sin worktree | 0 |
| fix/pilot-business-conflicts | 80ce7200f731c3b745f783f8901c60feff74bcde | Integrada | Sin worktree | 0 |
| fix/professional-panel-status | b07602cf85d4d411f46ffa3a5230ee2ff9297d55 | Integrada | Sin worktree | 0 |
| fix/qr-admin-visual-qa-20260822 | 0b6405b192aedf347a966b0c07f079f7834e4a89 | Integrada | Sin worktree | 0 |
| fix/receipt-backend-auth-bounds-20260822 | f1b1da1e9c488bccf285529cc5dc87dcc3dcb91d | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-receipt-auth-fix | 0 |
| fix/receipt-operation-domain-auth-20260822 | af9a3cff037cf58a2e27b2f62ed5fb5b3007b13d | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-receipt-operation-auth | 0 |
| fix/receipt-per-object-authorization-20260822 | 46d457de0d2c2d5b0fb0d2962e81f8bc5f1be177 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-receipt-object-auth | 0 |
| fix/receipt-ui-shared-state-20260822 | e7fa460b55b2669a6e6dc9d9c1e165a08dfcc35f | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-receipt-shared | 0 |
| fix/restore-safe-3d-landing-20260828 | 6412c423db79b54d24b4035f271edf47ffe0a16b | Integrada | Sin worktree | 0 |
| fix/sim-adapter-unknown-no-resubmit-20260822 | af82ae85c138792167c7c135acb500d5211dae7e | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-sim-adapter-fix | 0 |
| fix/sim-indexer-atomic-ingest-20260822 | 7368bb1793e0fb7784f8510df7ba46eb5014f63f | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-fix-indexer-atomic | 0 |
| fix/sim-indexer-identity-conflicts-20260822 | ee79d3b9925c1db0a4eccd246c2cfbbb1cb1c674 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-fix-indexer-identity | 0 |
| fix/team-webhook-empty-response | 90637597365e5b5d262d7dd499c44b00ab325a07 | Trabajo por revisar | Sin worktree | 0 |
| fix/worker-without-team | 0eac84bf994797c8d99ef252a8c54b17b0dfe57e | Trabajo por revisar | Sin worktree | 0 |
| integrate/origin-main-preflight-20260813 | a9c0a0c8131ecc1446834243148913fb1e3936a3 | Integrada | Sin worktree | 0 |
| integration/functional-flow-candidate-20260824 | f7374d10af82de3f7bf7b52e7b205f29c85430e1 | Integrada | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-functional-flow-integration | 0 |
| integration/human-ui-candidate-20260824 | b65fd2439a6c43896d356f1501ccb78b3dbb230f | Integrada | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-human-ui-candidate | 0 |
| integration/key-custody-prep-20260825 | 9e034cf87fbfa06948c677d48d114045e56e5c3e | Integrada | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-key-custody-integration | 0 |
| integration/onchain-testnet-readiness-20260822 | 3a7e6364e5a9acd197056c854ea94c1799f95c36 | Integrada | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-onchain-integration | 0 |
| integration/post-smoke-readonly-20260822 | a8f3f90b090b9b8bf99664ef0ba41bb049f0f601 | Integrada | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-post-smoke-integration | 0 |
| integration/qr-public-verifier-demo-20260822 | 940deb82c12c458de9b66b16a3a7c35e32f1ac50 | Integrada | Sin worktree | 0 |
| integration/simulated-testnet-gate-20260822 | a7767b3b448ee5981e2a002fc0bcf38facc42f97 | Integrada | D:/00 CODEX - OPENIA/projects/trust-leaf/product-app | 0 |
| integration/stellar-receipt-pilot-sprint-20260822 | 49e73e1ec35e0c2854412e862b9202448da09215 | Integrada | Sin worktree | 0 |
| integration/testnet-v2-predeploy-gate-20260825 | 9e704f5121607776e983601aaecf1bc84ed3b1f9 | Integrada | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-v2-predeploy-integration | 0 |
| integration/testnet-v2-readonly-durable-20260825 | 453b7571de0fe19c49d7da5f949a6c8ef0a226d6 | Integrada | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-v2-readonly-durable | 0 |
| main | 45b4e339edb8c6220f19c924955cc1c919ab08e3 | Integrada | Sin worktree | 0 |
| mvp-dispensary-operator-flow | b7413ddd0d3958e0b9a49d4474c2d47f75288da6 | Integrada | Sin worktree | 0 |
| mvp-testnet-patient-dispensary-flow | c15ade3096b1bf679b72b5532a27bf7ff7f191f0 | Integrada | Sin worktree | 0 |
| phase1/legacy-auth-rbac-20260822 | d385b3dac6d3b9c5c34ba3d67e712b1e889c1776 | Integrada | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-phase1-legacy-auth | 0 |
| phase2/object-authorization-20260822 | 12f88bf2f80b2993c13847fe42c4eb74e59fdc8d | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-phase2-object-auth | 0 |
| preview/synthetic-gate-20260827 | 1f1ebb66c41c1e2374e8674fc871a656c562fa5b | Integrada | Sin worktree | 0 |
| reactivate/pilot-chile-integration-20260813 | d1cabd55beb23d7e34f89cd4cf0a84d9d7fcf439 | Integrada | Sin worktree | 0 |
| release-hardening/synthetic-public-20260827 | 7bbcafb1f015f08d0352b4ce51ebd6adf6b7c094 | Integrada | Sin worktree | 0 |
| release/final-readiness-20260813 | 5b992b384992721ccc7a193f1b89777707f4accd | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-integration | 0 |
| review/pr-1 | b242154d036131bf148f0dd4a66afdaae49bba9f | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-pr-1-review | 0 |
| sprint/auth-admin-minimal-20260822 | 438dddeaedfe9ee5c4cafb8e93fb04c1b361d223 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-auth-admin-minimal | 0 |
| sprint/durable-data-kms-observability-20260822 | 84860a5467dffc428f677c3ae41c386161576b17 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-durable-data-kms-observability | 0 |
| sprint/durable-receipt-mapping-20260824 | 439b64c064480833157a13739eed153835ef45fb | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-durable-receipt-mapping | 0 |
| sprint/existing-v1-durable-reader-20260825 | 7b7e92f1efffa2dffacce7676df99c0bf11406c2 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-v1-durable-reader | 0 |
| sprint/kms-hsm-mock-20260825 | 5934780507b1860ee4c38dde448417d7d7e78c5f | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-kms-mock | 0 |
| sprint/onchain-auth-kms-20260822 | f5d1e03d26dce117e4974e743ed33e6f80da0d90 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-onchain-auth-kms | 0 |
| sprint/onchain-contract-20260822 | 00c574ac66e71af44cf8ca3fb1869946e2344c93 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-onchain-contract | 1 |
| sprint/onchain-rpc-indexer-20260822 | 7b2b6a1b2bf186c664c3f744647dcda936880e5a | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-onchain-rpc-indexer | 0 |
| sprint/readonly-indexer-role-e2e-20260824 | be770c0aa3914a75ea89e6b2bc75fa9aab67e15d | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-readonly-indexer-role-e2e | 0 |
| sprint/readonly-ui-qr-20260822 | 32de4736dbc3a2aef0b6169df227a5b5eb28f0ba | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-readonly-ui-qr | 0 |
| sprint/testnet-e2e-data-qa-20260822 | 069a23017fb69cdc42ce5540938af8161c0ee35a | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-testnet-e2e-data-qa | 0 |
| sprint/testnet-live-adapter-20260822 | 224b56f6b767ca8c280ca0c0785fe227c46dc6a3 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-testnet-live-adapter | 0 |
| sprint/testnet-v2-manifest-20260825 | a5e8371d1303b38c91fd53dd167493bd9d086dfc | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-v2-manifest | 0 |
| sprint/testnet-v2-smoke-20260825 | 6b0097017f264e625472abccb5759a6aa1ea22b7 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-v2-smoke | 0 |
| sprint/ui-onchain-review-20260824 | d79be0238e797789e9c6b8ea6d0db4cf05dbdd25 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-ui-onchain-review | 0 |
| sprint/v2-readonly-ui-e2e-20260825 | 51e5415227ffbe094b3a690f661202a6f65b54f7 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-v2-ui-e2e | 0 |
| sprint/v2-rpc-indexer-readonly-20260825 | 3a71e5f27f4c8590741aef08fa3127be6b6e6469 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-v2-rpc-indexer | 0 |
| staging/trust-leaf-mvp | 298220b6726a5fdcfcdfdef186702114da1d9258 | Integrada | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-staging-trust-leaf-mvp | 0 |
| swarm/auth-rbac-20260813 | c1a1d5c44fefbbe014f9429d663afb7cee1a82dd | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-auth | 0 |
| swarm/landing-browser-20260813 | dd2b5e34fa79b145c153a908c96faba7e41ff8ff | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-landing | 0 |
| swarm/quality-preflight-20260813 | 0fa6dad0bae25542c4b8c956266b577c8e92f018 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-quality | 0 |
| swarm/security-compliance-20260813 | 3fb7c90841dad43ea60185fed0173203250578a9 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-security | 0 |
| test/key-custody-preflight-20260825 | cb35cc7fbb4810f8ab479ed9ce50beb6dc9b259e | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-key-qa | 0 |
| test/operations-workflow-validation | c7550635aea1f2c574c1646acda40c40ee320bcf | Integrada | Sin worktree | 0 |
| test/post-smoke-readonly-e2e-20260822 | fa5f6c798f6da6ac859cff28834dcef7ffc68bee | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-post-smoke-qa | 0 |
| test/qr-public-verifier-privacy-20260822 | d27b90d4b6916cfb8d28307ea6710e2400f910f5 | Integrada | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-qr-privacy-qa | 0 |
| test/synthetic-actor-validation | da41d6022d6ba687d590244f3ba32fa16d32370b | Integrada | Sin worktree | 0 |
| test/testnet-v2-ceremony-qa-20260825 | 3e45a38ba6dabf27f0d622ab831747441762cbbf | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-v2-qa | 0 |
| test/visual-readonly-qa-20260824 | 1f403b82b1c47e9413ac25e52da64b229dcff6c4 | Trabajo por revisar | D:/00 CODEX - OPENIA/projects/trust-leaf/wt-visual-readonly-qa | 0 |

## Propuesta posterior, no ejecutada

Revisar PR #1 con su propietario antes de decidir continuidad o cierre. Comparar
ramas remotas y ramas squash por contenido, no por nombre. Comprobar procesos,
cambios ignorados y responsable antes de proponer archivo recuperable de worktrees.
No integrar modulos historicos por antiguedad. Mantener una entrega funcional
por rama/PR, con checks y revision antes de main.

