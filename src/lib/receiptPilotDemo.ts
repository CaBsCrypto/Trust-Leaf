export {
  applySyntheticOperation as applyReceiptPilotOperation,
  createSyntheticReceipt as createReceiptPilotFixture,
  operationalProjection,
  publicProjection as publicReceiptProjection,
  sharedSyntheticReceiptStore,
  SYNTHETIC_RECEIPT_HANDLE,
  SYNTHETIC_RECEIPT_TOKEN,
} from '../../shared/receipt-demo-contract.ts';
export type {
  ReceiptState,
  SyntheticOperation as ReceiptPilotOperation,
  SyntheticReceipt as ReceiptPilotSnapshot,
} from '../../shared/receipt-demo-contract.ts';
export type PilotRole = 'doctor' | 'patient' | 'dispensary';
