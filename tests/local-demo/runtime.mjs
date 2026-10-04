import { randomBytes } from 'node:crypto';
import { operationsDatabase } from '../sql/operations-db.mjs';
import { migrationNames } from './migrations.mjs';
import { executeOperationsPilot } from '../../api/_lib/operations-pilot.ts';
import { executeDispensaryCommerce } from '../../api/_lib/dispensary-commerce.ts';
import { executePrivyAgenda } from '../../api/_lib/privy-agenda.ts';
import { executeOnboarding } from '../../api/_lib/dispensary-onboarding.ts';
import { executeTeamCommand } from '../../api/_lib/team-invitations.ts';

export const actors = { admin: 'Admin', doctor: 'Medico', patient: 'Paciente', newManager: 'Encargado', newWorker: 'Operador' };
export async function createRuntime(generation) {
  const { db, subjects } = await operationsDatabase({ migrationNames, namespace: 'local-cycle', roles: { admin: 'admin', doctor: 'doctor', patient: 'patient' } });
  for (const key of ['newManager', 'newWorker']) subjects[key] = `did:privy:local-cycle-${key}`;
  const access = randomBytes(32).toString('base64url');
  const identities = Object.keys(actors).map(key => ({ key, label: actors[key], subject: subjects[key], email: `${key.toLowerCase()}@example.test`, token: randomBytes(32).toString('base64url') }));
  const verifier = { verify: async token => {
    const id = identities.find(row => row.token === token);
    if (!id) throw Object.assign(new Error('AUTH_REQUIRED'), { statusCode: 401 });
    return { subject: id.subject, emails: [id.email] };
  } };
  const mail = [], mailKeys = new Map();
  const env = { TRUSTLEAF_DISPENSARY_ONBOARDING_ENABLED: 'true', TRUSTLEAF_TEAM_INVITATIONS_ENABLED: 'true', TRUSTLEAF_OPERATIONS_PILOT_ENABLED: 'true',
    TRUSTLEAF_COMMERCE_CATALOG_ENABLED: 'true', TEAM_INVITATION_ENCRYPTION_KEY: 'ab'.repeat(32), SUPABASE_URL: 'https://fixture.invalid',
    SUPABASE_SECRET_KEY: 'synthetic-local', PRIVY_APP_ID: 'synthetic-local', PRIVY_APP_SECRET: 'synthetic-local', RESEND_API_KEY: 'synthetic-local',
    GOOGLE_CALENDAR_ENABLED: 'false', GOOGLE_CALENDAR_AUTOMATION_ENABLED: 'false' };
  const rpc = {
    trustleaf_resolve_privy_actor: ['select * from public.trustleaf_resolve_privy_actor($1)', p => [p.subject], true],
    trustleaf_operations_pilot: ['select public.trustleaf_operations_pilot($1,$2,$3) as data', p => [p.p_subject, p.p_action, p.p_input]],
    trustleaf_dispensary_commerce: ['select public.trustleaf_dispensary_commerce($1,$2,$3) as data', p => [p.p_subject, p.p_action, p.p_input]],
    trustleaf_privy_agenda: ['select public.trustleaf_privy_agenda($1,$2,$3) as data', p => [p.p_subject, p.p_action, p.p_input]],
    trustleaf_privy_agenda_booking: ['select public.trustleaf_privy_agenda_booking($1,$2) as data', p => [p.p_subject, p.p_booking_ref]],
    trustleaf_dispensary_onboarding: ['select public.trustleaf_dispensary_onboarding($1,$2,$3) as data', p => [p.p_subject, p.p_action, p.p_input]],
    trustleaf_team_invitations: ['select public.trustleaf_team_invitations($1,$2,$3) as data', p => [p.p_subject, p.p_action, p.p_input]],
  };
  // These provider-shaped calls are virtual transports, never HTTP passthrough.
  const fetcher = async (address, init) => {
    const url = new URL(String(address));
    if (url.origin === 'https://api.privy.io' && url.pathname.startsWith('/v1/users/') && !url.search && !url.hash && (init?.method ?? 'GET') === 'GET') {
      const id = identities.find(row => url.href === `https://api.privy.io/v1/users/${encodeURIComponent(row.subject)}`);
      if (!id) throw new Error('LOCAL_TRANSPORT_REJECTED');
      return Response.json({ id: id.subject, linked_accounts: [{ type: 'email', address: id.email, latest_verified_at: 1 }] });
    }
    if (url.href === 'https://api.resend.com/emails' && init?.method === 'POST') {
      const payload = JSON.parse(init.body), key = new Headers(init.headers).get('Idempotency-Key');
      if (!key || !Array.isArray(payload.to) || !payload.to.every(email => identities.some(row => row.email === email))) throw new Error('LOCAL_MAIL_REJECTED');
      if (mailKeys.has(key)) return Response.json({ id: mailKeys.get(key) });
      const match = String(payload.text).match(/#(dispensary-invite|team-invite)=([A-Za-z0-9_-]{43})(?:\s|$)/);
      if (!match) throw new Error('LOCAL_MAIL_REJECTED');
      const id = `local-mail-${mail.length + 1}`;
      const text = payload.text.replace(/https:\/\/www\.trustleaf\.org\/dispensario#[^\s]+/, '[Enlace disponible en el buzon local]');
      mail.push({ id, to: payload.to[0], subject: payload.subject, text, kind: match[1], token: match[2] }); mailKeys.set(key, id);
      return Response.json({ id });
    }
    const name = url.pathname.replace('/rest/v1/rpc/', ''), mapping = rpc[name];
    if (url.origin !== 'https://fixture.invalid' || url.pathname !== `/rest/v1/rpc/${name}` || url.search || url.hash || url.username || url.password || init?.method !== 'POST' || !Object.hasOwn(rpc, name)) throw new Error('LOCAL_TRANSPORT_REJECTED');
    try {
      const rows = (await db.query(mapping[0], mapping[1](JSON.parse(init.body)))).rows;
      return Response.json(mapping[2] ? rows : rows[0].data);
    } catch (error) { return Response.json({ code: /^[A-Z0-9]{5}$/.test(error.code) ? error.code : 'UNKNOWN' }, { status: 400 }); }
  };
  const options = token => ({ env, verifier, fetcher, token });
  async function dispatch(path, token, command) {
    // Never persist a real recipient before the virtual mail adapter can reject it.
    if (path === '/api/dispensary-onboarding' && command?.action === 'invite' && String(command.email).toLowerCase() !== 'newmanager@example.test'
      || path === '/api/team-invitations' && command?.action === 'create' && String(command.email).toLowerCase() !== 'newworker@example.test') throw Object.assign(new Error('LOCAL_INPUT_INVALID'), { statusCode: 400, code: 'LOCAL_INPUT_INVALID' });
    const profile = command?.profile ?? (command?.action === 'save-profile' ? command.input : null);
    if (profile && [profile.email, profile.contactEmail].some(email => email && (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.test$/i.test(email)))) throw Object.assign(new Error('LOCAL_INPUT_INVALID'), { statusCode: 400, code: 'LOCAL_INPUT_INVALID' });
    if (path === '/api/operations-pilot') return executeOperationsPilot({ ...options(token), command });
    if (path === '/api/dispensary-commerce') return executeDispensaryCommerce({ ...options(token), command });
    if (path === '/api/agenda') return executePrivyAgenda({ ...options(token), action: command.action, input: command.input });
    if (path === '/api/dispensary-onboarding') return executeOnboarding({ ...options(token), command });
    if (path === '/api/team-invitations') return executeTeamCommand({ ...options(token), command });
    throw Object.assign(new Error('NOT_FOUND'), { statusCode: 404 });
  }
  return { generation, access, identities, mail, dispatch, close: () => db.close(), metadata: () => ({ generation, access, identities }) };
}
