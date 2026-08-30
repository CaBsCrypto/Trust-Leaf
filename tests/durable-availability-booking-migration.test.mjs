import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('../supabase/migrations/20260829120000_trustleaf_synthetic_availability_booking.sql', import.meta.url), 'utf8');
assert.match(sql, /PREPARED LOCALLY ONLY/);
assert.match(sql, /create table trustleaf_private\.availability_slots/);
assert.match(sql, /create table trustleaf_private\.appointment_bookings/);
assert.match(sql, /slot_ref uuid not null unique/);
assert.match(sql, /enable row level security/g); assert.match(sql, /force row level security/g);
assert.match(sql, /revoke all on trustleaf_private\.availability_slots, trustleaf_private\.appointment_bookings from public, anon, authenticated, service_role/);
assert.match(sql, /create function trustleaf_private\.publish_availability/);
assert.match(sql, /create function trustleaf_private\.reserve_availability/);
assert.match(sql, /for update/); assert.match(sql, /AVAILABILITY_CAS_CONFLICT/); assert.match(sql, /IDEMPOTENCY_CONFLICT/);
assert.match(sql, /insert into trustleaf_private\.audit_events/g); assert.match(sql, /pg_advisory_xact_lock\(42826001\)/g);
assert.doesNotMatch(sql, /email|rut|diagnos|clinical_note|dose|gram/i);
console.log('durable-availability-booking migration: private/RLS, RPC-only, CAS, idempotency and audit controls passed');
