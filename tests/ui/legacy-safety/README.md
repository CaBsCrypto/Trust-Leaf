# Isolated Legacy UI Read Safety

This fixture mounts the actual `MockupPortal`, language context, wallet onboarding
and drawers. Only provider/service boundaries are replaced. It never imports the
application server, an authentication SDK, SQL fixture or migration. Session
transitions change host props without remounting the portal or exposing its hooks.

Run from the repository root after the existing root and `tests/ui` dependency
installs, with an installed Playwright 1.58.2 module:

```powershell
$env:PLAYWRIGHT_MODULE = 'ABSOLUTE_PATH_TO_PLAYWRIGHT'
$env:PLAYWRIGHT_CHANNEL = 'chrome'
node tests/ui/legacy-ui-read-safety.browser.mjs --before-fix
node tests/ui/legacy-ui-read-safety.browser.mjs
```

On Linux CI use `PLAYWRIGHT_CHANNEL=chromium` after the existing browser install.
The runner builds the real UI in memory (no dev/HMR client), then owns an
ephemeral `127.0.0.1` static server and temporary browser profile;
both close in `finally`. It loads no `.env` files and exposes no inherited Vite
environment variables. Mutators, signatures, external HTTP/WebSockets, Node
outbound connections and unexpected APIs are blocked and independently counted.
Private retired endpoints are never requested directly by the test.

`--before-fix` uses only read-only `git show
3243904:src/components/MockupPortal.tsx`, transforming that source in memory. It
does not check out or write historical product code. Its expected security
failure exits 1; setup/fixture failures exit 2. The ordinary regression must exit
0. The historical negative control runs the 20 common read/cache scenarios;
the fixed source must complete all 28 scenarios. Each run freezes the portal source and records its SHA-256 in
`scratch/legacy-ui-read-safety/{before-fix,fixed}/report.json`, with synthetic
screenshots alongside. No Git mutation is performed.

Coverage: foreign and malformed retired caches for patient/dispensary at
360/390/768/1024/1440; session instance, email, role, subject and logout changes;
doctor smoke/preview at 390/1440; real synthetic wallet connection, preparation
and address reset; real `PrivyAgenda` mounted with enabled synthetic context;
unavailable status, disabled validation/delivery drawers, private DOM/console
markers, zero retired balance, and zero retired requests or business writes.
Retired-cache writes after initial seeding are independently recorded, including
across host transitions. Every inspection records counters and state per stage;
end-of-case guards also detect delayed requests and service calls.
The negative retired-route response is intercepted HTTP 410 with
`LEGACY_PRIVATE_ROUTE_DISABLED`. Final fixed-source SHA-256 must still match the
worktree when the run completes; otherwise it requires a repeat.

The retired pickup cache is not hydrated and must expose no `Mostrar token`
action. With Firebase auth deliberately null, the hidden handler cannot be
invoked through a legitimate current UI path. Its no-timer implementation is
covered separately by the coordinator's source/AST regression; this browser
does not force disabled controls or access component hooks.

Responsive assertions cover the critical notice and drawer controls, not every
legacy panel. Product CSS is preserved except its Google Fonts import; explicit
Tailwind sources prevent a repository-wide scan. System fonts differ from hosted
fonts. Screenshots do not expand internal scrolling containers. Chromium widths
are not physical-phone, software-keyboard, safe-area, touch or cross-engine QA.
Firebase listener/auth isolation is not an integration test of those providers.
The synthetic wallet derivation resolves normally; out-of-order promises and
permission completion after React unmount are not forced by this runner. Real
crypto/Firebase permission writes and legacy mutation-response paths are blocked,
not exercised. Generation/null guards and retired-dashboard setter constraints
need the separate source/AST coverage; the browser does not claim those paths.

CI integration uses a separate isolated browser command after the existing root,
UI and Playwright installations, with source AST/unit coverage and existing suites
retained. The coordinator has wired that command in `operations-pilot.yml`;
this fixture does not modify the workflow. Upload only this synthetic evidence
directory on failure. No product or workflow is modified by this fixture.
