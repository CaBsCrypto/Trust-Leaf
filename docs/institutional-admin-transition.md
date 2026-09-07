# Institutional administrator and Calendar transition

Status: both administrators active and verified in the production panel.
The connection-ownership migration 20260908010000 is applied and recorded.
Worker/setup changes are local, with focused SQL and worker tests passing.
Production deployment is blocked by an invalid Vercel CLI credential.
No institutional Google OAuth authorization or organizer replacement has occurred.

## Account ownership

- admin@trustleaf.org: institutional operations account. Zoho hosts email;
  a separate Google account with the same address has been created.
- cabscryptocontacto@gmail.com: existing technical administrator and fallback.
- Both accounts remain individually identifiable and auditable. Calling an
  account "development" does not isolate its actions from production.
- Use a separate environment for synthetic development activity.

## Original implementation constraints

- Calendar credentials are a singleton in trustleaf_central_calendar.
- The connection RPC save action replaces refresh_ciphertext and connected_by.
- calendar_id is retained on replacement. Setup verifies that existing calendar
  with the new token; it does not migrate ownership or existing events.
- Therefore do not reconnect the institutional account yet. A successful OAuth
  callback alone would not prove that old events can still be managed.
- The first-admin bootstrap is not a mechanism for adding another administrator.

## Ordered implementation and validation

1. Sign in to Privy with admin@trustleaf.org. Verify its server-validated subject
   and email before assigning privileges. Google account creation is not Privy
   enrollment and does not create a Trust Leaf admin role.
2. Provision that exact subject through a reviewed server-only administrative
   operation with audit evidence. Retain the existing administrator. Never grant
   admin based on an unverified client email or a public self-service button.
3. Verify both administrators independently; verify patient and professional
   identities still cannot read administrative data or change roles.
4. Before organizer replacement, implement versioned Calendar connections and
   bind each booking/job to its owning connection and calendar. Keep credentials
   encrypted and unavailable to browser clients. Backfill existing ownership.
5. Authorize the new Google account as a candidate connection, create and verify
   its calendar, then make it default for new bookings only. OAuth consent needs
   the account owner's participation. Confirm OAuth audience permits the account.
6. Existing bookings must continue using their original connection for updates,
   retries and cancellations. Do not revoke the old token while they depend on it.
7. Test a new synthetic booking: institutional organizer, invitations to both
   participants, simultaneous admission/audio, cancellation notices and rebooking.
   Test cancellation of an old-organizer booking separately with authorization.
8. Test candidate-setup failure, expired credentials, concurrent retries and
   rollback of the default connection without changing existing booking ownership.

## Security and rollout gates

- User configures account recovery and two-factor authentication privately.
- Do not copy passwords, refresh tokens or private clinical data into this file.
- A fallback administrator does not automatically inherit another Google
  account's calendars or recovery access.
- Keep the current organizer active until connection ownership tests pass.
- This document does not certify the transition as implemented or deployed.
