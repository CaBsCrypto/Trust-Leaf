import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createSessionChangeBus } from '../lib/sessionChangeBus';

export function usePrivySessionSync(ready: boolean, authenticated: boolean, subject: string | undefined, invalidate: () => void) {
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const invalidateRef = useRef(invalidate);
  const previous = useRef<string | undefined>(undefined);
  const bus = useRef<ReturnType<typeof createSessionChangeBus> | null>(null);
  useLayoutEffect(() => { invalidateRef.current = invalidate; });
  useLayoutEffect(() => {
    let reload: ReturnType<typeof setTimeout> | undefined;
    syncingRef.current = false;
    const connection = createSessionChangeBus(() => {
      syncingRef.current = true;
      invalidateRef.current();
      setSyncing(true);
      // Reload reads the SDK's persisted session; a message never grants access.
      reload = setTimeout(() => window.location.reload(), 0);
    });
    bus.current = connection;
    return () => { connection.close(); clearTimeout(reload); bus.current = null; };
  }, []);
  useEffect(() => {
    if (!ready || syncingRef.current) return;
    const identity = JSON.stringify([authenticated, subject ?? null]);
    const changed = previous.current !== undefined && previous.current !== identity;
    previous.current = identity;
    // Initial restoration must not broadcast and trigger a reload loop.
    if (changed) bus.current?.publish();
  }, [ready, authenticated, subject]);
  return syncing;
}
