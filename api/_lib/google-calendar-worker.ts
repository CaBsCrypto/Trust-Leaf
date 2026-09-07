import { createCalendarEvents, type CalendarBooking } from './google-calendar-events.js';
import { refreshCalendarToken, calendarProvider } from './google-calendar-provider.js';

export interface CalendarJob {
  booking_ref: string;
  revision: number;
  lease_id: string;
  desired_state: 'confirmed' | 'cancelled';
}

export interface CalendarWorkStore {
  claim(): Promise<CalendarJob | null>;
  credentials(job: CalendarJob): Promise<{ clientId: string; clientSecret: string; refreshToken: string; calendarId: string }>;
  booking(job: CalendarJob): Promise<CalendarBooking>;
  finish(input: { bookingRef: string; revision: number; leaseId: string;
    state: 'ready' | 'pending' | 'cancelled' | 'error'; meetUrl?: string | null }): Promise<unknown>;
}

// A bounded invocation never detaches promises from the serverless request lifetime.
export async function processCalendarJob(store: CalendarWorkStore, fetcher: typeof fetch = fetch) {
  const job = await store.claim();
  if (!job) return { processed: false };
  const identity = { bookingRef: job.booking_ref, revision: job.revision, leaseId: job.lease_id };
  let outcome: { state: 'ready' | 'pending' | 'cancelled' | 'error'; meetUrl?: string | null };
  try {
    const credentials = await store.credentials(job);
    if (!credentials.calendarId) throw new Error('CALENDAR_SETUP_REQUIRED');
    const accessToken = await refreshCalendarToken(credentials, fetcher);
    const events = createCalendarEvents(accessToken, credentials.calendarId, fetcher);
    if (job.desired_state === 'cancelled') {
      await events.cancel(job.booking_ref);
      outcome = { state: 'cancelled' };
    } else {
      await calendarProvider(accessToken, fetcher).verifyMeet(credentials.calendarId);
      const booking = await store.booking(job);
      if (booking.bookingRef !== job.booking_ref) throw new Error('CALENDAR_BOOKING_MISMATCH');
      outcome = await events.ensure(booking);
    }
  } catch {
    // Never persist provider payloads, tokens or participant details as diagnostics.
    outcome = { state: 'error' };
  }
  await store.finish({ ...identity, ...outcome });
  return { processed: true, state: outcome.state };
}
