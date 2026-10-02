# DEM-PRIV-06: failed-read privacy guard

## Scope and baseline

Branch `fix/shared-patient-read-failure-guard`, from main `a2bf39d`.
No API, migration, identity, permission or business-rule changes. The first
negative run loads actual `a2bf39d` components and fails because the previously
shared synthetic patient name remains visible after a failed refresh.

The correction withdraws shared patients, profiles, treatments, grants and
foreign receipts on failed reads. Only last-verified organization-owned batches,
movements and receipts remain, explicitly identified as previous read-only data.
401/403 and session changes still remove the protected view completely.
Recovery does not select a patient or restore a delivery preparation.

Inventory drafts and operation identifiers are retained only within their
existing scope. Commerce and Team executors also respect the parent write gate.
Retries preserve the original intent and require a successful authorized read;
no automatic retry is added. Error text is bounded rather than displaying a
native JSON or transport exception.

## Evidence and reproducibility

- `node --experimental-strip-types tests/read-failure-projection.test.ts`: 5 PASS.
- `tests/ui/shared-patient-read-failure.browser.mjs --before-fix`: expected FAIL
  on the synthetic patient marker, not an HTTP/React synchronization assumption.
- Permanent browser suite: 30 revocation cases, manager/operator across
  360/390/768/1024/1440; grant, treatment and patient-actor revocation in actual
  ephemeral SQL, followed by 503/network/malformed JSON/invalid response.
- Own receipts and inventory retained; foreign receipt and lot filters removed;
  SQL denies a new delivery and a full private-row fingerprint remains unchanged.
- Recovery, inventory draft preservation, Commerce/Team write gates, 401/403,
  identity replacement, and explicit same-ID uncertain receipt recovery PASS.
- Doctor note and patient profile drafts survive failed GETs at 390/1440.
- Delayed-token Commerce/Team mutations are blocked if the parent read fails
  before POST. Commercial demotion removes manager UI while preserving an
  uncertain intent for explicit exact-ID recovery after manager restoration;
  that commercial journal is intercepted, not a durable commercial database.
- Existing inventory guard: both roles/five widths PASS, 70 intercepted POSTs and
  40 effects in its synthetic journal; these are not published movements.
- SQL shared-read regression 19/19, operations 8/8, team and onboarding suites,
  commerce contracts, types and product build PASS.
- First candidate CI passed types, isolated SQL, independent PostgreSQL
  connections, PostgREST and both builds, then found an obsolete GET error-text
  assertion in the existing operations browser suite. Only that expectation was
  updated; the complete SQL-backed browser journey subsequently passed locally.
  Latest-candidate CI is still required; the failed run is not an approval.

The permanent runner owns and closes its loopback Vite server, browser and
PGlite database. No real auth SDK is mounted. All API requests are intercepted,
external browser requests are blocked and counted, Node fetch is blocked and
counted, service workers are blocked. The excluded monthly draft is not loaded.
Playwright module/channel are configured through the same variables as CI.

Synthetic screenshots: [operator mobile](operator-390.png),
[operator desktop](operator-1440.png), [manager mobile](manager-390.png),
[manager desktop](manager-1440.png). They contain no authenticated production data.

## Limits and release gate

Candidate CI, preview, independent review and deployment must be recorded before
marking this correction published. Local builds retain existing vendor annotation
and bundle-size warnings. Viewports are not physical-phone or autonomy evidence.
No production bootstrap, grant, receipt, stock movement or invitation was made.
B/Browns and the monthly draft remain untouched.

This closes only the reproduced failed-read behavior. Hanging GETs, Team pending
intent protection when navigating away, confirmed sign-out abandonment for a
demoted commercial intent, legal approval, notice publication and
human autonomy remain separate. External invitations remain paused.
