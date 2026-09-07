import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import PrivyAgenda from '../../src/components/PrivyAgenda';
import PrivySessionBoundary from '../../src/components/PrivySessionBoundary';
import CrossTabSessionFixture from './CrossTabSessionFixture';
import { TrustLeafPrivyContext } from '../../src/components/privyIdentityContext';
import './style.css';
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
  useEffect(() => {
    const change = (event: Event) => setActor((event as CustomEvent<string>).detail);
    window.addEventListener('fixture-identity', change);
    return () => window.removeEventListener('fixture-identity', change);
  }, []);
  return <TrustLeafPrivyContext.Provider value={{enabled:true,ready:true,authenticated:actor!=='signed-out',tokenReady:true,subject:actor==='signed-out'?undefined:`did:privy:fixture-${actor}`,getIdentityToken:async()=>`fixture-${actor}`,beginLogin:async()=>{},logout:async()=>{}}}><main className="mx-auto max-w-5xl p-4 sm:p-8">{new URLSearchParams(location.search).has('sessionProbe') ? <PrivySessionBoundary><SessionProbe actor={actor}/></PrivySessionBoundary> : <PrivyAgenda email={`${actor}@example.test`}/>}</main></TrustLeafPrivyContext.Provider>;
}
createRoot(document.getElementById('root')!).render(new URLSearchParams(location.search).has('crossTab') ? <CrossTabSessionFixture/> : <Fixture/>);
