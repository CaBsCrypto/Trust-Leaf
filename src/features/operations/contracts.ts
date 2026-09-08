export const pilotActions = ['snapshot', 'join', 'create-organization', 'add-operator', 'remove-operator',
  'start-encounter', 'save-note', 'complete-encounter', 'revoke-treatment', 'grant', 'revoke-grant',
  'receive-batch', 'adjust-stock', 'set-batch-state', 'dispense'] as const;
export type PilotAction = typeof pilotActions[number];
export type PilotRole = 'doctor' | 'patient' | 'dispensary' | 'admin';
export type PilotCommand = { action: PilotAction; input: Record<string, unknown> };
export type Booking = { booking_ref: string; patient_ref: string; doctor_ref: string; starts_at: string; ends_at: string; state: string };
export type Encounter = { booking_ref: string; doctor_ref: string; patient_ref: string; state: 'active' | 'completed'; version: number };
export type ClinicalNote = { booking_ref: string; version: number; body: string; created_at: string };
export type Period = { period_index: number; starts_at: string; ends_at: string; allowance_mg: number; used_mg: number };
export type Treatment = { treatment_ref: string; patient_ref: string; state: string; version: number; issued_at: string;
  prescription_valid_until: string; treatment_ends_at: string; allowance_mg: number; period_count: number; periods: Period[] };
export type Organization = { organization_ref: string; name: string };
export type Membership = { organization_ref: string; actor_ref: string; role: 'manager' | 'operator' };
export type Batch = { batch_ref: string; organization_ref: string; lot_code: string; product: string; source_reference: string;
  expires_at: string; state: 'active' | 'quarantined'; version: number; stock_mg: number };
export type Delivery = { delivery_ref: string; treatment_ref: string; organization_ref: string; operator_ref: string;
  batch_ref: string; period_index: number; quantity_mg: number; created_at: string };
export type Movement = { movement_ref: string; batch_ref: string; operator_ref: string; quantity_mg: number; reason: string; created_at: string };
export type Grant = { treatment_ref: string; organization_ref: string; expires_at: string };
export type PilotSnapshot = { joined: boolean; synthetic: true; role: PilotRole; actorRef: string; asOf?: string;
  membership?: Membership | null; bookings?: Booking[]; encounters?: Encounter[]; notes?: ClinicalNote[];
  treatments?: Treatment[]; organizations?: Organization[]; members?: Membership[]; batches?: Batch[];
  movements?: Movement[]; deliveries?: Delivery[]; grants?: Grant[]; counts?: Record<string, number>;
  audit?: { audit_ref: number; actor_ref: string; action: string; resource_ref: string; created_at: string }[] };

export function gramsToMg(value: string, signed = false): number {
  if (!(signed ? /^-?\d{1,6}(?:[.,]\d{1,3})?$/ : /^\d{1,6}(?:[.,]\d{1,3})?$/).test(value)) throw new Error('Usa gramos con hasta tres decimales.');
  const negative = value.startsWith('-');
  const [whole, decimal = ''] = value.replace('-', '').replace(',', '.').split('.');
  const result = (Number(whole) * 1000 + Number(decimal.padEnd(3, '0'))) * (negative ? -1 : 1);
  if (!Number.isSafeInteger(result) || result === 0) throw new Error('La cantidad debe ser distinta de cero.');
  return result;
}
export const formatGrams = (mg: number) => `${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 3 }).format(mg / 1000)} g`;
export function currentPeriod(t: Treatment, time: number): Period | undefined {
  if (t.state !== 'active' || Date.parse(t.prescription_valid_until) <= time || Date.parse(t.treatment_ends_at) <= time) return;
  return t.periods.find(p => Date.parse(p.starts_at) <= time && time < Date.parse(p.ends_at));
}
