# Firebase Admin Setup

Use this checklist to enable real `/admin` access. Demo mode remains available
for recordings, but production admin review should use Firebase Auth plus an
allowlist document.

## Steps

1. Open Firebase Console for the project configured in
   `firebase-applet-config.json`.
2. Go to Authentication and create an email/password user for the admin.
3. Copy the created user's `uid`.
4. Go to Firestore and create:

```text
collection: appAdministrators
document id: <admin uid>
```

5. Add a minimal document body:

```json
{
  "role": "admin",
  "createdAt": "2026-05-26T00:00:00.000Z"
}
```

6. Open `/admin`, sign in with the Firebase Auth email/password and confirm the
   panel unlocks as real admin.

## Expected Behavior

- A signed-out user sees the admin login screen.
- A signed-in user without `appAdministrators/{uid}` sees a not-admin error.
- A signed-in allowlisted user sees admin operations.
- Demo admin is still available, but is clearly labeled as demo flow.

## Security Notes

- Never create `appAdministrators` from the public app.
- Do not store Stellar secrets in Firestore.
- Keep `STELLAR_ADMIN_SECRET`, `STELLAR_DOCTOR_SECRET` and
  `STELLAR_DISPENSARY_SECRET` only in Vercel environment variables for Testnet.
- Before a pilot, replace server-side doctor/dispensary signing with wallet or
  passkey signatures.
