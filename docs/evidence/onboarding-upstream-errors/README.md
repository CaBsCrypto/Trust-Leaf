# DEM-PRIV-05: distinguish input from upstream JSON failures

Branch `fix/onboarding-upstream-errors`, from main `063e406`.
Only the existing onboarding handler changes: request JSON decoding has its own
400 boundary; failures while executing the command fall back to 503. Existing
known 400/401/403/409/429 categories, disabled-module response, authentication,
methods, cache headers, identity and SQL actions are preserved. Primitive
rejections cannot cause another exception while classifying the result.

## Evidence

- Actual handler baseline: 11 PASS / 5 expected failures in the permanent suite.
  Successful HTTP responses with malformed SQL or Privy JSON were incorrectly
  returned as client 400; primitive rejections also broke the error boundary.
- Permanent actual-export suite: 16/16 PASS. It exercises the real JSON readers
  with synthetic intercepted responses, malformed requests before identity or
  network, known statuses, primitive failures, method/auth ordering, disabled
  module and a successful list. Private markers are absent from responses,
  headers and five captured console methods. Fixture assertions cannot be
  swallowed by the product catch. No real provider or SDK was contacted.
- Existing onboarding entry/contracts/isolated SQL suites PASS: drafts,
  versions, corrections, rejection, unique approval, replay and cancellation.
- Existing browser journey extended with a client 400 that does not write SQL,
  corrected intent with a new operation ID, and a committed save whose response
  is replaced with 503. Explicit retry preserves the command and operation ID;
  both responses retain application version 2, not two saves. No automatic retry.
  Form values remain; review/new-save controls are disabled while uncertain.
- Acceptance, reload, corrections, approval, persistent manager, focus and five
  viewport widths remain covered. Browser and owned Vite server close after the
  run. Only the loopback fixture was requested; external browser requests blocked.
- Types and product build PASS. Existing vendor annotation and large-chunk
  warnings remain. The first browser run exposed an unstable textarea locator;
  it was scoped to the form without changing the product or removing assertions.

This is a JSON/error-boundary correction, not complete runtime validation of
every possible upstream schema. PostgreSQL concurrency and other actor suites
remain separate CI gates. Responsive simulation is not physical-phone autonomy.
No invitation, approval or business write was made in production. Notice approval
and external onboarding remain paused; no API addition or migration is required.

## Previous correction release

PR65 candidate `62fa1c0`, security/Admin/quality review, CI `36968164236` PASS and
preview Ready. Merge `063e406c4da8add86c5e3347d216676f9768ee79`; main CI
`36968901251` PASS. GitHub production `6801956660` success associates that SHA
with Vercel `dpl_GTjiZrLTqEobrrP6FYbWiYFuLquC`, Ready and official aliases
verified. No production bootstrap was invoked. This closes DEM-PRIV-07
technically, not privacy governance, real-care eligibility or human autonomy.

Release gates for this fourth correction: independent review, latest-candidate
CI and preview, then merge and separate official deployment/read-only checks.
