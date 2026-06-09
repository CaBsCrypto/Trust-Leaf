/**
 * PrescriptionVerifier.tsx
 *
 * Public (unauthenticated) prescription verification page.
 * Accessed via the QR code printed on PDF prescriptions:
 *   https://trustleaf.org/verify/:id
 *
 * Fetches non-sensitive on-chain data and presents a
 * "digital certificate" style UI.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle,
  XCircle,
  Clock,
  Leaf,
  ShieldCheck,
  ExternalLink,
  AlertTriangle,
  Database,
  Hash,
} from 'lucide-react';

interface VerificationResult {
  found: boolean;
  prescriptionId?: number;
  status?: 'active' | 'used' | 'expired';
  expiresAt?: number;
  expiresAtHuman?: string;
  issuedBy?: string;
  patientAddress?: string;
  totalQuantity?: number;
  dispensedQuantity?: number;
  remainingQuantity?: number;
  network?: string;
  contractId?: string;
  verifiedAt?: string;
  message?: string;
}

type LoadState = 'loading' | 'success' | 'error';

interface PrescriptionVerifierProps {
  id: string;
  onBack: () => void;
}

function StatusBadge({ status }: { status: 'active' | 'used' | 'expired' }) {
  const config = {
    active: {
      label: 'Vigente',
      icon: <CheckCircle size={18} />,
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500',
    },
    used: {
      label: 'Consumida',
      icon: <XCircle size={18} />,
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      text: 'text-slate-600',
      dot: 'bg-slate-400',
    },
    expired: {
      label: 'Expirada',
      icon: <Clock size={18} />,
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-700',
      dot: 'bg-amber-500',
    },
  };

  const c = config[status];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold ${c.bg} ${c.border} ${c.text}`}
    >
      <span className={`h-2 w-2 rounded-full ${c.dot} ${status === 'active' ? 'animate-pulse' : ''}`} />
      {c.icon}
      {c.label}
    </span>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1 border-b border-brand-green-deep/8 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs font-bold uppercase tracking-widest text-brand-green-mid/55">{label}</span>
      <span className={`text-sm font-semibold text-brand-green-deep ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function ProgressBar({ total, dispensed }: { total: number; dispensed: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((dispensed / total) * 100)) : 0;
  const remaining = Math.max(0, total - dispensed);

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-brand-green-mid/55">
        <span>Cantidad Dispensada</span>
        <span className="font-mono text-brand-green-deep">{dispensed}g / {total}g</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-brand-neutral">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }}
          className={`h-full rounded-full ${
            pct >= 100 ? 'bg-slate-400' : pct > 75 ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
        />
      </div>
      <div className="flex justify-between text-xs text-brand-green-mid/60">
        <span>{pct}% consumido</span>
        <span className="font-semibold text-emerald-700">{remaining}g restantes</span>
      </div>
    </div>
  );
}

export default function PrescriptionVerifier({ id, onBack }: PrescriptionVerifierProps) {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [result, setResult] = useState<VerificationResult | null>(null);

  useEffect(() => {
    const numericId = Number(id);
    if (!id || !Number.isFinite(numericId) || numericId < 1) {
      setResult({ found: false, message: `ID de receta inválido: "${id}".` });
      setLoadState('error');
      return;
    }

    let cancelled = false;

    const verify = async () => {
      try {
        const res = await fetch(`/api/stellar/prescription/${numericId}/verify`);
        const data: VerificationResult = await res.json();
        if (cancelled) return;
        setResult(data);
        setLoadState(res.ok && data.found ? 'success' : 'error');
      } catch {
        if (!cancelled) {
          setResult({ found: false, message: 'No se pudo conectar con el servidor de verificación.' });
          setLoadState('error');
        }
      }
    };

    verify();
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div className="min-h-screen bg-[#edf2ee] text-brand-green-deep">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-brand-green-deep/10 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <button
            onClick={onBack}
            className="flex items-center gap-3 transition-opacity hover:opacity-75"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green-deep text-brand-ivory">
              <Leaf size={18} />
            </span>
            <span className="text-lg font-bold">Trust Leaf</span>
          </button>
          <span className="rounded-full border border-brand-green-deep/10 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green-mid">
            Verificación Pública
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 space-y-6">
        {/* Hero card */}
        <div className="overflow-hidden rounded-3xl bg-brand-green-deep text-brand-ivory shadow-2xl">
          <div className="p-8 md:p-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-brand-gold">
                  Receta Médica Magistral
                </p>
                <h1 className="mt-3 font-serif text-4xl leading-tight md:text-5xl">
                  Certificado #{id}
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-brand-ivory/65">
                  Verificación criptográfica en Stellar Testnet. Los datos clínicos están protegidos y no se publican en la cadena.
                </p>
              </div>
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                <ShieldCheck size={28} className="text-brand-gold" />
              </span>
            </div>
          </div>

          {/* Status strip */}
          <AnimatePresence mode="wait">
            {loadState === 'loading' && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="border-t border-white/10 bg-white/5 px-8 py-5 md:px-10"
              >
                <div className="flex items-center gap-3">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
                  <span className="text-sm text-brand-ivory/70">Consultando el ledger de Stellar Testnet…</span>
                </div>
              </motion.div>
            )}

            {loadState === 'success' && result?.status && (
              <motion.div
                key="status"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-t border-white/10 bg-white/5 px-8 py-5 md:px-10"
              >
                <div className="flex items-center gap-4">
                  <StatusBadge status={result.status} />
                  {result.verifiedAt && (
                    <span className="text-xs text-brand-ivory/50">
                      Verificado {new Date(result.verifiedAt).toLocaleTimeString('es-CL')}
                    </span>
                  )}
                </div>
              </motion.div>
            )}

            {loadState === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-t border-white/10 bg-red-900/30 px-8 py-5 md:px-10"
              >
                <div className="flex items-center gap-3 text-sm text-red-300">
                  <AlertTriangle size={16} />
                  <span>{result?.message ?? 'Receta no encontrada en el ledger.'}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Details */}
        <AnimatePresence>
          {loadState === 'success' && result?.found && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="space-y-4"
            >
              {/* Info table */}
              <div className="overflow-hidden rounded-3xl border border-brand-green-deep/10 bg-white shadow-sm">
                <div className="border-b border-brand-green-deep/8 px-7 py-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-green-deep text-brand-gold">
                      <Database size={16} />
                    </span>
                    <p className="font-bold text-brand-green-deep">Datos On-Chain Verificables</p>
                  </div>
                </div>
                <div className="px-7 py-2">
                  <InfoRow label="ID de Receta" value={`#${result.prescriptionId}`} />
                  <InfoRow label="Estado" value={
                    result.status === 'active' ? 'Vigente — puede ser dispensada' :
                    result.status === 'used' ? 'Consumida — tratamiento completado' :
                    'Expirada — fuera del período de vigencia'
                  } />
                  <InfoRow label="Vence" value={result.expiresAtHuman ?? '—'} />
                  <InfoRow label="Emisor (Médico)" value={result.issuedBy ?? '—'} mono />
                  <InfoRow label="Paciente" value={result.patientAddress ?? '—'} mono />
                  <InfoRow label="Red Blockchain" value="Stellar Testnet" />
                  <InfoRow label="Contrato Soroban" value={(result.contractId ?? '').slice(0, 20) + '…'} mono />
                </div>
              </div>

              {/* Quantity progress */}
              {(result.totalQuantity ?? 0) > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="overflow-hidden rounded-3xl border border-brand-green-deep/10 bg-white px-7 py-6 shadow-sm"
                >
                  <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-green-deep text-brand-gold">
                      <Hash size={16} />
                    </span>
                    <p className="font-bold text-brand-green-deep">Saldo de Tratamiento</p>
                  </div>
                  <ProgressBar
                    total={result.totalQuantity ?? 0}
                    dispensed={result.dispensedQuantity ?? 0}
                  />
                </motion.div>
              )}

              {/* Disclaimer */}
              <div className="rounded-2xl border border-brand-gold/25 bg-[#fbf7ef] p-5">
                <p className="text-xs leading-relaxed text-brand-green-mid/65">
                  <span className="font-bold text-brand-gold">Aviso de privacidad:</span>{' '}
                  Esta página solo muestra información no-sensible registrada directamente en el ledger público de Stellar. Ningún dato clínico, diagnóstico, ni información médica personal está almacenada en la blockchain — esa información permanece off-chain y bajo el control del paciente.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer CTA */}
        <div className="flex flex-col items-center gap-4 pt-4 text-center sm:flex-row sm:justify-between">
          <p className="text-xs text-brand-green-mid/50">
            Verificación provista por Trust Leaf — Blockchain de Trazabilidad Médica · Stellar Testnet
          </p>
          <a
            href={`https://stellar.expert/explorer/testnet/contract/${result?.contractId ?? ''}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs font-bold text-brand-green-deep/60 transition-colors hover:text-brand-green-deep"
          >
            Ver en Stellar Expert <ExternalLink size={12} />
          </a>
        </div>
      </main>
    </div>
  );
}
