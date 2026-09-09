import { createHash, randomUUID } from 'node:crypto';
export const digest = value => createHash('sha256').update(value).digest('hex');
export function invitationInput(email = randomUUID() + '@example.test', overrides = {}) {
  const invitationRef = randomUUID();
  return { invitationRef, operationId: randomUUID(), intent: digest(invitationRef),
    emailHash: digest(email), emailCiphertext: 'synthetic-encrypted-recipient', tokenHash: digest(randomUUID()),
    payloadCiphertext: 'synthetic-encrypted-token', ...overrides };
}
export function acceptanceInput(invitation) { return { tokenHash: invitation.tokenHash, emailHashes: [invitation.emailHash], acceptSyntheticOnly: true }; }
export const teamCall = (db, subject, action, input = {}) => db.query('select public.trustleaf_team_invitations($1,$2,$3) as data', [subject, action, input]).then(r => r.rows[0].data);
export async function joinTeam(db, manager, worker) {
  const invitation = invitationInput();
  await teamCall(db, manager, 'create', invitation);
  await teamCall(db, worker, 'accept', acceptanceInput(invitation));
  return invitation;
}
