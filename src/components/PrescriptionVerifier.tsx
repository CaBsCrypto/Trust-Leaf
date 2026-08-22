import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, Leaf, ShieldCheck, XCircle } from 'lucide-react';
import { demoPublicReceiptVerifier, type PublicVerificationResult } from '../lib/publicVerification';

interface PrescriptionVerifierProps { id: string; onBack: () => void }

const STATUS_COPY = {
  active: { label: 'Vigente', detail: 'La constancia demo figura vigente.', icon: CheckCircle },
  revoked: { label: 'Revocada', detail: 'La constancia demo figura revocada.', icon: XCircle },
  expired: { label: 'Expirada', detail: 'La constancia demo figura expirada.', icon: Clock },
  unavailable: { label: 'No disponible', detail: 'No fue posible confirmar la constancia.', icon: AlertTriangle },
} as const;

export default function PrescriptionVerifier({ id, onBack }: PrescriptionVerifierProps) {
  const [result, setResult] = useState<PublicVerificationResult | null>(null);
  const operationKey = useMemo(() => globalThis.crypto.randomUUID(), [id]);

  useEffect(() => {
    let active = true;
    demoPublicReceiptVerifier.verify(id, operationKey).then(value => { if (active) setResult(value); });
    return () => { active = false; };
  }, [id, operationKey]);

  useEffect(() => {
    const tag = document.createElement('meta');
    tag.name = 'robots';
    tag.content = 'noindex, nofollow, noarchive';
    document.head.appendChild(tag);
    return () => tag.remove();
  }, []);

  const copy = STATUS_COPY[result?.status ?? 'unavailable'];
  const Icon = copy.icon;

  return (
    <div className="min-h-screen bg-[#edf2ee] text-brand-green-deep">
      <header className="border-b border-brand-green-deep/10 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <button type="button" onClick={onBack} className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green-deep text-brand-ivory"><Leaf size={18} /></span>
            <span className="font-bold">Trust Leaf</span>
          </button>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-900">Demo · no uso clínico</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-5 py-10">
        <section className="rounded-3xl bg-brand-green-deep p-8 text-brand-ivory shadow-xl">
          <ShieldCheck className="text-brand-gold" size={32} />
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.25em] text-brand-gold">Constancia pública mínima</p>
          <h1 className="mt-3 font-serif text-4xl">Verificación de comprobante</h1>
          <p className="mt-4 text-sm leading-relaxed text-brand-ivory/70">Esta vista sintética comprueba únicamente existencia, coincidencia y estado. No es una receta ni acredita validez clínica o legal.</p>
        </section>

        <section aria-live="polite" className="rounded-3xl border border-brand-green-deep/10 bg-white p-7 shadow-sm">
          {!result ? <p className="text-sm text-brand-green-mid">Comprobando constancia demo…</p> : (
            <div className="space-y-5">
              <div className="flex items-center gap-3"><Icon size={24} /><h2 className="text-2xl font-bold">{copy.label}</h2></div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-2xl bg-brand-neutral p-4"><dt className="font-bold">Comprobante existente</dt><dd>{result.evidenceExists ? 'Sí' : 'No confirmado'}</dd></div>
                <div className="rounded-2xl bg-brand-neutral p-4"><dt className="font-bold">Coincidencia</dt><dd>{result.proofMatches ? 'Coincide' : 'No confirmada'}</dd></div>
              </dl>
              <p className="text-sm text-brand-green-mid">{copy.detail}</p>
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-xs leading-relaxed text-amber-950">
          Esta página pública nunca muestra identidad, ficha, diagnóstico, medicamento, dosis, gramaje, saldo ni historial de dispensación. El acceso ampliado para una autoridad requiere definición jurídica, autenticación y autorización separadas; no se ofrece mediante un enlace público permanente.
        </aside>
      </main>
    </div>
  );
}
