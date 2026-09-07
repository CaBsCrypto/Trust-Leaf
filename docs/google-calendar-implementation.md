# Google Calendar connection

## Current integration work (2026-09-07)

### Production verification update

- Production deployment: `trustleaf-8zcm3o4ga-cabscryptocontacto-6028s-projects.vercel.app`.
- Central secondary calendar preparation completed and Google Meet capability passed.
- Calendar migration applied and registered; monthly quota draft remains untouched.
- Automation flag and server-only worker secret configured; secret also stored in Vault.
- Supabase cron job `trustleaf-calendar-worker` runs each minute. Observed successful
  execution and HTTP 200, without timeout.
- Technical fixture booking `88bb2f83-1b5b-48be-9404-5d9015a27b44` reached `ready`
  after one worker attempt, with a Meet URL and no error. Administrator UI shows Lista.
- Fixture used the agenda SQL function for existing test participants, not a fresh
  browser login/reservation. It is not evidence of end-to-end browser authorization.
- User confirmed receipt of the Meet invitation at the doctor's Zoho-hosted email.
  Patient invitation receipt and two-device admission without the organizer remain unverified.
- Real cancellation/retry validation, initial admin session loading, full typecheck,
  participant UI validation and repository publication remain open.

The following section records the earlier pre-deployment gates for context.

Central OAuth consent has been verified in the production administrator UI.
The booking automation code is in a successful Vercel preview, not production:
`https://trustleaf-1tehsk96u-cabscryptocontacto-6028s-projects.vercel.app`.
The Calendar migration below is applied to production Supabase and its migration
history is registered. Verified: queue exists, zero jobs, anon denied and service_role
allowed. No existing bookings were backfilled and no real Meet has been generated.

- `20260907040000_calendar_booking_outbox.sql`: transactional enqueue, worker leases,
  cancellation revision fencing, private participant link query, central calendar setup.
- Google event client: stable booking event/conference IDs, pending conference state,
  guest notifications and cancellation. Event contents exclude clinical details.
- Worker/store: server-only refresh token decryption, Privy participant email lookup.
- Admin setup/process/jobs endpoints, participant agenda links and operations view.
- Worker endpoint: requires a server-only `CRON_SECRET` of at least 32 characters.

Remaining release gates:

1. Preview build passed after synchronizing React type dependencies in pnpm lockfile.
   Seven Calendar test files and PGlite outbox tests passed. Full typecheck still has
   errors outside Calendar; UI and real-provider integration remain unverified.
2. Add a real periodic worker trigger; the endpoint alone is not a scheduler.
3. Verify retry timing, expired leases and provider failure recovery against PostgreSQL.
4. Calendar migration applied and registered; monthly quota draft was not applied.
5. Deploy, prepare the secondary calendar and verify Google Meet support.
6. Enable `GOOGLE_CALENDAR_AUTOMATION_ENABLED=true` only after setup succeeds.
7. Reserve using test participants and verify one event, invitation receipt, participant
   links, cancellation and two-device guest admission without the organizer.

No existing booking is automatically backfilled. Calendar creation has no provider
idempotency key: an ambiguous creation remains locked for operator reconciliation.
Changing the organizer account after calendar setup needs a dedicated migration flow;
do not silently reuse a calendar owned by a different Google account.

Tests using PGlite validate SQL outcomes, not multi-connection PostgreSQL scheduling.
Mock provider tests do not prove real Google invitation delivery or Meet admission.

## Central organizer revision

Local revision: the connection control moves from doctor agenda to administration.
Start/status and callback require an active administrator. A new singleton table
and separate OAuth state table isolate central credentials from legacy doctor
connections; existing credentials are NOT promoted or copied. Apply
`20260907020000_central_calendar_connection.sql` before deploying this revision.
Google login and consent must be restarted from admin, not the previous doctor flow.
The callback remains unchanged in Cloud but returns to `/admin`.
This connects the organizer only; automatic invitations/Meet, calendar ID persistence,
revocation UI and guest entry without the organizer are still pending.
The historical doctor implementation below describes the initial release.

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
