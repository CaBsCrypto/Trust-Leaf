const DIGEST = /^[a-f0-9]{64}$/i;
const ALIAS = /^[a-z][a-z0-9-]{2,63}$/;

export interface CustodyProvider {
  readonly kind: string;
  currentVersion(alias: string): Promise<number | null>;
  signDigest(alias: string, version: number, digest: string): Promise<string>;
}

export interface CustodyAuditLogger {
  write(event: Readonly<Record<string, string | number | boolean>>): void;
}

export interface SignerCustodyPolicy {
  submissionEnabled: false;
  allowedAliases: readonly string[];
  pinnedVersions: Readonly<Record<string, number>>;
}

export function createSignerCustody(input: {
  provider: CustodyProvider;
  policy: SignerCustodyPolicy;
  logger?: CustodyAuditLogger;
}) {
  validatePolicy(input.policy);
  const audit = (event: Record<string, string | number | boolean>) => input.logger?.write({
    component: 'signer-custody',
    ...event,
  });

  return {
    async sign(request: { alias: string; secretVersion: number; digest: string; operationId: string }) {
      if (input.policy.submissionEnabled !== false) throw custodyError('SUBMISSION_MUST_REMAIN_DISABLED');
      if (!ALIAS.test(request.alias) || !input.policy.allowedAliases.includes(request.alias)) throw custodyError('SIGNER_ALIAS_FORBIDDEN');
      if (!DIGEST.test(request.digest) || !/^[A-Za-z0-9_-]{16,128}$/.test(request.operationId)) throw custodyError('SIGN_REQUEST_INVALID');
      const pinned = input.policy.pinnedVersions[request.alias];
      if (!Number.isSafeInteger(pinned) || pinned < 1 || request.secretVersion !== pinned) throw custodyError('SECRET_VERSION_NOT_PINNED');

      const current = await input.provider.currentVersion(request.alias);
      if (current === null) {
        audit({ outcome: 'denied', reason: 'SECRET_MISSING', alias: request.alias, secretVersion: request.secretVersion });
        throw custodyError('SECRET_MISSING');
      }
      if (current !== request.secretVersion) {
        audit({ outcome: 'denied', reason: 'SECRET_ROTATED', alias: request.alias, secretVersion: request.secretVersion });
        throw custodyError('SECRET_ROTATED');
      }
      try {
        const signature = await input.provider.signDigest(request.alias, request.secretVersion, request.digest.toLowerCase());
        if (!signature || typeof signature !== 'string') throw custodyError('SIGNATURE_INVALID');
        audit({ outcome: 'signed', alias: request.alias, secretVersion: request.secretVersion });
        return { signature, alias: request.alias, secretVersion: request.secretVersion, submissionEnabled: false as const };
      } catch (error) {
        audit({ outcome: 'denied', reason: safeReason(error), alias: request.alias, secretVersion: request.secretVersion });
        throw custodyError('SIGNING_UNAVAILABLE');
      }
    },
  };
}

function validatePolicy(policy: SignerCustodyPolicy) {
  if (policy.submissionEnabled !== false || !policy.allowedAliases.length) throw custodyError('CUSTODY_POLICY_INVALID');
  if (policy.allowedAliases.some(alias => !ALIAS.test(alias) || !Number.isSafeInteger(policy.pinnedVersions[alias]) || policy.pinnedVersions[alias] < 1)) {
    throw custodyError('CUSTODY_POLICY_INVALID');
  }
}

function safeReason(error: unknown) {
  const code = (error as { code?: unknown })?.code;
  return typeof code === 'string' && /^[A-Z0-9_]{1,48}$/.test(code) ? code : 'PROVIDER_ERROR';
}
function custodyError(code: string) { return Object.assign(new Error('Signing unavailable.'), { code }); }
