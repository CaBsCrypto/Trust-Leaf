# DEM-LEG-01: retired private projections

## Scope and baseline

04/10/2026. Baseline main `3243904`; isolated branch
`fix/legacy-ui-read-safety`. The Privy/Supabase pilot, public verifiers,
server 410/405 boundaries, APIs and migrations are unchanged.

The regression executes actual component initializers/handlers selected by the
TypeScript AST, with synthetic dependencies and no network. Before the correction,
eight failed reads became positive synthetic validations, malformed dashboard
cache threw, and private fetch/cache use remained: 0/10 PASS, 10 expected failures.
This does not establish a production disclosure or successful business write.

## Correction

- No invocation of either permanently retired private read.
- No dashboard hydration/persistence from the global legacy cache. Remove old
  dashboard, prescription-present and allowance keys without parsing private data.
- Withdraw dashboard, validation, allowance, cached pickups/permissions, selected
  prescriptions/traces, QR selection, cart and success state
  before paint when session, identity or address context changes.
- Storage deletion failures cannot skip the in-memory withdrawal.
- No synthetic validation on entry, failure or completion of a demo consultation.
- Explicit unavailable notice. Missing validation blocks the dispense handler
  before provider or local mutation; corresponding submit controls are disabled.
- Zero/unknown allowance no longer becomes the default synthetic 30 g.
- The alternate pickup-token action no longer declares success on timers.
- Legacy preview preparation cannot automatically create dispensary permission.
- Late wallet derivation cannot replace the next session's derived address.
- Late legacy mutation responses cannot repopulate the retired dashboard.
- Late permission responses cannot reopen the previous context's QR. Manual
  dispensary permission actions report unavailability instead of creating one.
- The reachable legacy confirmation labels its identifier as not validated.

Explicit legacy presentation helpers remain separate from supported operations;
they are not evidence of eligibility, real treatment or clinical authorization.
The next full-cycle demo will use the supported product components and ephemeral
SQL, not these legacy narrative helpers.

## Validation

`npm run test:legacy-ui-read-safety`: 20/20 PASS after correction. Tests cover
retired validation, malformed/foreign cache, context cleanup, missing validation
and absence of positive validation setters. Additional negative reproductions
confirmed the pickup timer and the nested Promise.all permission call; both are
now guarded by permanent regressions. Zero-denominator progress and late dashboard
writers were found and corrected during this delivery. The patient review produced
three additional failing regressions for stale permission responses, synthetic
manual permission creation and misleading validity text; these now pass.
Candidate CI/preview and release correspondence remain gates until
their results are recorded below. Phone hardware/human autonomy are not covered
by viewport simulation.

Latest product types and build PASS locally. Security, patient and dispensary
independent source reviews found no further blocker within this scope. These reviews do not
certify unrelated Firebase mutations or all legacy clinical caches.

## Browser evidence

The actual MockupPortal, drawers, wallet onboarding and PrivyAgenda are mounted
with provider boundaries replaced, not component hooks or forced clicks.
Baseline `3243904`: 20/20 expected negative cases, exit 1, no setup failure.
Final source: 28/28 PASS, SHA-256
`1a2c0251201025949b435f39377e24d4297217929b0e5107f6e851e16f70e740`;
the source remained identical through the run. Patient/dispensary at
360/390/768/1024/1440, malformed and foreign caches, context transitions,
doctor previews, wallet-address transitions and the real synthetic PrivyAgenda.

[Report](report.json): no external, unexpected API, Node network or business
mutation attempts; no retired private requests or private cache writes. Browser,
contexts and loopback server closed successfully. Types/build and the existing
retired-route, pilot, agenda, public verification and SQL regressions pass locally.
Independent PostgreSQL concurrency remains a separate CI gate, not a PGlite claim.

Screenshots: [patient mobile](patient-390.png), [patient desktop](patient-1440.png),
[dispensary mobile](dispensary-390.png), [dispensary desktop](dispensary-1440.png).
They capture synthetic legacy views, not authenticated production or a redesigned
supported dispensary. Critical notice/drawer geometry is covered; remaining legacy
presentation text and full-panel layout are outside this scoped correction.

No credentials, real addresses, authenticated screenshots or production business
writes are evidence for this correction. B, Browns and the monthly draft remain
untouched. This delivery does not approve PR62's privacy draft or external invites.

## Release: 04/10/2026

[PR67](https://github.com/CaBsCrypto/Trust-Leaf/pull/67) merged only after
independent review, [candidate CI37238853970](https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/37238853970)
PASS and preview dpl_FWwZh7vRLrD22jgBTnhPNhA4vNQP Ready for `2b5f460`.
Main `5416e162381d73ea3f3557378672a1036096e824` has its own
[CI37239605057](https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/37239605057) PASS.
GitHub production deployment6847562853 success associates that SHA with
trustleaf-f4uyep4wh-cabscryptocontacto-6028s-projects.vercel.app;
Vercel dpl_5qW6ANyox6FhZ8XxiAd4U36f6NUx Ready and official aliases were inspected.
Anonymous official reads of both retired routes returned410/no-store/private
using synthetic identifiers, with no business writes.

The preview exposed an earlier missing-provider-configuration error, reproduced
independently and fixed first by [PR68](https://github.com/CaBsCrypto/Trust-Leaf/pull/68).
Its [separate evidence](../private-preview-config-errors/README.md) records the
lazy verifier boundary, twelve actual-export cases, review and release. No
configuration or credential was copied to make the preview pass.
