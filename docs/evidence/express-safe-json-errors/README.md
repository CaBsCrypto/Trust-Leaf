# DEM-PRIV-03: bounded Express parser errors

Branch `fix/express-safe-json-errors`, from main `fbee6ea` (PR63 integrated).
The standalone four-argument handler is mounted immediately after the existing
JSON parser. Nine installed body-parser categories map to fixed status/code
pairs. No body, message, stack, arbitrary status or provider field is emitted.
Unknown errors retain their original handling; this is not global log scrubbing.

Earlier retired routes and the signed raw webhook retain their order, parser
options, limits and successful byte handling. An unfinished response with sent
headers is destroyed without passing the private error to finalhandler; ended
or destroyed transports consume known errors without writing or forwarding.

## Evidence

- Historical negative parser reproduction on `fbee6ea`: expected failure,
  synthetic private JSON marker reached stderr. No hosted leak was asserted.
- Permanent regression: fixed category table, unknown-error forwarding,
  failed response boundaries, actual server registration/order, and real
  loopback JSON/raw parsers in development and production. Five tests PASS.
- Malformed JSON, strict scalar rejection, unsupported charset/encoding,
  declared/chunked oversize return bounded JSON. Valid object/array/empty/gzip
  requests preserve behavior. Default 102400-byte JSON and 65536-byte raw limits
  remain intact; raw whitespace/CRLF/UTF-8 and invalid JSON bytes are unchanged.
- All console methods and stderr captured: zero parser diagnostics. External
  fetch/socket requests blocked and counted: zero attempts. Owned servers close.
- Existing retired-route regression: 198 actual export and 325 Express HTTP
  cases PASS, zero Stellar/fetch calls. Types and product build PASS.

No dotenv, full server startup, real auth, webhook provider, production write or
business record is used by this regression. The old manual negative harness
deliberately constructs an unhardened app and is not a green CI test.
Aborted/size-mismatch categories and sent/destroyed response boundaries are
synthetic table cases, not a claim of physical-network testing.

Review, latest-candidate CI/preview and release metadata are required before
marking this correction published. Existing vendor and bundle warnings remain.
Privacy notice approval, human autonomy and external onboarding stay separate.

## Previous correction release

PR63 candidate `ea4afdd`, independently reviewed, CI `36964636874` PASS and
preview Ready, integrated as `fbee6ea6cf4ed1abf34cdb58ba29ec81b8c2274d`.
GitHub production `6801411840` success associates that SHA with
`dpl_6A6Z6SEUpB7ecrhUyxBzNCqnNKDx`, Vercel Ready with official aliases.
Public App asset on www.trustleaf.org contains the bounded failed-read message.
Four actor pages return 200; private operations/commerce/onboarding reads without
a session return 401 and `no-store, private`. These are anonymous release checks,
not another authenticated four-actor journey. Main CI `36965393118` was running
when this follow-up was prepared; candidate approval is recorded separately.
