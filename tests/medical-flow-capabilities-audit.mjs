import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8');
const sources = {
  app: read('src/App.tsx'),
  portal: read('src/components/MockupPortal.tsx'),
  data: read('src/lib/trustData.ts'),
  rules: read('firestore.rules'),
  critical: read('tests/critical-demo-routes.mjs'),
  pilotSafety: read('tests/pilot-safety.test.ts'),
};

const hasAll = (source, patterns) => patterns.every((pattern) => source.includes(pattern));
const collectionAllowed = (name) => sources.rules.includes(`match /${name}/`);

const capabilities = [
  {
    id: 'doctor-profile',
    capability: 'Perfil médico',
    declared: 'partial',
    route: sources.app.includes("path === '/medico'"),
    control: hasAll(sources.app, ['DoctorRegistrationRoute', 'doctorRegistrations']),
    persistence: hasAll(sources.data, ['loadDoctorApplications', 'createDoctorApplication']),
    evidence: 'Alta/perfil de solicitud en /medico; no existe editor de perfil profesional operativo separado.',
    limitation: 'La ficha pública usa datos de solicitud/fixtures; no hay perfil profesional versionado ni prueba E2E.',
  },
  {
    id: 'doctor-availability',
    capability: 'Disponibilidad y agenda',
    declared: 'demo-local',
    route: sources.app.includes("path === '/medico/operacion'"),
    control: hasAll(sources.portal, ['handleAddAgendaBlock', 'toggleAgendaBlockStatus', 'Agenda de Consultas']),
    persistence: hasAll(sources.data, ['loadAgenda', 'createAgendaBlock', 'updateAgendaBlock']),
    cloudRules: collectionAllowed('agenda'),
    evidence: 'Bloques disponibles/reservados y controles de alta/cambio; localStorage más intentos Firestore.',
    limitation: 'main no define reglas /agenda: Firestore niega lectura/escritura; solo el fallback demo es confiable.',
  },
  {
    id: 'patient-booking',
    capability: 'Reserva de paciente',
    declared: 'demo-ui',
    route: hasAll(sources.app, ["const PATIENT_VIEWS", "'doctors'", "'/paciente': 'overview'"]),
    control: hasAll(sources.portal, ['handleCompleteBooking', 'Agendar tu Consulta', "setBookingStep('success')"]),
    persistence: hasAll(sources.portal, ["doc(db, 'agenda'", "doc(db, 'notifications'"]),
    cloudRules: collectionAllowed('agenda') && collectionAllowed('notifications'),
    evidence: 'Modal de fecha/hora y confirmación visual; intenta escribir agenda y notificación.',
    limitation: 'Muestra éxito antes de confirmar persistencia; reglas actuales niegan ambas colecciones.',
  },
  {
    id: 'clinical-summary',
    capability: 'Ficha resumida',
    declared: 'synthetic',
    route: sources.app.includes("'/paciente/historial': 'history'"),
    control: hasAll(sources.portal, ['PRIVATE_CLINICAL_DOSSIER', 'selectedClinicalRecord', 'portableClinicalDossier']),
    persistence: hasAll(sources.data, ['loadClinicalRecords', 'createClinicalRecord']),
    cloudRules: false,
    evidence: 'Galería/modal de ficha y registros de consulta; incluye fixtures y almacenamiento local.',
    limitation: 'La forma guardada por UI no satisface recordType/privatePayloadRef exigidos por reglas Firestore.',
  },
  {
    id: 'consultation-note',
    capability: 'Atención y nota',
    declared: 'experimental-demo',
    route: sources.app.includes("path === '/medico/operacion'"),
    control: hasAll(sources.portal, ['openConsultationFromBlock', 'saveConsultationSummaryToRecord', 'setConsultationStatus']),
    persistence: hasAll(sources.portal, ['encryptText(summary', 'createClinicalRecord']),
    cloudRules: false,
    evidence: 'Iniciar/finalizar consulta, redactar resumen y cifrado AES-GCM cliente experimental.',
    limitation: 'Estado de consulta vive en React/localStorage; persistencia clínica Firestore es incompatible con sus reglas.',
  },
  {
    id: 'follow-up-patients',
    capability: 'Pacientes en seguimiento',
    declared: 'derived-demo',
    route: sources.app.includes("path === '/medico/operacion'"),
    control: hasAll(sources.portal, ['doctorActivePatients', 'DOCTOR_SESSION_PATIENTS', 'Acceso Revocado']),
    persistence: sources.portal.includes('privacyPermissions'),
    evidence: 'Lista derivada de consentimientos activos/revocados y fixtures de sesión demo.',
    limitation: 'No existe entidad persistente doctor-paciente/plan de seguimiento ni prueba multiusuario.',
  },
  {
    id: 'prescription-states',
    capability: 'Estados de receta',
    declared: 'demo-testnet',
    route: sources.app.includes("'/paciente/recetas': 'prescriptions'"),
    control: hasAll(sources.portal, ["status: 'active' | 'used' | 'expired'", 'Receta vigente', 'Receta expirada']),
    persistence: hasAll(sources.portal, ['patientDashboard?.prescriptions', 'DEMO / NO VÁLIDA']),
    tested: sources.critical.includes('DEMO / NO VÁLIDA') && sources.pilotSafety.includes('pilot-safety'),
    evidence: 'UI diferencia active/used/expired y combina dashboard testnet con vista previa demo no válida.',
    limitation: 'No acredita validez clínica; la rama lifecycle añade estados más estrictos pero no está integrada en main.',
  },
  {
    id: 'alerts',
    capability: 'Alertas',
    declared: 'partial-demo',
    route: sources.app.includes("path === '/medico/operacion'"),
    control: hasAll(sources.portal, ['showNotificationDropdown', 'notifications.filter', 'onSnapshot(q']),
    persistence: sources.portal.includes("collection(db, 'notifications')"),
    cloudRules: collectionAllowed('notifications'),
    evidence: 'Campana, contador, fixture inicial y listener Firestore para reservas.',
    limitation: 'Reglas main niegan notifications; no hay motor probado de alertas de vencimiento/seguimiento.',
  },
  {
    id: 'dispensary-directory',
    capability: 'Directorio de dispensarios',
    declared: 'synthetic-mixed',
    route: sources.app.includes("'/paciente/dispensarios': 'dispensaries'"),
    control: hasAll(sources.portal, ['selectedDispensary', 'switchView(\'dispensaries\')']),
    persistence: hasAll(sources.app, ['approvedDispensaryRegistrations', 'dispensaryRegistrations']),
    evidence: 'Vista de dispensarios y flujo de selección; mezcla catálogo fixture con solicitudes aprobadas.',
    limitation: 'No demuestra directorio productivo, compatibilidad clínica, stock real ni geolocalización confiable.',
  },
  {
    id: 'authorization-roles',
    capability: 'Autorización y roles',
    declared: 'demo-gated',
    route: hasAll(sources.app, ["hasRoleSession('doctor')", "hasRoleSession('dispensary')"]),
    control: hasAll(sources.app, ['doctorCanOperate', 'dispensaryCanOperate']),
    persistence: sources.rules.includes('function isAdmin()'),
    cloudRules: false,
    evidence: 'Guardas de ruta y estados de aprobación; mutaciones críticas tienen gates estáticos.',
    limitation: 'main permite operación por session.mode=demo y sus reglas RBAC clínicas tienen brechas conocidas.',
  },
];

const byId = new Map(capabilities.map((item) => [item.id, item]));
const presentedClaims = [
  { id: 'doctor-profile', source: sources.app, marker: 'Registro médico' },
  { id: 'doctor-availability', source: sources.portal, marker: 'Agenda de Consultas' },
  { id: 'patient-booking', source: sources.portal, marker: 'Agendar tu Consulta' },
  { id: 'clinical-summary', source: sources.portal, marker: 'Ficha clínica' },
  { id: 'consultation-note', source: sources.portal, marker: 'Resumen clínico' },
  { id: 'follow-up-patients', source: sources.portal, marker: "['Pacientes', DOCTOR_SESSION_PATIENTS.length]" },
  { id: 'prescription-states', source: sources.portal, marker: 'Receta vigente' },
  { id: 'alerts', source: sources.portal, marker: 'Notificaciones' },
  { id: 'dispensary-directory', source: sources.app, marker: '/paciente/dispensarios' },
];

for (const item of capabilities) {
  assert.equal(item.route, true, `${item.capability}: se declara pero falta ruta`);
  assert.equal(item.control, true, `${item.capability}: se declara pero falta control/pantalla`);
  assert.equal(item.persistence, true, `${item.capability}: se declara persistencia/estado pero falta implementación`);
}

for (const claim of presentedClaims) {
  const item = byId.get(claim.id);
  assert.ok(item, `claim sin capability registrada: ${claim.id}`);
  assert.ok(claim.source.includes(claim.marker), `${item.capability}: la afirmación visible esperada desapareció; actualizar auditoría`);
  assert.equal(item.route, true, `${item.capability}: se presenta en UI pero falta ruta alcanzable`);
  assert.equal(item.control, true, `${item.capability}: se presenta en UI pero falta pantalla/control`);
}

console.log('\nTrustLeaf medical-flow capability audit (static, synthetic-safe)');
console.log('This command does not validate clinical legality, real identities, production data, or live mutations.\n');
console.table(capabilities.map(({ capability, declared, route, control, persistence, cloudRules, tested }) => ({
  capability,
  state: declared,
  route,
  control,
  persistence,
  cloudRules: cloudRules ?? 'n/a',
  tested: tested ?? 'static-only',
})));

console.log('\nCoverage details:');
for (const item of capabilities) {
  console.log(`- ${item.capability} [${item.declared}]`);
  console.log(`  Evidence: ${item.evidence}`);
  console.log(`  Gap: ${item.limitation}`);
}

const cloudBlocked = capabilities.filter((item) => item.cloudRules === false).map((item) => item.capability);
console.log(`\nCloud-persistence blockers detected: ${cloudBlocked.join(', ') || 'none'}.`);
console.log(`Static capability markers found: ${capabilities.length}/${capabilities.length}. Presented claims gated: ${presentedClaims.length}/${presentedClaims.length}.`);
console.log('Functionally verified production capabilities: 0.');
