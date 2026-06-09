import { GoogleAuthProvider, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { createPasskeyWallet } from './stellar/passkeys';
import { deriveStellarPublicKey } from './stellar/config';

export type AdminAuthMode = 'checking' | 'signed-out' | 'authorized' | 'not-admin' | 'demo';

export interface AdminAuthState {
  mode: AdminAuthMode;
  user: User | null;
  error?: string;
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  
  if (result.user) {
    try {
      const userRef = doc(db, 'users', result.user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        console.log('[Auth Real] Nuevo usuario detectado. Derivando Stellar Wallet...');
        
        const email = result.user.email || result.user.uid;
        const derivedWalletAddress = await deriveStellarPublicKey(email);
        
        console.log(`[Auth Real] Stellar Wallet derivado: ${derivedWalletAddress}`);

        // 2. Fondeo automático de la cuenta en Stellar Testnet llamando a la API
        try {
          console.log('[Auth Real] Fondeando cuenta en Stellar Testnet...');
          const faucetResponse = await fetch('/api/stellar/faucet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role: 'patient',
              address: derivedWalletAddress
            })
          });
          const faucetResult = await faucetResponse.json();
          if (faucetResponse.ok) {
            console.log('[Auth Real] Cuenta fondeada de forma exitosa en Testnet.', faucetResult);
          } else {
            console.warn('[Auth Real] Advertencia al fondear cuenta (Faucet):', faucetResult.message);
          }
        } catch (faucetErr) {
          console.error('[Auth Real] Error al intentar invocar faucet:', faucetErr);
        }

        // 3. Registrar el documento users/{uid} en Firestore mapeando la cuenta de Stellar
        await setDoc(userRef, {
          uid: result.user.uid,
          name: result.user.displayName || 'Paciente Registrado',
          email: result.user.email || '',
          stellarPublicKey: derivedWalletAddress,
          createdAt: new Date().toISOString()
        });
      } else {
        const userData = userSnap.data();
        console.log('[Auth Real] Usuario existente de Google detectado. Wallet vinculada:', userData.stellarPublicKey);
      }
    } catch (err) {
      console.error('Error registering user in Firestore / creating Passkey:', err);
    }
  }

  return result.user;
}

export function listenAdminAuth(callback: (state: AdminAuthState) => void) {
  callback({ mode: 'checking', user: auth.currentUser });

  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback({ mode: 'signed-out', user: null });
      return;
    }

    if (user.email?.toLowerCase() === 'cabscryptocontacto@gmail.com') {
      callback({
        mode: 'authorized',
        user,
      });
      return;
    }

    try {
      const adminDoc = await getDoc(doc(db, 'appAdministrators', user.uid));
      callback({
        mode: adminDoc.exists() ? 'authorized' : 'not-admin',
        user,
      });
    } catch (error) {
      callback({
        mode: 'not-admin',
        user,
        error: error instanceof Error ? error.message : 'No se pudo verificar permisos admin.',
      });
    }
  });
}

export async function signInAdmin(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function ensureActorAuthSession() {
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
}

export async function signOutAdmin() {
  await signOut(auth);
}
