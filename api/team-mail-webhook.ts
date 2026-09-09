import { teamMailWebhook } from './_lib/team-invitations.js';

// Web Request preserves the original bytes required by the webhook signature.
export default { fetch: (request: Request) => teamMailWebhook(request,process.env) };
