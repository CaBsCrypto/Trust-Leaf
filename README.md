# Trust Leaf

Trust Leaf is a Stellar/Soroban MVP for medical cannabis prescriptions,
dispensary validation and partial-dispense traceability. The app separates
patient, doctor, dispensary and admin workflows so clinical data stays private
while authorization, prescription status and dispense records remain verifiable
on Stellar Testnet.

Production:
- https://www.trustleaf.org

MVP status route:
- `/mvp`

## Current MVP State

- Network: Stellar Testnet.
- Contracts: DoctorRegistry, DispensaryRegistry, Prescription and DispenseRecord.
- Frontend: Vite + React.
- API runtime: Vercel Functions under `api/`.
- Admin auth: Firebase Auth + Firestore allowlist, with explicit demo fallback.
- Patient wallet UX: Passkey, Freighter or demo Testnet identity.

## Run Locally

Prerequisites:
- Node.js
- Stellar CLI if working on Soroban contracts

Commands:

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run lint
npm run build
cd soroban
cargo test
```

## Important Docs

- `docs/scrum-master-mvp-update.md`: current SCRUM-facing MVP status.
- `docs/SCRUM_PLAN_MAIN.md`: product roadmap and actor flows.
- `docs/soroban-mvp.md`: contracts, Testnet deployment and web3 architecture.
- `docs/firebase-admin-setup.md`: admin allowlist setup.

## Testnet Notes

All web3 work must stay on Stellar Testnet until explicitly changed. Clinical
documents, diagnoses, exams and full medical notes must never be written
on-chain; Soroban stores authorization, hashes, status, expiration and dispense
events only.
