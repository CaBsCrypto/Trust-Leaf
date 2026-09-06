import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import PrivyAgenda from '../../src/components/PrivyAgenda';
import { TrustLeafPrivyContext } from '../../src/components/privyIdentityContext';
import './style.css';
// This isolated fixture is excluded from Vercel. It cannot authenticate against production.
const role=new URLSearchParams(location.search).get('role') ?? 'doctor';
function Fixture() {
  const [actor, setActor] = useState(role);
  useEffect(() => {
    const change = (event: Event) => setActor((event as CustomEvent<string>).detail);
    window.addEventListener('fixture-identity', change);
    return () => window.removeEventListener('fixture-identity', change);
  }, []);
  return <TrustLeafPrivyContext.Provider value={{enabled:true,ready:true,authenticated:true,tokenReady:true,subject:`did:privy:fixture-${actor}`,getIdentityToken:async()=>`fixture-${actor}`,beginLogin:async()=>{},logout:async()=>{}}}><main className="mx-auto max-w-5xl p-4 sm:p-8"><PrivyAgenda email={`${actor}@example.test`}/></main></TrustLeafPrivyContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
