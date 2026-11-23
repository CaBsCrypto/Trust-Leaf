import { useEffect, useState } from 'react';
import { currentPeriod, type PilotSnapshot, type Treatment } from './contracts';

export function useDispensaryAccess(data: PilotSnapshot | null, canRead: boolean) {
  const [, setClockRevision] = useState(0);
  const allowed = new Map<string, Treatment>();
  let nextExpiry = Infinity;

  if (canRead && data?.role === 'dispensary' && data.joined && data.membership?.organization_ref) {
    const now = Date.now();
    const organization = data.membership.organization_ref;
    const expires = new Map(data.grants?.filter(grant => grant.organization_ref === organization)
      .map(grant => [grant.treatment_ref, Date.parse(grant.expires_at)]));

    for (const treatment of data.treatments ?? []) {
      const grantExpiry = expires.get(treatment.treatment_ref) ?? 0;
      const period = currentPeriod(treatment, now);
      if (!period || !(grantExpiry > now)) continue;
      allowed.set(treatment.treatment_ref, treatment);
      nextExpiry = Math.min(nextExpiry, grantExpiry, Date.parse(period.ends_at),
        Date.parse(treatment.prescription_valid_until), Date.parse(treatment.treatment_ends_at));
    }
  }

  useEffect(() => {
    if (!Number.isFinite(nextExpiry)) return;
    const timer = window.setTimeout(() => setClockRevision(revision => revision + 1), Math.max(0, nextExpiry - Date.now()));
    return () => window.clearTimeout(timer);
  }, [nextExpiry]);

  return allowed;
}
