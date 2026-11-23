import { Activity, ArrowRight, CalendarDays } from 'lucide-react';
import type { Booking, Encounter } from './contracts';
import './doctor-overview.css';

const appointmentDate = new Intl.DateTimeFormat('es-CL', {
  timeZone: 'America/Santiago',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export default function DoctorOverview({ bookings, encounters, onAgenda, onConsultations }: {
  bookings: Booking[];
  encounters: Encounter[];
  onAgenda: () => void;
  onConsultations?: () => void;
}) {
  const encounterByBooking = new Map(encounters.map(encounter => [encounter.booking_ref, encounter.state]));
  const now = Date.now();
  let active = 0;
  let completed = 0;
  let pending = 0;
  let nextAppointment: number | undefined;

  for (const booking of bookings) {
    if (booking.state === 'cancelled') continue;
    const encounter = encounterByBooking.get(booking.booking_ref);
    if (encounter === 'active') active++;
    if (encounter === 'completed') completed++;
    if (encounter || booking.state !== 'confirmed') continue;

    pending++;
    const start = Date.parse(booking.starts_at);
    if (start >= now && (nextAppointment === undefined || start < nextAppointment)) {
      nextAppointment = start;
    }
  }

  return (
    <section className="doctor-overview" aria-label="Resumen de consultas">
      <div className="doctor-overview-heading">
        <h2>Resumen de consultas</h2>
        {onConsultations && (
          <button type="button" className="doctor-overview-action" onClick={onConsultations}>
            Ver consultas en curso <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="doctor-overview-cards">
        <div className="doctor-overview-card">
          <div className="doctor-overview-icon"><Activity size={20} aria-hidden="true" /></div>
          <dl className="doctor-overview-counts">
            <div className="doctor-overview-active">
              <dt>Consultas en curso</dt>
              <dd>{active}</dd>
            </div>
            <div>
              <dt>Pendientes</dt>
              <dd>{pending}</dd>
            </div>
            <div>
              <dt>Finalizadas</dt>
              <dd>{completed}</dd>
            </div>
          </dl>
        </div>
        <div className="doctor-overview-card doctor-overview-appointment">
          <div className="doctor-overview-icon"><CalendarDays size={20} aria-hidden="true" /></div>
          <div className="doctor-overview-appointment-details">
            <h3>Próxima cita confirmada</h3>
            {nextAppointment === undefined ? (
              <p>Sin próximas citas confirmadas</p>
            ) : (
              <time dateTime={new Date(nextAppointment).toISOString()}>{appointmentDate.format(nextAppointment)} (Chile continental)</time>
            )}
          </div>
          <button type="button" className="doctor-overview-action" onClick={onAgenda}>
            Ver agenda <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
