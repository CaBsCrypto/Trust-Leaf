import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import PrivyAgenda from '../../src/components/PrivyAgenda';
import PrivySessionBoundary from '../../src/components/PrivySessionBoundary';
import CrossTabSessionFixture from './CrossTabSessionFixture';
import { TrustLeafPrivyContext } from '../../src/components/privyIdentityContext';
import './style.css';
import OperationsWorkspace from '../../src/features/operations/OperationsWorkspace';
import CalendarOperations from '../../src/components/CalendarOperations';
import TeamInvitationGate from '../../src/features/operations/TeamInvitationGate';
import { captureTeamInvitation } from '../../src/features/operations/team-api';
// This isolated fixture is excluded from Vercel. It cannot authenticate against production.
const role=new URLSearchParams(location.search).get('role') ?? 'doctor';
function SessionProbe({ actor }: { actor: string }) {
  const [email, setEmail] = useState('');
  async function verify() {
    const response = await fetch(`/fixture-session?actor=${actor}`);
    const result = await response.json();
    setEmail(result.email);
  }
  return <><button onClick={() => void verify()}>Verify fixture session</button><p data-testid="session-email">{email}</p></>;
}
function Fixture() {
  const [actor, setActor] = useState(role);
  const [teamToken] = useState(captureTeamInvitation);
  const tokenGate = useRef<{ promise: Promise<void>; release: () => void } | null>(null);
  useEffect(() => {
    const change = (event: Event) => setActor((event as CustomEvent<string>).detail);
    window.addEventListener('fixture-identity', change);
    return () => window.removeEventListener('fixture-identity', change);
  }, []);
  useEffect(() => {
    const hold = () => {
      tokenGate.current?.release();
      let release = () => {};
      const promise = new Promise<void>(resolve => { release = resolve; });
      tokenGate.current = { promise, release };
    };
    const release = () => { tokenGate.current?.release(); tokenGate.current = null; };
    window.addEventListener('fixture-hold-token', hold); window.addEventListener('fixture-release-token', release);
    return () => { release(); window.removeEventListener('fixture-hold-token', hold); window.removeEventListener('fixture-release-token', release); };
  }, []);
  return <TrustLeafPrivyContext.Provider value={{enabled:true,ready:true,authenticated:actor!=='signed-out',email:actor==='signed-out'?undefined:`${actor}@example.test`,tokenReady:true,subject:actor==='signed-out'?undefined:`did:privy:fixture-${actor}`,getIdentityToken:async()=>{await tokenGate.current?.promise;return `fixture-${actor}`;},beginLogin:async()=>{},logout:async()=>{setActor('signed-out');}}}><main className="mx-auto max-w-5xl p-4 sm:p-8">{teamToken ? <TeamInvitationGate token={teamToken}/> : new URLSearchParams(location.search).has('calendarOperations') ? <CalendarOperations/> : new URLSearchParams(location.search).has('operations') ? <OperationsWorkspace email={`${actor}@example.test`}/> : new URLSearchParams(location.search).has('sessionProbe') ? <PrivySessionBoundary><SessionProbe actor={actor}/></PrivySessionBoundary> : <PrivyAgenda email={`${actor}@example.test`}/>}</main></TrustLeafPrivyContext.Provider>;
}
createRoot(document.getElementById('root')!).render(new URLSearchParams(location.search).has('crossTab') ? <CrossTabSessionFixture/> : <Fixture/>);
