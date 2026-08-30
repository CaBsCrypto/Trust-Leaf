import { createHash, timingSafeEqual } from 'node:crypto';
import type { AuthorizedPrincipal } from './server-authorization.ts';

export type AvailabilityState = 'published' | 'booked' | 'cancelled';
export interface AvailabilitySlot { slotRef: string; doctorActorRef: string; startsAt: string; endsAt: string; state: AvailabilityState; version: number; bookingRef?: string; }
export interface Booking { bookingRef: string; slotRef: string; patientActorRef: string; state: 'confirmed' | 'cancelled'; version: number; }
export interface BookingAudit { sequence: number; actorRef: string; action: 'availability.published' | 'appointment.booked'; resourceRef: string; }
export interface AvailabilityBookingRepository {
  transact<T>(operation: () => Promise<T>): Promise<T>;
  slot(slotRef: string): Promise<AvailabilitySlot | null>;
  saveSlot(next: AvailabilitySlot, expectedVersion: number | null): Promise<void>;
  booking(bookingRef: string): Promise<Booking | null>;
  saveBooking(next: Booking): Promise<void>;
  replay(operationDigest: string): Promise<{ intentDigest: string; outcome: Record<string, unknown> } | null>;
  remember(operationDigest: string, intentDigest: string, outcome: Record<string, unknown>): Promise<void>;
  appendAudit(entry: Omit<BookingAudit, 'sequence'>): Promise<void>;
  audit(): Promise<readonly BookingAudit[]>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPERATION = /^[a-z0-9][a-z0-9:_-]{15,127}$/;

/** Local synthetic adapter only. A future Postgres adapter must run each command in
 * one DB transaction; the service deliberately has no client, Firebase, or storage API. */
export function createInMemoryAvailabilityBookingRepository(): AvailabilityBookingRepository {
  const slots = new Map<string, AvailabilitySlot>(); const bookings = new Map<string, Booking>();
  const journal = new Map<string, { intentDigest: string; outcome: Record<string, unknown> }>(); const audit: BookingAudit[] = [];
  let tail = Promise.resolve();
  const clone = <T>(value: T): T => structuredClone(value);
  return {
    async transact<T>(operation: () => Promise<T>) { const prior = tail; let release!: () => void; tail = new Promise<void>(resolve => { release = resolve; }); await prior; try { return await operation(); } finally { release(); } },
    async slot(ref) { const row = slots.get(ref); return row ? clone(row) : null; },
    async saveSlot(next, expected) { const current = slots.get(next.slotRef); if ((expected === null && current) || (expected !== null && current?.version !== expected)) throw fail('AVAILABILITY_CAS_CONFLICT', 409); slots.set(next.slotRef, clone(next)); },
    async booking(ref) { const row = bookings.get(ref); return row ? clone(row) : null; },
    async saveBooking(next) { if (bookings.has(next.bookingRef)) throw fail('BOOKING_EXISTS', 409); bookings.set(next.bookingRef, clone(next)); },
    async replay(key) { const row = journal.get(key); return row ? clone(row) : null; },
    async remember(key, intent, outcome) { if (journal.has(key)) throw fail('IDEMPOTENCY_RACE', 409); journal.set(key, { intentDigest: intent, outcome: clone(outcome) }); },
    async appendAudit(entry) { audit.push({ ...clone(entry), sequence: audit.length + 1 }); },
    async audit() { return clone(audit); },
  };
}

export function createAvailabilityBookingService(repository: AvailabilityBookingRepository) {
  return {
    async publish(principal: AuthorizedPrincipal, input: { slotRef: string; startsAt: string; endsAt: string; operationId: string }) {
      requirePrincipal(principal, 'doctor', 'availability:write'); validateRefs(input.slotRef, principal.actorRef); validateOperation(input.operationId);
      const window = validateWindow(input.startsAt, input.endsAt); const intent = { kind: 'publish', actor: principal.actorRef, slot: input.slotRef, ...window };
      return repository.transact(async () => {
        const replay = await replayOrThrow(repository, input.operationId, intent); if (replay) return { ...replay, replayed: true };
        const slot: AvailabilitySlot = { slotRef: input.slotRef, doctorActorRef: principal.actorRef, startsAt: window.startsAt, endsAt: window.endsAt, state: 'published', version: 1 };
        await repository.saveSlot(slot, null); await repository.appendAudit({ actorRef: principal.actorRef, action: 'availability.published', resourceRef: slot.slotRef });
        const outcome = { slotRef: slot.slotRef, version: slot.version, state: slot.state }; await repository.remember(input.operationId, digest(intent), outcome); return { ...outcome, replayed: false };
      });
    },
    async reserve(principal: AuthorizedPrincipal, input: { slotRef: string; bookingRef: string; expectedSlotVersion: number; operationId: string }) {
      requirePrincipal(principal, 'patient', 'appointment:book'); validateRefs(input.slotRef, input.bookingRef, principal.actorRef); validateOperation(input.operationId);
      if (!Number.isSafeInteger(input.expectedSlotVersion) || input.expectedSlotVersion < 1) throw fail('AVAILABILITY_VERSION_INVALID', 400);
      const intent = { kind: 'reserve', actor: principal.actorRef, slot: input.slotRef, booking: input.bookingRef, expected: input.expectedSlotVersion };
      return repository.transact(async () => {
        const replay = await replayOrThrow(repository, input.operationId, intent); if (replay) return { ...replay, replayed: true };
        const slot = await repository.slot(input.slotRef);
        if (!slot || slot.state !== 'published') throw fail('AVAILABILITY_NOT_BOOKABLE', 409);
        if (slot.version !== input.expectedSlotVersion) throw fail('AVAILABILITY_CAS_CONFLICT', 409);
        const booking: Booking = { bookingRef: input.bookingRef, slotRef: slot.slotRef, patientActorRef: principal.actorRef, state: 'confirmed', version: 1 };
        const next: AvailabilitySlot = { ...slot, state: 'booked', version: slot.version + 1, bookingRef: booking.bookingRef };
        await repository.saveBooking(booking); await repository.saveSlot(next, slot.version); await repository.appendAudit({ actorRef: principal.actorRef, action: 'appointment.booked', resourceRef: booking.bookingRef });
        const outcome = { bookingRef: booking.bookingRef, slotRef: slot.slotRef, version: booking.version, state: booking.state }; await repository.remember(input.operationId, digest(intent), outcome); return { ...outcome, replayed: false };
      });
    },
  };
}

async function replayOrThrow(repository: AvailabilityBookingRepository, operationId: string, intent: Record<string, unknown>) {
  const existing = await repository.replay(operationId); if (!existing) return null;
  const expected = Buffer.from(digest(intent), 'hex'); const actual = Buffer.from(existing.intentDigest, 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw fail('IDEMPOTENCY_REPLAY_MISMATCH', 409);
  return existing.outcome;
}
function requirePrincipal(principal: AuthorizedPrincipal, role: string, scope: string) { if (!UUID.test(principal.actorRef ?? '') || !principal.roles.includes(role as never) || !principal.scopes.includes(scope)) throw fail('COMMAND_FORBIDDEN', 403); }
function validateRefs(...refs: string[]) { if (refs.some(ref => !UUID.test(ref))) throw fail('OPAQUE_REFERENCE_REQUIRED', 400); }
function validateOperation(value: string) { if (!OPERATION.test(value)) throw fail('IDEMPOTENCY_KEY_REQUIRED', 400); }
function validateWindow(startsAt: string, endsAt: string) { const start = Date.parse(startsAt); const end = Date.parse(endsAt); if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || end - start > 8 * 60 * 60 * 1_000) throw fail('AVAILABILITY_WINDOW_INVALID', 400); return { startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() }; }
function digest(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function fail(code: string, statusCode: number) { return Object.assign(new Error('Availability/booking command rejected.'), { code, statusCode }); }
