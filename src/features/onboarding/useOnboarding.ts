import { useEffect, useRef, useState } from 'react';
import { useTrustLeafPrivyIdentity } from '../../components/privyIdentityContext';
import { onboardingRequest } from './api';
import type { OnboardingCommand } from './contracts';

export function useOnboarding() {
  const identity = useTrustLeafPrivyIdentity();
  const controller = useRef(new AbortController());
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<OnboardingCommand | null>(null);
  useEffect(() => { controller.current = new AbortController(); return () => controller.current.abort(); }, []);
  async function execute<T>(command: OnboardingCommand): Promise<T | undefined> {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setPending(command);
    try {
      const result = await onboardingRequest<T>(identity, command, controller.current.signal);
      if (controller.current.signal.aborted) return;
      setPending(null); return result;
    } catch (e) {
      if (!controller.current.signal.aborted) {
        setError((e as Error).message);
        if ([400,401,403,409,429].includes((e as { status?: number }).status ?? 0)) setPending(null);
      }
    } finally { if (!controller.current.signal.aborted) { lock.current = false; setBusy(false); } }
  }
  return { identity, execute, busy, error, pending };
}
