import { ArrowRight, CalendarDays, ClipboardList, FileText } from 'lucide-react';
import botanicalRelief from '../../assets/relieve-botanico.png';
import type { Booking, Encounter } from './contracts';
import './patient-overview.css';

const appointmentDate = new Intl.DateTimeFormat('es-CL', {
  timeZone: 'America/Santiago', weekday: 'long', day: 'numeric', month: 'long',
  hour: '2-digit', minute: '2-digit',
});

export default function PatientOverview({ bookings, encounters, onAgenda, onRecord, onTreatment }: {
  bookings: Booking[];
  encounters: Encounter[];
  onAgenda: (next?: Booking) => void;
  onRecord: () => void;
  onTreatment: () => void;
}) {
  const now = Date.now();
  const encounterByBooking = new Map(encounters.map(encounter => [encounter.booking_ref, encounter.state]));
  const confirmed = bookings
    .map(booking => ({
      booking,
      start: Date.parse(booking.starts_at),
      end: Date.parse(booking.ends_at),
      state: encounterByBooking.get(booking.booking_ref),
    }))
    .filter(item => item.booking.state === 'confirmed' && item.state !== 'completed' && Number.isFinite(item.start))
    .sort((a, b) => a.start - b.start);
  const inProgress = confirmed.find(item => item.state === 'active');
  const current = confirmed.find(item => item.start <= now && now < item.end);
  const next = confirmed.find(item => item.start > now);
  const appointment = (inProgress ?? current ?? next)?.booking;
  const agendaHeading = inProgress ? 'Consulta en curso' : current ? 'Cita actual' : 'Próxima cita';
  const agendaLabel = inProgress ? 'Ver consulta en agenda' : current ? 'Ver cita en agenda' : next ? 'Ver próxima cita' : 'Ir a la agenda';

  return (
    <section className="op-patient-overview" aria-label="Resumen de mi atención">
      <div className="op-primary-task">
        <span className="op-task-icon"><CalendarDays size={22} aria-hidden="true" /></span>
        <div>
          <h2>{agendaHeading}</h2>
          <p>{appointment ? <time dateTime={appointment.starts_at}>{appointmentDate.format(new Date(appointment.starts_at))}</time> : 'No tienes una cita próxima.'}</p>
        </div>
        <button className="op-command op-task-action" type="button" onClick={() => onAgenda(appointment)}>
          {agendaLabel}<ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="op-patient-links">
        <button className="op-patient-link" type="button" onClick={onRecord}>
          <span className="op-patient-link-icon"><ClipboardList size={21} aria-hidden="true" /></span>
          <span><strong>Mi ficha de atención</strong><small>Citas y notas finalizadas</small></span>
          <ArrowRight size={16} aria-hidden="true" />
        </button>
        <button className="op-patient-link op-patient-link-treatment" type="button" onClick={onTreatment}>
          <span className="op-patient-link-icon"><FileText size={21} aria-hidden="true" /></span>
          <span><strong>Mis tratamientos</strong><small>Vigencia, saldo y permisos</small></span>
          <ArrowRight size={16} aria-hidden="true" />
          <img className="op-patient-link-relief" src={botanicalRelief} alt="" width={400} height={400} decoding="async" />
        </button>
      </div>
    </section>
  );
}
