import React from 'react';
import { createRoot } from 'react-dom/client';
import PrivyAgenda from '../../src/components/PrivyAgenda';
import { TrustLeafPrivyContext } from '../../src/components/privyIdentityContext';
import './style.css';
// This isolated fixture is excluded from Vercel. It cannot authenticate against production.
const role=new URLSearchParams(location.search).get('role') ?? 'doctor';
createRoot(document.getElementById('root')!).render(<TrustLeafPrivyContext.Provider value={{enabled:true,ready:true,authenticated:true,tokenReady:true,subject:`did:privy:fixture-${role}`,getIdentityToken:async()=>`fixture-${role}`,beginLogin:async()=>{},logout:async()=>{}}}><main className="mx-auto max-w-5xl p-4 sm:p-8"><PrivyAgenda email={`${role}@example.test`}/></main></TrustLeafPrivyContext.Provider>);
