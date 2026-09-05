# SQL Approval Findings - 2026-09-05

## Reproduced blocker

Executing the committed migrations in an isolated PostgreSQL instance reproduces
SQLSTATE 42702 in submit_professional_test_application. Its ON CONFLICT
(actor_ref) target collides with the function output variable actor_ref.
The statement fails, rolling back enrollment performed in that request.
This is a concrete explanation for a profile submission not reaching the queue;
the deployed environment has not yet been compared in this session.

The new 20260905220000 migration names the primary-key constraint explicitly,
rejects cross-role profiles and rejects null inputs. The SQL test passes doctor
and dispensary submission, resend, queue visibility, approval and role resolution.
No production migration was executed in this session.

## Next integration gaps found by code review

- src/lib/trustData.ts still reads/writes clinicalRecords and agenda through
  Firestore/localStorage. Hiding the old admin UI did not migrate these consumers.
- api/_lib/durable-availability-booking.ts has no service instantiation in the
  application/API sources searched. Its passing in-memory test does not establish
  that the UI is connected to the durable booking implementation.
- ReceiptLedgerV2 record_partial accepts commitments and expected versions,
  not quantities. It cannot by itself prove the numeric 30 g to 25 g invariant.
  Locate and validate the authoritative quantity ledger before claiming that
  numeric saldo is enforced by this contract.

Next: apply the reviewed SQL fix through the normal migration process, verify
the real professional submission, then wire the remaining booking/clinical
consumers to server-side Privy authorization and private storage.
