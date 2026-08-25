export const KEY_CUSTODY_ROLES = [
  'admin-quorum',
  'deployer',
  'submission-operator',
  'doctor-service',
  'dispensary-service',
] as const;

export type KeyCustodyRole = (typeof KEY_CUSTODY_ROLES)[number];
