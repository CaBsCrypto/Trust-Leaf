const PUBLIC_KEY = /^G[A-Z2-7]{55}$/;
const CONTRACT_ID = /^C[A-Z2-7]{55}$/;

export interface AuthCustodyReadiness {
  ready: boolean;
  checks: Readonly<Record<string, boolean>>;
  blockers: string[];
}

/** Returns only booleans and stable blocker codes; it never returns configuration values. */
export function inspectAuthCustodyReadiness(env: Record<string, string | undefined>): AuthCustodyReadiness {
  const checks = {
    authIssuerPresent: present(env.TRUSTLEAF_AUTH_ISSUER),
    authAudiencePresent: present(env.TRUSTLEAF_AUTH_AUDIENCE),
    jwksUrlPresent: isHttps(env.TRUSTLEAF_AUTH_JWKS_URL),
    subjectAllowlistPresent: present(env.TRUSTLEAF_AUTH_SUBJECT_ALLOWLIST_JSON),
    kmsProviderPresent: present(env.TRUSTLEAF_KMS_PROVIDER),
    kmsKeyAliasPresent: present(env.TRUSTLEAF_KMS_KEY_ALIAS),
    workloadIdentityPresent: present(env.TRUSTLEAF_KMS_WORKLOAD_IDENTITY),
    signerPublicKeyValid: PUBLIC_KEY.test(env.TRUSTLEAF_SIGNER_PUBLIC_KEY?.trim() ?? ''),
    receiptContractIdValid: CONTRACT_ID.test(env.STELLAR_RECEIPT_CONTRACT_ID?.trim() ?? ''),
    submissionExplicitlyDisabled: env.TRUSTLEAF_TESTNET_SUBMIT_ENABLED === 'false',
    legacySignerInputDisabled: true,
  } as const;
  const blockers = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => `AUTH_CUSTODY_${toCode(name)}`);
  return { ready: blockers.length === 0, checks, blockers };
}

function present(value: string | undefined) { return Boolean(value?.trim()); }
function isHttps(value: string | undefined) {
  try { return new URL(value ?? '').protocol === 'https:'; } catch { return false; }
}
function toCode(value: string) { return value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase(); }
