import type { PilotSnapshot } from './contracts';

type Batch = NonNullable<PilotSnapshot['batches']>[number];
export function batchState(batch: Batch, now = Date.now()) {
  return batch.state === 'quarantined' ? 'quarantined'
    : Date.parse(batch.expires_at) <= now ? 'expired'
    : batch.stock_mg <= 0 ? 'empty' : 'available';
}
export const batchLabels = {
  quarantined: 'Bloqueado para entrega', expired: 'Vencido',
  empty: 'Agotado', available: 'Disponible',
};
