import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, ShieldCheck, XCircle } from 'lucide-react';
import { publicReceiptVerifier, type PublicVerificationResult } from '../lib/publicVerification';
import TechnicalFrame, { TechnicalIntro } from './TechnicalFrame';

interface PrescriptionVerifierProps { id: string; onBack: () => void }

const STATUS_COPY = {
  active: { label: 'Vigente', detail: 'La constancia demo figura vigente.', icon: CheckCircle },
  revoked: { label: 'Revocada', detail: 'La constancia demo figura revocada.', icon: XCircle },
  expired: { label: 'Expirada', detail: 'La constancia demo figura expirada.', icon: Clock },
  unavailable: { label: 'No disponible', detail: 'No fue posible confirmar la constancia.', icon: AlertTriangle },
} as const;

const unavailable: PublicVerificationResult = { demo: true, evidenceExists: false, proofMatches: false, status: 'unavailable' };

export default function PrescriptionVerifier({ id, onBack }: PrescriptionVerifierProps) {
  const [verified, setVerified] = useState<{ operationKey: string; result: PublicVerificationResult } | null>(null);
  const operationKey = useMemo(() => globalThis.crypto.randomUUID(), [id]);
  const result = verified?.operationKey === operationKey ? verified.result : null;

  useEffect(() => {
    let active = true;
    const showResult = (value: PublicVerificationResult) => { if (active) setVerified({ operationKey, result: value }); };
    void publicReceiptVerifier.verify(id, operationKey).then(showResult, () => showResult(unavailable));
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
    <TechnicalFrame onBack={onBack} badge="Demo · no uso clínico" compact>
      <TechnicalIntro title="Verificación de comprobante" label="Constancia pública mínima" icon={ShieldCheck}>
        <p>Esta vista sintética comprueba únicamente existencia, coincidencia y estado. No es una receta ni acredita validez clínica o legal.</p>
      </TechnicalIntro>

      <section aria-label="Resultado de la verificación" aria-live="polite" className="tl-technical-card">
        {!result ? <p className="tl-technical-note">Comprobando constancia demo…</p> : (
          <>
            <h2 className="tl-technical-result" data-status={result.status}>
              <span className="tl-technical-icon"><Icon size={22} aria-hidden="true" /></span>
              {copy.label}
            </h2>
            <dl className="tl-technical-result-details">
              <div><dt>Comprobante existente</dt><dd>{result.evidenceExists ? 'Sí' : 'No confirmado'}</dd></div>
              <div><dt>Coincidencia</dt><dd>{result.proofMatches ? 'Coincide' : 'No confirmada'}</dd></div>
            </dl>
            <p className="tl-technical-note">{copy.detail}</p>
          </>
        )}
      </section>

      <aside className="tl-technical-card tl-technical-note leading-relaxed">
        Esta página pública nunca muestra identidad, ficha, diagnóstico, medicamento, dosis, gramaje, saldo ni historial de dispensación. El acceso ampliado para una autoridad requiere definición jurídica, autenticación y autorización separadas; no se ofrece mediante un enlace público permanente.
      </aside>
    </TechnicalFrame>
  );
}
