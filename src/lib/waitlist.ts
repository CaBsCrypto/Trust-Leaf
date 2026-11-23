export const CANNABIS_WAITLIST_PATH = '/api/cannabis-waitlist';
export const CANNABIS_WAITLIST_REVIEW_MODE = 'waitlist-local';
export const waitlistAudiences = ['patient', 'doctor', 'dispensary'] as const;
export type WaitlistAudience = typeof waitlistAudiences[number];
