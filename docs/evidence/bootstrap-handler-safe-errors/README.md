# DEM-PRIV-07: bounded bootstrap handler categories

Branch `fix/bootstrap-handler-safe-errors`, from main `85b046a`.
Only the bootstrap catch is changed: 11 exact code/numeric-status pairs are
accepted. Unknown codes, mismatches and primitive rejections become
`503 / BOOTSTRAP_UNAVAILABLE`. Log and response use the same newly constructed
pair, never the original message, stack, body or extra properties.

Method/token rejection, verified email matching, minimal success projection,
cache header and call ordering are unchanged. No retries, identity changes,
permissions, public API additions or migrations are introduced. PR61's store
diagnostic allowlist remains unchanged.

## Evidence

- Actual baseline handler: 19 of 54 permanent cases fail before correction.
  Earlier independent scratch reproduction also showed bounded synthetic string,
  object and array codes reaching response/log; zero SDK/store/network calls.
- Permanent suite: 54/54 PASS after correction, invoking the actual readiness
  default export, real identity verifier with a synthetic user reader and an
  in-memory store adapter. Fixture assertion failures cannot hide in catches.
- All exact pairs, unknown/prototype-like/long codes, mismatched statuses,
  primitive store failures, plain verifier error, direct method/token/email
  branches, invalid actor, missing/malformed configuration and minimal success.
- Per-invocation console debug/info/log/warn/error, stdout/stderr capture and
  full untruncated inspection reject synthetic private markers. Fetch, sockets,
  HTTP(S), TLS, HTTP2, UDP and WebSocket blocked; no real SDK or unrelated module.
  Inherited environment is replaced, not read. All hooks/instrumentation restored.
- Existing store diagnostics 58/58, RBAC 4/4, consolidation, types and build PASS.
  Existing vendor annotations and large-bundle warnings remain.

This proves the error boundary with injected rejections. Real SDK provenance is
not established; no production bootstrap or real account was exercised.
Independent review, latest-candidate CI/preview and deployment are release gates.
Notice approval, human autonomy and external invitations remain separate.

## Previous correction release

PR64 candidate `bec8edc`, security/quality scoped reviews approved, CI
`36966407443` PASS and preview Ready. Integrated as
`85b046af4329464cb8193967772995cb51dedcf0`; main CI `36967159314` PASS.
GitHub production `6801680234` success associates that SHA with
`dpl_EsYcNyjwBpCYcuzsRpbarjpfz7Fx`, Vercel Ready and official aliases verified.
The Express parser is exercised in isolated actual-registration HTTP tests,
not presented as an observed hosted Express process. No malformed business
request or business write was sent to production to manufacture evidence.
