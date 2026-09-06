import { Fragment, type ReactNode } from 'react';
import { useTrustLeafPrivyIdentity } from './privyIdentityContext';

/** Retire all actor-local UI state, including late responses, with the identity. */
export default function PrivySessionBoundary({ children }: { children: ReactNode }) {
  const identity = useTrustLeafPrivyIdentity();
  const scope = identity.enabled
    ? JSON.stringify([identity.ready, identity.authenticated, identity.subject ?? null])
    : 'legacy';
  return <Fragment key={scope}>{children}</Fragment>;
}
