export const KEY_CUSTODY_ROLES = [
  'admin-approval',
  'deployer',
  'operator',
  'doctor-service',
  'dispensary-service',
] as const;

export type KeyCustodyRole = (typeof KEY_CUSTODY_ROLES)[number];

export interface CustodyRoleFinding {
  providerPresent: boolean;
  aliasPresent: boolean;
  balanceSufficient: boolean;
  versionPinned: boolean;
  rotationReady: boolean;
  revocationReady: boolean;
  recoveryReady: boolean;
  signingDisabled: boolean;
  /** Opaque comparison token. It is never copied to the report. */
  dutyBoundary: string;
}

export interface KeyCustodyInventoryProbe {
  readonly mode: 'synthetic-fixture' | 'sanitized-provider';
  readonly realAliasLookupPerformed: boolean;
  inspectRole(role: KeyCustodyRole): Promise<CustodyRoleFinding>;
}

export interface KeyCustodyPreflightConfig {
  testnetSubmitEnabled: boolean;
  testnetMutationsAllowed: boolean;
  network: string;
  networkPassphrase: string;
  rpcUrl: string;
  contractId: string;
  artifactHash: string;
  allowlist: {
    networks: readonly string[];
    networkPassphrases: readonly string[];
    rpcUrls: readonly string[];
    contractIds: readonly string[];
    artifactHashes: readonly string[];
  };
  adminApproval: {
    multisigConfigured: boolean;
    quorumConfigured: boolean;
    noSingleSigner: boolean;
  };
}

export interface KeyCustodyPreflightReport {
  ready: boolean;
  mode: KeyCustodyInventoryProbe['mode'];
  checks: Readonly<Record<string, boolean>>;
  counts: {
    requiredRoles: number;
    inspectedRoles: number;
    readyRoles: number;
    blockers: number;
  };
  roles: Array<{ role: KeyCustodyRole; ready: boolean }>;
  blockers: string[];
}

const BLOCKER = /^[A-Z][A-Z0-9_]{2,95}$/;
const DUTY_BOUNDARY = /^[a-z][a-z0-9-]{2,63}$/;
const STELLAR_ADDRESS = /\b[GCMA][A-Z2-7]{55}\b/;
const STELLAR_SEED = /\bS[A-Z2-7]{55}\b/;
const URL_VALUE = /https?:\/\//i;
const HEX_DIGEST = /\b[a-f0-9]{64}\b/i;
const GLOBAL_CHECK_KEYS = [
  'submissionDisabled',
  'mutationsDisabled',
  'networkAllowlisted',
  'passphraseAllowlisted',
  'rpcAllowlisted',
  'contractAllowlisted',
  'artifactHashAllowlisted',
  'adminMultisigConfigured',
  'adminQuorumConfigured',
  'adminHasNoSingleSigner',
  'noRealAliasLookup',
  'requiredRolesInspected',
  'separationOfDuties',
] as const;
const ROLE_CHECK_SUFFIXES = [
  'providerPresent',
  'aliasPresent',
  'balanceSufficient',
  'versionPinned',
  'rotationReady',
  'revocationReady',
  'recoveryReady',
  'signingDisabled',
] as const;

export async function runKeyCustodyPreflight(input: {
  config: KeyCustodyPreflightConfig;
  probe: KeyCustodyInventoryProbe;
}): Promise<KeyCustodyPreflightReport> {
  const checks: Record<string, boolean> = {
    submissionDisabled: input.config.testnetSubmitEnabled === false,
    mutationsDisabled: input.config.testnetMutationsAllowed === false,
    networkAllowlisted: exactAllowlisted(input.config.network, input.config.allowlist.networks),
    passphraseAllowlisted: exactAllowlisted(input.config.networkPassphrase, input.config.allowlist.networkPassphrases),
    rpcAllowlisted: exactAllowlisted(input.config.rpcUrl, input.config.allowlist.rpcUrls),
    contractAllowlisted: exactAllowlisted(input.config.contractId, input.config.allowlist.contractIds),
    artifactHashAllowlisted: exactAllowlisted(input.config.artifactHash, input.config.allowlist.artifactHashes),
    adminMultisigConfigured: input.config.adminApproval.multisigConfigured === true,
    adminQuorumConfigured: input.config.adminApproval.quorumConfigured === true,
    adminHasNoSingleSigner: input.config.adminApproval.noSingleSigner === true,
    noRealAliasLookup: input.probe.realAliasLookupPerformed === false,
  };

  const inspected = await Promise.all(KEY_CUSTODY_ROLES.map(async role => {
    try {
      const finding = await input.probe.inspectRole(role);
      return { role, finding };
    } catch {
      return { role, finding: unavailableFinding(role) };
    }
  }));

  const dutyBoundaries = inspected.map(item => item.finding.dutyBoundary);
  checks.requiredRolesInspected = inspected.length === KEY_CUSTODY_ROLES.length;
  checks.separationOfDuties = dutyBoundaries.every(value => DUTY_BOUNDARY.test(value))
    && new Set(dutyBoundaries).size === KEY_CUSTODY_ROLES.length;

  const roles = inspected.map(({ role, finding }) => {
    const roleChecks = {
      providerPresent: finding.providerPresent === true,
      aliasPresent: finding.aliasPresent === true,
      balanceSufficient: finding.balanceSufficient === true,
      versionPinned: finding.versionPinned === true,
      rotationReady: finding.rotationReady === true,
      revocationReady: finding.revocationReady === true,
      recoveryReady: finding.recoveryReady === true,
      signingDisabled: finding.signingDisabled === true,
    };
    for (const [name, passed] of Object.entries(roleChecks)) checks[`${roleKey(role)}_${name}`] = passed;
    return { role, ready: Object.values(roleChecks).every(Boolean) };
  });

  const blockers = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `KEY_CUSTODY_${toCode(name)}`);
  const report: KeyCustodyPreflightReport = {
    ready: blockers.length === 0,
    mode: input.probe.mode,
    checks,
    counts: {
      requiredRoles: KEY_CUSTODY_ROLES.length,
      inspectedRoles: inspected.length,
      readyRoles: roles.filter(role => role.ready).length,
      blockers: blockers.length,
    },
    roles,
    blockers,
  };
  assertSafeCustodyReport(report);
  return report;
}

/** Enforces the public output schema and rejects values that could expose custody material. */
export function assertSafeCustodyReport(report: KeyCustodyPreflightReport): void {
  assertExactKeys(report as unknown as Record<string, unknown>, ['ready', 'mode', 'checks', 'counts', 'roles', 'blockers']);
  if (typeof report.ready !== 'boolean' || !['synthetic-fixture', 'sanitized-provider'].includes(report.mode)) throw unsafeReport();
  assertBooleanRecord(report.checks);
  assertExactKeys(report.checks as unknown as Record<string, unknown>, expectedCheckKeys());
  assertExactKeys(report.counts as unknown as Record<string, unknown>, ['requiredRoles', 'inspectedRoles', 'readyRoles', 'blockers']);
  if (Object.values(report.counts).some(value => !Number.isSafeInteger(value) || value < 0)) throw unsafeReport();
  if (!Array.isArray(report.roles) || report.roles.some(item => {
    try {
      assertExactKeys(item as unknown as Record<string, unknown>, ['role', 'ready']);
      return !KEY_CUSTODY_ROLES.includes(item.role) || typeof item.ready !== 'boolean';
    } catch { return true; }
  })) throw unsafeReport();
  if (!Array.isArray(report.blockers) || report.blockers.some(value => typeof value !== 'string' || !BLOCKER.test(value))) throw unsafeReport();

  const serialized = JSON.stringify(report);
  if (STELLAR_ADDRESS.test(serialized) || STELLAR_SEED.test(serialized) || URL_VALUE.test(serialized) || HEX_DIGEST.test(serialized)) throw unsafeReport();
}

export function createSyntheticCustodyProbe(
  findings: Readonly<Record<KeyCustodyRole, CustodyRoleFinding>>,
): KeyCustodyInventoryProbe {
  return {
    mode: 'synthetic-fixture',
    realAliasLookupPerformed: false,
    async inspectRole(role) { return { ...findings[role] }; },
  };
}

function exactAllowlisted(value: string, allowlist: readonly string[]) {
  return value.length > 0 && allowlist.length > 0 && allowlist.includes(value);
}

function unavailableFinding(role: KeyCustodyRole): CustodyRoleFinding {
  return {
    providerPresent: false,
    aliasPresent: false,
    balanceSufficient: false,
    versionPinned: false,
    rotationReady: false,
    revocationReady: false,
    recoveryReady: false,
    signingDisabled: false,
    dutyBoundary: `unavailable-${role}`.slice(0, 64),
  };
}

function roleKey(role: KeyCustodyRole) { return role.replace(/-/g, '_'); }
function expectedCheckKeys() {
  return [
    ...GLOBAL_CHECK_KEYS,
    ...KEY_CUSTODY_ROLES.flatMap(role => ROLE_CHECK_SUFFIXES.map(suffix => `${roleKey(role)}_${suffix}`)),
  ];
}
function toCode(value: string) { return value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/-/g, '_').toUpperCase(); }
function unsafeReport() { return Object.assign(new Error('Custody preflight output rejected.'), { code: 'UNSAFE_CUSTODY_REPORT' }); }

function assertExactKeys(record: Record<string, unknown>, expected: readonly string[]) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw unsafeReport();
  const actual = Object.keys(record).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) throw unsafeReport();
}

function assertBooleanRecord(record: Readonly<Record<string, boolean>>) {
  if (!record || typeof record !== 'object' || Array.isArray(record) || Object.entries(record).some(([key, value]) => !/^[a-z][A-Za-z0-9_]{2,95}$/.test(key) || typeof value !== 'boolean')) throw unsafeReport();
}
