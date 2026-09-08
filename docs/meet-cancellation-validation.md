# Meet: cancellation and new booking validation

## Starting evidence

The user confirmed that doctor and patient received the invitation, joined the
same meeting and could communicate with sound. Video and other media conditions
must not be inferred from that confirmation.

Keep booking `88bb2f83-1b5b-48be-9404-5d9015a27b44` unchanged. Use a separate,
future technical appointment with the existing test participants and no clinical data.

## Manual sequence

1. Doctor signs in at `/medico`, publishes one new future slot in the agenda.
2. Patient signs in at `/paciente` and reserves that slot. Check both agendas
   show the same appointment, a ready Meet link and the correct time zone.
3. Patient selects `Cancelar cita` for this new test appointment and confirms.
4. Refresh both agendas. The booking must no longer offer a join action.
   Verify the Calendar job reaches `cancelled` and the Google event is cancelled;
   record whether both cancellation notifications arrive.
5. Doctor publishes a different future slot, patient reserves it. Verify a new
   booking and a different Meet link, visible only to the assigned participants.
6. Verify that the former cancelled booking remains cancelled and that the new
   invitation reaches both participants without duplicated events.

Use separate browser profiles/devices for simultaneous roles. Tabs in the same
browser share the Privy session; another tab is not an isolated identity.

## Acceptance boundaries

- Current rescheduling is cancellation plus a new reservation, not an atomic move.
- Google event cancellation does not prove the old Meet URL is immediately revoked.
  Independently check old-link behavior; do not describe cancellation as room deletion.
- Local worker and SQL tests cover retries, cancellation and stale-result rejection.
  They do not prove Google notification delivery or the browser cancellation flow.
- Pending: execute and record every step above in the official site.
- Institutional organizer email is deferred until after functional validation.
