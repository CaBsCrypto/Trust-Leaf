export type TechnicalQueueStatus = 'pending' | 'verified' | 'suspended';
export interface TechnicalAdminAccess { authenticated: boolean; roles: readonly string[]; scopes: readonly string[] }

const FIXTURE = {
  professionals: [{ ref: 'pro_7Kp2mN8qR4xV', status: 'pending' }, { ref: 'pro_3Tb9wL6hJ5sQ', status: 'verified' }],
  dispensaries: [{ ref: 'dsp_8Fn3cM7vP2kR', status: 'pending' }, { ref: 'dsp_4Qj6yH9nS3tW', status: 'suspended' }],
  patients: [{ ref: 'pat_6Vm2qK8rN5xJ', status: 'identity_pending' }, { ref: 'pat_9Ls4hP7wC2bT', status: 'directory_enabled' }],
  receipts: [{ ref: 'rcpt_7yH4mJ2qP8vN6kL3', state: 'partial', finality: 'confirmed' }],
  alerts: [{ code: 'INDEXER_SOURCE_UNKNOWN', severity: 'warning' }, { code: 'AUDIT_DURABILITY_PENDING', severity: 'blocking' }],
} as const;

export function getTechnicalAdminFixture(access: TechnicalAdminAccess) {
  const allowed = access.authenticated && access.roles.includes('admin') && access.scopes.includes('admin:readiness:read');
  if (!allowed) return { mode: 'denied' as const, mutationsAvailable: false as const };
  return {
    mode: 'synthetic-read-only' as const,
    mutationsAvailable: false as const,
    queues: {
      professionals: FIXTURE.professionals.map(item => ({ ...item })),
      dispensaries: FIXTURE.dispensaries.map(item => ({ ...item })),
      patients: FIXTURE.patients.map(item => ({ ...item })),
    },
    receipts: FIXTURE.receipts.map(item => ({ ...item })),
    alerts: FIXTURE.alerts.map(item => ({ ...item })),
  };
}
