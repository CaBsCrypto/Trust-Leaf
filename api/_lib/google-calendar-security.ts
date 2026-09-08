import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { meetSettingsScope } from './google-meet-access.js';

export const calendarScope = 'https://www.googleapis.com/auth/calendar.app.created';
export const calendarScopes = [calendarScope, meetSettingsScope];
export const calendarCallback = 'https://www.trustleaf.org/api/google-calendar/callback';

function key(value: string) {
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('CALENDAR_ENCRYPTION_KEY_INVALID');
  return Buffer.from(value, 'hex');
}

export function seal(value: string, secret: string, context: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(v => v.toString('base64url')).join('.');
}

export function unseal(value: string, secret: string, context: string) {
  const parts = value.split('.');
  if (parts.length !== 3) throw new Error('CALENDAR_CIPHERTEXT_INVALID');
  const [iv, tag, encrypted] = parts.map(v => Buffer.from(v, 'base64url'));
  if (iv.length !== 12 || tag.length !== 16) throw new Error('CALENDAR_CIPHERTEXT_INVALID');
  const cipher = createDecipheriv('aes-256-gcm', key(secret), iv);
  cipher.setAAD(Buffer.from(context));
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(encrypted), cipher.final()]).toString('utf8');
}

export function digest(value: string) { return createHash('sha256').update(value).digest('hex'); }

export function authorizationRequest(clientId: string) {
  if (!clientId.endsWith('.apps.googleusercontent.com')) throw new Error('CALENDAR_CLIENT_INVALID');
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: calendarCallback,
    response_type: 'code', scope: calendarScopes.join(' '), access_type: 'offline', prompt: 'consent select_account',
    state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
  }).toString();
  return { state, verifier, url: url.toString() };
}
