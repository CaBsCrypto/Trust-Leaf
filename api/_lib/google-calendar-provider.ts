export async function refreshCalendarToken(input: {
  clientId: string; clientSecret: string; refreshToken: string;
}, fetcher: typeof fetch = fetch): Promise<string> {
  const response = await fetcher('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: input.clientId, client_secret: input.clientSecret,
      refresh_token: input.refreshToken, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error === 'invalid_grant' ? 'CALENDAR_RECONNECT_REQUIRED' : 'CALENDAR_REFRESH_FAILED');
  if (typeof data.access_token !== 'string' || !data.access_token) throw new Error('CALENDAR_REFRESH_FAILED');
  return data.access_token;
}

export function calendarProvider(accessToken: string, fetcher: typeof fetch = fetch) {
  const base = 'https://www.googleapis.com/calendar/v3/calendars';
  return {
    // Call under the durable setup lock; persist the returned ID before processing bookings.
    async create() {
      const response = await fetcher(base, {
        method: 'POST', headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ summary: 'Consultas Trust Leaf', timeZone: 'America/Santiago' }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('CALENDAR_CREATE_FAILED');
      const data = await response.json();
      if (typeof data.id !== 'string' || !data.id) throw new Error('CALENDAR_CREATE_FAILED');
      return data.id as string;
    },
    async verifyMeet(calendarId: string) {
      const response = await fetcher(`${base}/${encodeURIComponent(calendarId)}`, {
        headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('CALENDAR_READ_FAILED');
      const data = await response.json();
      if (!data.conferenceProperties?.allowedConferenceSolutionTypes?.includes('hangoutsMeet')) {
        throw new Error('CALENDAR_MEET_UNAVAILABLE');
      }
    },
  };
}
