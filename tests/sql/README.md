# Isolated PostgreSQL approval test

Install with `npm ci --prefix tests/sql --ignore-scripts`.
Run with `npm test --prefix tests/sql` from the repository root.

Uses [PGlite](https://pglite.dev/docs/) to execute the repository migrations
in ephemeral PostgreSQL. Only platform roles and auth.uid are scaffolded.
It never connects to Supabase, sends emails, or reads credentials.

The test covers both professional roles, resend without duplicate queue rows,
approval, stale review rejection, patient activation, forbidden reviewers,
cross-role application rejection, null profile rejection and browser-role grants.

`node tests/sql/approval-flow.mjs --baseline` intentionally excludes the September
5 fix and reproduces SQLSTATE 42702 at the professional application upsert.
The ordinary test applies the new migration and passes.

PGlite is not the deployed PostgREST gateway, Privy, or a multi-connection
PostgreSQL service. Separate integration and concurrent transaction tests remain.
