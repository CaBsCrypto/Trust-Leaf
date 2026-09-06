# Private Actor Directory

The administrator directory lists email, role and lifecycle state. Role and
state come from Supabase; email is fetched server-side from Privy for the exact
bound subject. Provider identifiers, linked wallets and full user objects are
not returned to the browser. Emails are not copied into new database tables.

The endpoint verifies the Privy token and active administrator binding before
querying the directory. The SQL RPC separately checks the administrator role
and expiry. Only service_role can execute the public RPC; browser database
roles cannot. HTTP responses use no-store. Each page contains at most 25 actors.
Email-provider failure shows unavailable contact information without hiding the
actor's state. Current contact selection supports email and Google OAuth.

Official provider API: https://docs.privy.io/api-reference/users/get

## Validation

- `npm run qa:synthetic-actors`: includes directory authorization, response
  minimization, identity mismatch, provider failure and bounded pagination tests.
- `npm test --prefix tests/sql`: executes all migrations in isolated PostgreSQL,
  verifies directory access for admin and denials for other roles and browser roles.
- Real production validation of this directory is still pending deployment and
  migration `20260906060000_private_actor_directory.sql`.

## Approval Feedback

A successful review response now removes the pending item before reloading.
A refresh failure is reported as a refresh failure, not a failed decision.
Uncertain submission outcomes ask for a refresh before another attempt.
The empty-queue message is hidden during loading and after a load error.
This does not add durable client operation IDs or solve all possible transport
timeouts; server-side version checks remain authoritative.
