import { getTechnicalAdminFixture, type TechnicalAdminAccess } from '../lib/technicalAdminFixtures';

export function TechnicalAdminOversightPanel({ access }: { access: TechnicalAdminAccess }) {
  const model = getTechnicalAdminFixture(access);
  if (model.mode === 'denied') return <section aria-live="polite"><h2>Supervisión técnica</h2><p>Acceso cerrado.</p></section>;
  return <section className="rounded-3xl border border-brand-green-deep/10 bg-white p-6" aria-labelledby="technical-admin-title">
    <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-green-mid">Fixtures sintéticos · read-only</p>
    <h2 id="technical-admin-title" className="mt-2 text-2xl font-bold">Supervisión técnica mínima</h2>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <Queue title="Profesionales" rows={model.queues.professionals}/>
      <Queue title="Dispensarios" rows={model.queues.dispensaries}/>
      <Queue title="Pacientes operativos" rows={model.queues.patients}/>
      <Queue title="Receipts / trace" rows={model.receipts.map(item => ({ ref: item.ref, status: `${item.state} · ${item.finality}` }))}/>
    </div>
    <h3 className="mt-6 font-bold">Alertas de excepción</h3>
    <ul className="mt-2 space-y-2">{model.alerts.map(alert => <li key={alert.code} className="rounded-xl bg-amber-50 p-3 text-xs"><strong>{alert.severity}</strong> · {alert.code}</li>)}</ul>
    <div className="mt-5 flex flex-wrap gap-2"><button type="button" disabled>Verificar actor</button><button type="button" disabled>Suspender actor</button><button type="button" disabled>Resolver alerta</button></div>
    <p className="mt-3 text-xs text-brand-green-mid">Acciones deshabilitadas hasta auth real, autorización por objeto y auditoría durable.</p>
  </section>;
}

function Queue({ title, rows }: { title: string; rows: readonly { ref: string; status: string }[] }) {
  return <section className="rounded-2xl bg-brand-neutral p-4"><h3 className="font-bold">{title}</h3><ul className="mt-3 space-y-2">{rows.map(row => <li key={row.ref} className="text-xs"><span className="font-mono">{row.ref}</span><span className="ml-2 capitalize">{row.status.replaceAll('_', ' ')}</span></li>)}</ul></section>;
}
