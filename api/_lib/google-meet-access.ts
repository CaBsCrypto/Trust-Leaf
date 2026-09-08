export const meetSettingsScope = 'https://www.googleapis.com/auth/meetings.space.settings';

/** Applies the explicitly requested open-access policy to a Calendar-created room. */
export async function ensureOpenMeet(accessToken: string, meetUrl: string, fetcher: typeof fetch = fetch) {
  const match = /^https:\/\/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})$/.exec(meetUrl);
  if (!match) throw new Error('MEET_URL_INVALID');
  const base = 'https://meet.googleapis.com/v2/';
  async function request(path: string, method = 'GET', body?: unknown) {
    const response = await fetcher(`${base}${path}`, {
      method,
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Object.assign(new Error('MEET_ACCESS_PROVIDER_ERROR'), { statusCode: response.status });
    return response.json();
  }
  // Meeting codes are GET aliases only; PATCH must use the canonical resource name.
  const space = await request(`spaces/${match[1]}`);
  if (typeof space.name !== 'string' || !/^spaces\/[A-Za-z0-9_-]+$/.test(space.name)) {
    throw new Error('MEET_SPACE_INVALID');
  }
  if (space.config?.accessType !== 'OPEN') {
    await request(`${space.name}?updateMask=config.accessType`, 'PATCH', { config: { accessType: 'OPEN' } });
  }
  const verified = await request(space.name);
  if (verified.name !== space.name || verified.config?.accessType !== 'OPEN') {
    throw new Error('MEET_ACCESS_NOT_OPEN');
  }
  return { spaceName: space.name, accessType: 'OPEN' as const };
}
