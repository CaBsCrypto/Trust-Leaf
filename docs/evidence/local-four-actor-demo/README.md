# Local four-actor demo: 04/10/2026

Base `5416e162381d73ea3f3557378672a1036096e824`, after PR67 and PR68.
Branch `feat/local-four-actor-demo`. No production product component, API,
migration, role or business record changes. PR62 remains an unpublished draft.

## Implementation and reproduction

[Start and rehearsal](../../../tests/local-demo/README.md). Existing
AdminOnboarding, DispensaryOnboarding, TeamInvitationGate, OperationsWorkspace
and PrivyAgenda run against actual API executors and ephemeral PGlite SQL.
Only Admin/doctor/patient are initially active. Manager and operator complete
their respective real product invitation/application flows in this local DB.

The reviewed migration manifest excludes the monthly draft; no B/Browns fixture
is seeded. Five identities are simulated and clearly labelled, not real Privy
authentication. A local mailbox captures invitations without sending them.
The process uses literal synthetic configuration, no ambient environment files,
and binds to127.0.0.1. Browser/server transports reject external requests.
Bootstrap admission is independent of actor capabilities and outside the bundle.
Reset rotates contexts; failed reset leaves admission closed until restart.
Transport guards are not an OS sandbox claim.

## Technical results

- Node22.20.0; actual Chrome via Playwright. Core SQL/API boundary, invalid
  methods/inputs/host/origin, unknown identity, unapproved actors, idempotent
  invitation/acceptance and reset regressions PASS. Thirteen explicit Node
  outbound/worker attempts are rejected before transport.
- The actual browser guard source passes malformed/pending response-body,
  same-command recovery, stale abort/409, new-context isolation and draft event
  regressions. Headers alone do not release a pending write.
- [Journey report](report.json): fifteen stages PASS, five identities, UI-only
  writes and ten responsive captures. Draft invitation/profile survive unrelated
  reads/grants and cancelled actor changes. Lost receipt/delivery acknowledgements
  require the same operation ID; each retry produces exactly one SQL effect.
- New organization/product/batch,100 g received, one30 g/720h treatment explicitly
  completed,10 g dispensed locally:90 g stock and20 g available. Patient and
  dispensary read the same receipt. A1 g review shows19 g hypothetical without
  another POST or persisted change.
- Encargado and operator at360/390/768/1024/1440 px; no horizontal overflow,
  missing actor control or extra administrative controls. Screenshot coverage
  is manager Inventory and operator History, not every view at every width.
- Zero external, unexpected API, private-header, unexpected HTTP, browser or
  console errors in that journey. Two aborted acknowledgements are deliberate.
  Browser and context closed successfully.
- [Boundary report](boundaries-report.json): cross-tab reset retires the old
  profile, treatment and receipt. A held operational response cannot restore
  them and a held mailbox response cannot reopen its expired dialog. Explicit
  recovery starts fresh Admin; eight browser outbound/navigation attempts are
  rejected before network. No external or page errors.
- Types and public product compilation PASS. Independent public-build check
  finds no demo entry/control/identity markers. Existing product warnings about
  provider annotations and large chunks remain; they are not new demo failures.

The UI run initially reproduced a local Vite flag-definition issue (Equipo
instead of Gestion). Individual synthetic compile-time definitions fixed it;
the complete journey was rerun successfully. A second boundary run found an
ambiguous accessible actor label, fixed explicitly in the local selector.
Both journey and boundary scripts then PASS together, with their owned server,
contexts and browsers closed. No product implementation change or weakened
assertion was needed.

## Captures

[Manager desktop](newManager-1440.png), [manager mobile viewport](newManager-390.png),
[operator desktop](newWorker-1440.png), [operator mobile viewport](newWorker-390.png).
All contacts and records are synthetic. No authenticated production screenshot,
credential or bootstrap capability is committed.

## Gates and limitations

Candidate review, CI and product preview are recorded separately from local
results. The coordinator's cross-tab/late-response boundary run is a separate
passing regression from the journey. No PGlite concurrency or real-provider validation
is claimed; independent PostgreSQL regressions remain in existing CI.

The user rehearsal is still pending. Responsive screenshots do not approve a
physical phone, mobile keyboard, human autonomy or external onboarding. This
demo does not approve the privacy notice or permit real care, prescriptions,
dispensing, payments, invitations or operational use. Reload keeps SQL only
while the local process lives; restart/reset intentionally clears it.
