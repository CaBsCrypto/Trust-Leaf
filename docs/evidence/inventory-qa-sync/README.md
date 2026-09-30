# Inventory QA synchronization

Date: 2026-09-30, America/Santiago. Test-only delivery from
`f1c8f0e1e2e3a3f6318a34283b2b82324f312965`, branch `fix/inventory-qa-sync`.
No product, API, migration, permission or production-data changes.

## Original failure and controlled reproduction

PR52 head `0f0cef010a5e70806d6845a4473aae1827144e77` changes documentation only.
[CI run 36666468947](https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/36666468947)
failed in `Isolated inventory drafts`: manager at 390 px, after returning from
synthetic organization B to A, timed out clicking `Ajustar existencias` inside a
closed parent `Gestionar lote` disclosure. Types, both builds, shared browser,
medical browser, PostgreSQL and PostgREST passed in that run; commerce browser
was skipped, not passed.

The original suite passed locally once with Node 22.20.0, Playwright 1.62.1 and
Chrome 154. That run did not reproduce the failure or establish CI equivalence.

An isolated diagnostic then used Node 22.23.2, Playwright 1.58.2 and Chromium
145.0.7632.6 on Windows. A local synthetic HTTP response was split into headers
and a controlled body release, with no production traffic. At receipt of A's
response headers, the DOM still displayed `SYNTHETIC-B` with the management
disclosure open. The helper sampled that old disclosure state. Releasing the
body rendered `SYNTHETIC-A` with its new disclosure closed; the helper retained
its old decision and timed out on the hidden child control, matching the CI
failure. No product component was changed to produce this ordering.

This confirms a missing test synchronization boundary: receiving an HTTP
response is not proof that React has applied the new snapshot. The controlled
ordering is diagnostic evidence, not a claim that the unmodified local run
failed naturally, nor that the original CI timing was recorded in detail.

Validation also exposed a related response-correlation issue: an earlier GET
from an uncertain-operation recovery could finish after a scope transition.
The generic response waiter selected A while React correctly rendered the later
B snapshot. The waiter now captures the expected organization and role; it must
not wait for an obsolete snapshot that the product has already discarded.

The fix must wait for observable context and locate controls within the current
lot. It must preserve assertions, all role/width cases, the 15-second bound,
discard/auth-loss guards and exact operation-ID recovery. No sleeps, forced
clicks, repaired reloads or product changes are part of the fix.

## Artifacts and verification

Original CI artifacts were downloaded outside Git to
`review-artifacts/inventory-ci-failed-36666468947` in the workspace root.
Diagnostic harness, response/request journal, DOM and screenshots are preserved
outside Git in `scratch/trustleaf-agent6-inventory-qa-sync/red-stream-chromium`.
These are synthetic records; their 69 g diagnostic stock is not B's stock.
Comparable diagnostic screenshots: [A response, B still rendered](response-a-rendered-b-390.png)
and [A rendered, management disclosure closed](rendered-a-closed-disclosure-390.png).

Independent security review found no new blocking issue in the final patch.
Reviewed runner SHA256:
`5296E959051EC59DCB09DE7A4D624807033F65CBDEADAE83E2935579AAE68085`.
All original assertions and ten role/width combinations remain; the forced-form
negative test still checks that disabled controls are not the only command guard.

Coordinator checks: `npm run lint`, `npm run qa:operations-types` (zero baseline,
current or added diagnostics), and builds with capabilities off/on passed.
Vite/esbuild and git child-process starts initially hit Windows sandbox EPERM;
the same checks passed after local execution approval, without code changes.
Existing dependency/chunk-size warnings remain.
Operations and commerce SQL passed in PGlite; identity/operations unit checks
passed with external fetch blocked. Medical guard passed ten cases locally in
Chrome; its Chromium result is reused from the original PR52 CI because product
code is unchanged. The new candidate must pass that regression again in CI.

Three consecutive normal runs passed on that reviewed runner, each with manager
and operator at 360/390/768/1024/1440 px. Node 22.23.2, Playwright 1.58.2,
Chromium 145.0.7632.6; Windows locally, Ubuntu in CI. Each run recorded 70
intercepted POSTs and 40 synthetic journal entries, with zero external requests.
There were no controlled body delays or CPU throttling in these normal runs.
Logs, request journals and screenshots are preserved outside Git in
`scratch/trustleaf-agent6-inventory-qa-sync/normal-1`, `normal-2` and `normal-3`.
The final controlled-stream run also passed after the fix; intermediate selector
and stale-response failures are retained, not counted among the three passes.

The journal counts represent mock-command effects, not a real stock ledger or
durable receipts. Viewports do not establish physical-phone usability or human
autonomy. PGlite does not prove PostgreSQL concurrency; independent connections
remain a separate CI check. Integration requires CI and Vercel preview on the
last candidate commit, followed by fresh checks on the updated documentary PR52.

DEM-SEC-01 and DEM-SEC-02 remain open. Recovering CI does not authorize external
invitations, patient-permission renewal or real clinical/commercial use.
