import type { PilotSnapshot } from './contracts';

// A failed read cannot renew access to patient data. Only the last own operational records remain.
export function readFailureProjection(snapshot: PilotSnapshot | null): PilotSnapshot | null {
  if (!snapshot || snapshot.role !== 'dispensary') return snapshot;
  const membership = snapshot.membership;
  if (!snapshot.joined || !membership?.organization_ref) return null;
  const organizationRef = membership.organization_ref;
  const batches = (snapshot.batches ?? []).filter(batch => batch.organization_ref === organizationRef);
  const batchRefs = new Set(batches.map(batch => batch.batch_ref));
  return {
    synthetic: true, joined: snapshot.joined, role: snapshot.role, actorRef: snapshot.actorRef,
    asOf: snapshot.asOf, staffOnly: snapshot.staffOnly, membership,
    organizations: (snapshot.organizations ?? []).filter(organization => organization.organization_ref === organizationRef),
    batches, movements: (snapshot.movements ?? []).filter(movement => batchRefs.has(movement.batch_ref)),
    deliveries: (snapshot.deliveries ?? []).filter(delivery => delivery.organization_ref === organizationRef),
    patientProfiles: [], treatments: [], grants: [], bookings: [], encounters: [], notes: [],
  };
}
