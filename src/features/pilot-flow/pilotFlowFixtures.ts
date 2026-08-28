import {
  SYNTHETIC_RECEIPT_TOKEN,
  UNAVAILABLE_PUBLIC_RECEIPT,
  applySyntheticOperation,
  createSyntheticReceipt,
  matchesSyntheticToken,
  publicProjection,
  type PublicReceiptProjection,
} from '../../../shared/receipt-demo-contract.ts';

export const PILOT_QR_HANDLE = SYNTHETIC_RECEIPT_TOKEN;

export const PILOT_PHASES = [
  { phase: 'admin-empty', journeyStep: 1, role: 'admin', eyebrow: 'Inicio controlado', title: 'Panel administrativo vacío', summary: 'No hay actores habilitados ni actividad operativa.', status: 'Sin solicitudes', source: 'fixture-local' },
  { phase: 'doctor-requested', journeyStep: 2, role: 'doctor', eyebrow: 'Solicitud técnica', title: 'Médico solicita acceso', summary: 'Se crea una solicitud sintética sin campos personales.', status: 'Pendiente de revisión', source: 'fixture-local' },
  { phase: 'doctor-operational', journeyStep: 3, role: 'admin', eyebrow: 'Gate administrativo', title: 'Médico habilitado para la demo', summary: 'La aprobación sólo cambia el estado operativo del fixture.', status: 'Operativo · demo', source: 'fixture-local' },
  { phase: 'availability-published', journeyStep: 4, role: 'doctor', eyebrow: 'Agenda sintética', title: 'Disponibilidad publicada', summary: 'Un bloque horario abstracto queda visible sin información de contacto.', status: '1 bloque disponible', source: 'fixture-local' },
  { phase: 'appointment-booked', journeyStep: 5, role: 'patient', eyebrow: 'Reserva sintética', title: 'Paciente reserva un bloque', summary: 'La reserva vincula únicamente referencias opacas locales.', status: 'Reserva confirmada · demo', source: 'fixture-local' },
  { phase: 'consultation-complete', journeyStep: 6, role: 'doctor', eyebrow: 'Decisión representada', title: 'Consentimiento y decisión demo', summary: 'El escenario afirma sólo que los gates sintéticos fueron marcados; no es una evaluación real.', status: 'Elegibilidad sintética activa', source: 'gate-local' },
  { phase: 'receipt-active', journeyStep: 7, role: 'doctor', eyebrow: 'Receipt local', title: 'Receipt preparado en modo simulado', summary: 'La UI refleja el estado esperado de ReceiptLedgerV2; no firma, envía ni consulta la red.', status: 'Activo · versión de estado 1', source: 'gate-local' },
  { phase: 'directory-enabled', journeyStep: 8, role: 'patient', eyebrow: 'Acceso condicionado', title: 'Directorio habilitado', summary: 'El directorio aparece sólo cuando elegibilidad y receipt sintéticos están activos.', status: '1 dispensario técnico', source: 'gate-local' },
  { phase: 'dispense-partial', journeyStep: 9, role: 'dispensary', eyebrow: 'Verificación mínima', title: 'Evento parcial registrado', summary: 'El QR opaco coincide y se registra un evento local con estado mínimo.', status: 'Parcial · versión de estado 2', source: 'gate-local' },
  { phase: 'dispense-complete', journeyStep: 9, role: 'dispensary', eyebrow: 'Cierre sintético', title: 'Evento total registrado', summary: 'El receipt pasa a consumido en la simulación y un segundo uso queda bloqueado.', status: 'Dispensado · versión de estado 3', source: 'gate-local' },
  { phase: 'admin-audit', journeyStep: 10, role: 'admin', eyebrow: 'Trazabilidad técnica', title: 'Admin revisa la auditoría', summary: 'La bitácora muestra roles, secuencia y estados mínimos.', status: 'Secuencia completa · local', source: 'fixture-local' },
] as const;

export function pilotPublicProjection(phase: string, token: string): PublicReceiptProjection {
  let receipt = applySyntheticOperation(createSyntheticReceipt(), { kind: 'issue', operationId: 'pilot-public-issued' });
  if (['dispense-partial', 'dispense-complete', 'admin-audit'].includes(phase)) {
    receipt = applySyntheticOperation(receipt, { kind: 'dispense-partial', operationId: 'pilot-public-partial', units: 1 });
  }
  if (['dispense-complete', 'admin-audit'].includes(phase)) {
    receipt = applySyntheticOperation(receipt, { kind: 'dispense-partial', operationId: 'pilot-public-total', units: 1 });
  }
  return matchesSyntheticToken(token, receipt) ? publicProjection(receipt) : UNAVAILABLE_PUBLIC_RECEIPT;
}
