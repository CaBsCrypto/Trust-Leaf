# Local four-actor demo

This entry mounts the existing product panels against actual ephemeral PGlite
SQL and the existing API executors. It is not another mock interface or real
Privy authentication. Only Admin, doctor and patient are initially active;
manager and operator must complete their invitation flows.

## Start

Node 22, from the repository:

```powershell
npm ci
npm ci --prefix tests/sql --ignore-scripts
npm ci --prefix tests/ui
npm run demo:local -- 4331
```

Open the loopback URL printed at startup (its ephemeral fragment grants access
only to this local rehearsal). The UI removes it from the address bar. If occupied, select a different port; the server
never takes over an existing listener. Use the actor selector and local inbox.
Invitations open locally with simulated identities; no access codes are needed.
Reload preserves SQL while this process is alive. Stopping/restarting the process
or explicitly resetting clears the scenario. This is not durable cloud storage.

## Rehearsal (20-30 minutes)

1. Admin invites `newmanager@example.test` using Incorporaciones. Open the message
   in the local inbox. Manager accepts, saves fictional contact/organization data,
   reviews and submits. Admin approves; manager returns to the approved draft.
2. Manager invites `newworker@example.test`; open that local message and accept
   as operator. Never use an address belonging to a real person.
3. Manager creates Flor Demo Horizonte / DEMO-LOCAL-001, descriptive grams,
   reorder threshold20g, without price/cost. Receive exactly one linked batch
   DEMO-LOCAL-LOT-001 with100g, future expiry and fictional origin. Do not also use
   the ordinary inventory reception form.
4. Doctor/patient accept synthetic participation. Doctor publishes a future
   slot; patient reserves. Doctor explicitly starts the consultation, saves a
   fictional note and completes a treatment30g/one period. Prepared medical
   activation is not evidence of professional onboarding or real prescriptions.
5. Patient saves a fictional profile and explicitly authorizes the new organization.
   Operator locates that patient, reviews10g and confirms ONLY in this local DB.
   Result:20g available,90g stock, one actual delivery receipt.
6. Patient and dispensary recover the same receipt. Operator reviews1g without
   confirming; hypothetical19g does not alter persisted20g/90g. Manager shows
   inventory, catalog and team; operator keeps restricted controls.

## Boundaries

- Only compiled in-memory assets are served; no Vite filesystem/HMR, public
  directory, ambient Vite environment files, source maps or repository fallback.
- Exact loopback Host/Origin, closed paths/methods/queries, bounded JSON, an
  independent startup bootstrap capability outside the bundle, ephemeral
  capabilities and generation checks. Reset serializes commands and invalidates
  old capabilities/tokens; failed reconstruction leaves admission closed until
  restart. API executors still derive role/org from actual SQL. Actor switching
  cannot discard an uncertain command; recover its same ID first.
- SQL migrations use an explicit reviewed manifest, not discovery of local drafts.
  Monthly draft, B and Browns are neither imported nor changed.
- Provider-shaped RPC/identity/mail calls use an exact virtual adapter. No real
  Privy, Supabase HTTP, Resend, Calendar, Meet, Firebase or Stellar is executed.
  The inbox shows plain text and local links, not provider HTML/production URLs.
- Browser CSP and guards reject external HTTP, navigation and streaming requests.
  Node HTTP/TCP/TLS/UDP/DNS/resolvers/fetch are blocked; workers and subprocess creation are locked after the
  local compiler finishes. These are application boundaries, not an OS sandbox
  guarantee against every native addon/worker/transport.
- Source remains outside published routes and is excluded from Vercel. Public
  compilation is checked independently for demo markers.

## Checks

```powershell
npm run test:local-demo
npm run lint
npm run build
node tests/local-demo/public-build.test.mjs
# Owns a fresh local server; requires Playwright installed:
node tests/local-demo/run-journey.mjs
```

Browser QA uses `LOCAL_DEMO_URL`, `PLAYWRIGHT_MODULE`, `PLAYWRIGHT_CHANNEL`.
Reports/captures are fully synthetic. Responsive simulation is not a physical
phone, keyboard or human autonomy assessment. The user rehearsal remains an
explicit gate. PR62's privacy notice remains draft and external onboarding is
not enabled by this demo.
