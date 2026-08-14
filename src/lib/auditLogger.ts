/**
 * auditLogger.ts
 *
 * Lightweight audit trail module that writes every on-chain operation to the
 * Firestore `audit_logs` collection.  This is a fire-and-forget call — it
 * never throws, so callers don't need to wrap it in try/catch themselves.
 *
 * Schema of each document:
 *   audit_logs/{autoId}
 *     type          AuditEventType
 *     txHash        string
 *     actorAddress  string
 *     actorRole     'doctor' | 'dispensary' | 'patient' | 'admin'
 *     prescriptionId number | null
 *     patientAddress string | null
 *     dispensaryId   string | null
 *     quantity       number | null
 *     timestamp      ISO-8601 string
 *     network        'testnet' | 'mainnet'
 *     metadata       Record<string, unknown> — extra context (free-form)
 */

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

export type AuditEventType =
  | 'prescription_issued'
  | 'prescription_dispensed'
  | 'prescription_retained'
  | 'prescription_released'
  | 'pickup_confirmed'
  | 'pickup_created'
  | 'account_funded'
  | 'doctor_registered'
  | 'dispensary_registered';

export type ActorRole = 'doctor' | 'dispensary' | 'patient' | 'admin';

export interface AuditEvent {
  type: AuditEventType;
  txHash: string;
  actorAddress: string;
  actorRole: ActorRole;
  prescriptionId?: number | null;
  patientAddress?: string | null;
  dispensaryId?: string | null;
  quantity?: number | null;
  /** Optional bag of extra context-specific fields */
  metadata?: Record<string, unknown>;
}

/**
 * Write an audit event to Firestore `audit_logs`.
 * This function is **fire-and-forget** — it catches its own errors so that the
 * calling flow is never blocked or interrupted by a logging failure.
 */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  // If no Firebase Auth session is active yet, fall back to console-only
  // logging. Firestore rules require isSignedIn() to create audit_logs.
  if (!auth.currentUser) {
    console.log(`[Audit] 📋 ${event.type} — TX: ${event.txHash.slice(0, 16)}... (no auth session, skipping Firestore)`);
    return;
  }

  try {
    await addDoc(collection(db, 'audit_logs'), {
      ...event,
      timestamp: new Date().toISOString(),
      serverTimestamp: serverTimestamp(),
      network: 'testnet',
      prescriptionId: event.prescriptionId ?? null,
      patientAddress: event.patientAddress ?? null,
      dispensaryId: event.dispensaryId ?? null,
      quantity: event.quantity ?? null,
      metadata: event.metadata ?? {},
    });
    console.log(`[Audit] ✅ ${event.type} — TX: ${event.txHash.slice(0, 16)}...`);
  } catch (err) {
    // Never let audit failures propagate to the caller.
    console.warn('[Audit] ⚠️ Failed to write audit event to Firestore:', err);
  }
}
