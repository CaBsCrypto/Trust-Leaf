export type OnboardingState = 'draft' | 'submitted' | 'changes_requested' | 'approved' | 'rejected';

export interface DispensaryApplicationProfile {
  managerName: string;
  phone: string;
  businessName: string;
  commune: string;
  address: string;
  activity: string;
  contactEmail: string;
}

export interface DispensaryApplication {
  applicationRef: string;
  state: OnboardingState;
  version: number;
  profile: DispensaryApplicationProfile;
  reason: string | null;
  organizationRef: string | null;
  updatedAt: string;
}

export type OnboardingCommand =
  | { action: 'list' | 'read-draft' }
  | { action: 'invite'; email: string; operationId: string }
  | { action: 'resend' | 'cancel'; invitationRef: string; operationId: string }
  | { action: 'retry-send'; invitationRef: string }
  | { action: 'inspect'; token: string }
  | { action: 'accept'; token: string; consent: boolean }
  | { action: 'save-draft'; applicationRef: string; version: number; profile: DispensaryApplicationProfile; operationId: string }
  | { action: 'submit'; applicationRef: string; version: number; consent: boolean; operationId: string }
  | { action: 'review'; applicationRef: string; version: number; decision: 'approve' | 'changes' | 'reject'; reason: string; operationId: string };

export const emptyApplicationProfile: DispensaryApplicationProfile = {
  managerName: '', phone: '', businessName: '', commune: '', address: '', activity: '', contactEmail: '',
};
