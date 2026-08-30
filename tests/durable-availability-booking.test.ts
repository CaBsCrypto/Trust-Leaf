import assert from 'node:assert/strict';
import { createAvailabilityBookingService, createInMemoryAvailabilityBookingRepository } from '../api/_lib/durable-availability-booking.ts';
import type { AuthorizedPrincipal } from '../api/_lib/server-authorization.ts';

const id = (suffix: string) => `00000000-0000-4000-8000-0000000000${suffix}`;
const doctor: AuthorizedPrincipal = { subject: 'synthetic-doctor', actorRef: id('01'), roles: ['doctor'], scopes: ['availability:write'] };
const patient: AuthorizedPrincipal = { subject: 'synthetic-patient', actorRef: id('02'), roles: ['patient'], scopes: ['appointment:book'] };
const otherPatient: AuthorizedPrincipal = { subject: 'synthetic-other', actorRef: id('03'), roles: ['patient'], scopes: ['appointment:book'] };
const repository = createInMemoryAvailabilityBookingRepository(); const service = createAvailabilityBookingService(repository);
const slot = id('11'); const booking = id('21');

const published = await service.publish(doctor, { slotRef: slot, startsAt: '2026-09-01T10:00:00Z', endsAt: '2026-09-01T10:30:00Z', operationId: 'fixture-operation-publish-0001' });
assert.deepEqual(published, { slotRef: slot, version: 1, state: 'published', replayed: false });
assert.equal((await service.publish(doctor, { slotRef: slot, startsAt: '2026-09-01T10:00:00Z', endsAt: '2026-09-01T10:30:00Z', operationId: 'fixture-operation-publish-0001' })).replayed, true);
await assert.rejects(service.publish(patient, { slotRef: id('12'), startsAt: '2026-09-01T10:00:00Z', endsAt: '2026-09-01T10:30:00Z', operationId: 'fixture-operation-publish-0002' }), (error: any) => error.code === 'COMMAND_FORBIDDEN');
const booked = await service.reserve(patient, { slotRef: slot, bookingRef: booking, expectedSlotVersion: 1, operationId: 'fixture-operation-reserve-0001' });
assert.equal(booked.replayed, false); assert.equal((await service.reserve(patient, { slotRef: slot, bookingRef: booking, expectedSlotVersion: 1, operationId: 'fixture-operation-reserve-0001' })).replayed, true);
await assert.rejects(service.reserve(otherPatient, { slotRef: slot, bookingRef: id('22'), expectedSlotVersion: 1, operationId: 'fixture-operation-reserve-0002' }), (error: any) => error.code === 'AVAILABILITY_NOT_BOOKABLE');
await assert.rejects(service.reserve(patient, { slotRef: slot, bookingRef: id('23'), expectedSlotVersion: 2, operationId: 'fixture-operation-reserve-0001' }), (error: any) => error.code === 'IDEMPOTENCY_REPLAY_MISMATCH');
const restarted = createAvailabilityBookingService(repository);
assert.equal((await restarted.reserve(patient, { slotRef: slot, bookingRef: booking, expectedSlotVersion: 1, operationId: 'fixture-operation-reserve-0001' })).replayed, true);
assert.deepEqual((await repository.audit()).map(item => item.action), ['availability.published', 'appointment.booked']);
console.log('durable-availability-booking: role gates, CAS/double-booking, idempotency and repository persistence passed');
