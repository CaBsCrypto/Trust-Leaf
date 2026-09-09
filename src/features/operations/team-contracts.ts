export type TeamCommand =
  | { action: 'list' }
  | { action: 'create'; email: string; operationId: string }
  | { action: 'resend' | 'cancel'; invitationRef: string; operationId: string }
  | { action: 'retry-send'; invitationRef: string }
  | { action: 'inspect'; token: string }
  | { action: 'accept'; token: string; acceptSyntheticOnly: true };
export type TeamInvitation = { invitationRef: string; email: string; state: 'pending' | 'accepted' | 'expired' | 'cancelled';
  expiresAt: string; deliveryState: 'queued' | 'sending' | 'sent' | 'delivered' | 'delayed' | 'failed' | 'uncertain' | 'bounced' | 'cancelled' };
export type TeamSnapshot = { invitationsEnabled: boolean; organization: { organization_ref: string; name: string };
  membership: { role: 'manager' | 'operator' }; members: { actorRef: string; role: 'manager' | 'operator'; email: string | null }[];
  invitations: TeamInvitation[] };
export type InvitationPreview = { accepted: boolean; organizationName: string; expiresAt?: string };

export const teamErrorMessage = (status: number, code?: string): string => {
  if (code === 'TEAM_DISABLED') return 'Las invitaciones aun no estan habilitadas.';
  if (code === 'TEAM_MAIL_SETUP_REQUIRED') return 'El envio de correo no esta configurado.';
  if (status === 401) return 'Inicia sesion nuevamente.';
  if (status === 403) return 'No hay acceso con esta cuenta. Verifica el correo invitado y los permisos.';
  if (status === 409) return 'La invitacion o la cuenta cambio. Actualiza antes de continuar.';
  if (status === 429) return 'Limite de envios alcanzado. Espera antes de reenviar.';
  if (status === 400) return 'Revisa el correo o los datos de la invitacion.';
  return 'No fue posible confirmar la operacion. Puedes reintentar sin duplicarla.';
};
