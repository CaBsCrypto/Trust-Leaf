# Google Calendar connection

Status: local implementation, not deployed or enabled. Automatic event/Meet creation is NOT implemented.

The doctor-only start route verifies Privy identity and active Supabase role. The callback uses a single-use database record, a browser-bound HttpOnly cookie, PKCE, expiry and role revalidation. Refresh tokens use AES-256-GCM with the subject as authenticated context. No tokens are returned to the browser or stored in Git.

Scope: `https://www.googleapis.com/auth/calendar.app.created`, limited to secondary calendars created by the app. This does not read the doctor's personal schedule. Google may permit a different selected Google account from the Privy email; the connection is bound to the initiating Privy identity.

## Activation prerequisites

- Review/apply ONLY `20260907010000_google_calendar_connection.sql`; the monthly quota draft is unrelated.
- Generate an independent 32-byte key as 64 hexadecimal characters for server-only `GOOGLE_CALENDAR_ENCRYPTION_KEY`. Preserve it securely for decryption; rotation requires re-encryption.
- Existing server variables: `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI`.
- Exact callback: `https://www.trustleaf.org/api/google-calendar/callback`.
- Configure Google consent scope and test users, then set `GOOGLE_CALENDAR_ENABLED=true` and `VITE_GOOGLE_CALENDAR_ENABLED=true` only after integration tests.
- Verify callback success, denial, expiry, replay, wrong browser, inactive doctor and revoked Google consent against a disposable database before rollout.

## Remaining booking integration

Persist the app-created calendar ID. Add an outbox transaction to confirmed booking/cancellation; workers must use deterministic event IDs, conference request IDs and retry claims. Store conference pending/ready/error separately from booking state. Do not report a confirmed booking as failed solely because Google is unavailable. Add per-participant authorization for Meet URLs, refresh/reconnect and disconnect flows. Test rescheduling/cancellation and duplicate/concurrent requests. No clinical detail in Google event contents.

References: https://developers.google.com/workspace/calendar/api/auth and https://developers.google.com/identity/protocols/oauth2/web-server
