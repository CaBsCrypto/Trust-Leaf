import { useState } from 'react';
import { usePrivySessionSync } from '../../src/components/usePrivySessionSync';

// Synthetic identity storage is exclusively for this excluded browser fixture.
export default function CrossTabSessionFixture() {
  const [actor, setActor] = useState(() => localStorage.getItem('qa.actor') ?? 'doctor');
  const [invalidated, setInvalidated] = useState(false);
  const syncing = usePrivySessionSync(true, actor !== 'signed-out', actor === 'signed-out' ? undefined : `fixture:${actor}`, () => setInvalidated(true));
  const change = (next: string) => { localStorage.setItem('qa.actor', next); setActor(next); };
  return <main>
    <p data-testid="actor">{syncing || invalidated ? 'verifying' : actor}</p>
    <button onClick={() => change('patient')}>Switch to patient</button>
    <button onClick={() => change('signed-out')}>Sign out</button>
  </main>;
}
