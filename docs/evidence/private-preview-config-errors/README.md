# Private preview configuration error boundary

04/10/2026. Separate branch `fix/private-preview-config-errors` from main3243904.
PR67's legacy UI correction is frozen and held separately; no API correction is
added to that PR. This additional defect was reproduced during its preview gate.

## Reproduction

Candidate preview dpl_6Kt8DtSaGU9fjqmzb7bf2NQiLCjv: anonymous operations GET500,
`FUNCTION_INVOCATION_FAILED`. Earlier documentary preview trustleaf-cxjoejdzs
has the same error. Baseline production and www.trustleaf.org return401
`AUTH_REQUIRED`, `no-store, private`. Only configuration names/scopes were
checked; preview has no Privy server configuration. No values were read/copied.

Cause: the consolidated readiness route constructs the Privy verifier before
delegating to the private handler. Its configuration exception escapes before
method, token and bounded error checks. The same call pattern affects commerce.

Eight actual-export tests failed before correction with the exact configuration
exception. All requests and identifiers synthetic; fetch and Stellar blocked.

## Correction and gates

For those two delegates only, construct the verifier on its verify call inside
the existing authenticated error boundary. The existing handlers still check
method/token and feature flags; no new identity, role or bypass is introduced.
Anonymous/blank token401, method405, invalid JSON400, unavailable provider503.
Errors remain fixed module codes, `no-store, private`, with no received body.

Permanent regression: 12/12 PASS, including disabled capabilities. Types and
product build PASS; consolidated-route, operation8, commerce5, pilot-safety,
legacy-authorization, RBAC4 and critical-static regressions PASS locally.
Independent review, candidate CI and preview remain gates before merge.
This is not authentication integration in
preview and does not provision Privy, Supabase or any other provider there.

No APIs added, public types, migrations, provider configuration or business data
changed. No secrets, actual identities or authenticated screenshots are stored.
B, Browns, the monthly draft and PR62's unpublished privacy draft are untouched.
