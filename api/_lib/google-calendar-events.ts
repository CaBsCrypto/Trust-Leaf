import { createHash } from 'node:crypto';

export interface CalendarBooking {
  bookingRef: string;
  startsAt: string;
  endsAt: string;
  doctorEmail: string;
  patientEmail: string;
}

export function eventId(bookingRef: string) {
  return createHash('sha256').update(`trustleaf:booking:${bookingRef}`).digest('hex');
}

export function eventBody(booking: CalendarBooking) {
  const start = Date.parse(booking.startsAt), end = Date.parse(booking.endsAt);
  if (!booking.bookingRef || !Number.isFinite(start) || !Number.isFinite(end) || end <= start
    || ![booking.doctorEmail, booking.patientEmail].every(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new Error('CALENDAR_BOOKING_INVALID');
  }
  const id = eventId(booking.bookingRef);
  return {
    id, summary: 'Consulta programada', visibility: 'private',
    start: { dateTime: new Date(start).toISOString() },
    end: { dateTime: new Date(end).toISOString() },
    attendees: [...new Set([booking.doctorEmail, booking.patientEmail])].map(email => ({ email })),
    guestsCanInviteOthers: false, guestsCanModify: false, guestsCanSeeOtherGuests: false,
    conferenceData: { createRequest: { requestId: id, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
  };
}

export function createCalendarEvents(accessToken: string, calendarId: string, fetcher: typeof fetch = fetch) {
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  async function request(url: string, method: string, body?: unknown) {
    return fetcher(url, {
      method, headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000),
    });
  }
  async function result(response: Response) {
    if (!response.ok) throw Object.assign(new Error('CALENDAR_PROVIDER_ERROR'), { statusCode: response.status });
    const event = await response.json();
    if (event.status === 'cancelled') throw new Error('CALENDAR_EVENT_CANCELLED');
    const status = event.conferenceData?.createRequest?.status?.statusCode;
    const uri = event.conferenceData?.entryPoints?.find((point: any) => point.entryPointType === 'video')?.uri;
    const validUri = typeof uri === 'string' && /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(uri);
    if (status === 'failure') throw new Error('CALENDAR_CONFERENCE_FAILED');
    return { state: validUri ? 'ready' as const : 'pending' as const, meetUrl: validUri ? uri as string : null };
  }
  return {
    async ensure(booking: CalendarBooking) {
      const body = eventBody(booking);
      const url = `${base}/${body.id}`;
      const existing = await request(url, 'GET');
      if (existing.status !== 404) return result(existing);
      const created = await request(`${base}?conferenceDataVersion=1&sendUpdates=all`, 'POST', body);
      // A concurrent worker or a lost response can leave the event already created.
      return result(created.status === 409 ? await request(url, 'GET') : created);
    },
    async cancel(bookingRef: string) {
      const response = await request(`${base}/${eventId(bookingRef)}?sendUpdates=all`, 'DELETE');
      if (!response.ok && response.status !== 404 && response.status !== 410) {
        throw Object.assign(new Error('CALENDAR_PROVIDER_ERROR'), { statusCode: response.status });
      }
    },
  };
}
