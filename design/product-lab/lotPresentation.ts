import type { lots } from './data';

export const lotStateLabel = (state: string, desk: boolean) =>
  desk && state === 'Cuarentena' ? 'Bloqueado para entrega' : state;

export const lotFilterLabel = (state: string, desk: boolean) =>
  desk && state === 'Cuarentena' ? 'Bloqueados' : state;

export const lotReviewReason = (lot: typeof lots[number]) =>
  lot.id === 'NOR-018' && lot.state === 'Cuarentena' ? 'Pendiente de revisión' : null;
