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
    const userRef = doc(db, 'users', result.user.uid);
    let userSnap = await getDoc(userRef);
    const exists = userSnap.exists();
    let userData = exists ? userSnap.data() : null;

    if (!exists) {
      const isAdmin = result.user.email?.toLowerCase() === 'cabscryptocontacto@gmail.com';
      
      if (isAdmin) {
        console.log('[Auth Real] Detectado usuario administrador. Registrando sin Passkey...');
        await registerUserWithWallet(
          result.user.uid,
          result.user.displayName || 'Administrador',
          result.user.email || '',
          'GB2PFKB24QPIEB3VIKYTIEG7M4KRH5I4KBPV26LUC6KOE2YAWSCPXKZ6', // Cuenta readonly por defecto
          'freighter', // Admin no requiere passkey
          'admin'
        );
        userSnap = await getDoc(userRef);
        userData = userSnap.data();
        return {
          user: result.user,
          exists: true,
          userData
        };
      }

      // Return exists: false so frontend prompts for role selection
      return {
        user: result.user,
        exists: false,
        userData: null
      };
    }

    return {
      user: result.user,
      exists: true,
      userData
    };
  }
  return null;
}

export async function registerNewUserRole(
  user: User,
  role: 'patient' | 'doctor' | 'dispensary'
) {
  const userRef = doc(db, 'users', user.uid);
  let stellarPublicKey = '';
  let primaryMethod: 'passkey' | 'freighter' = 'passkey';
  let credentialId = '';

  try {
    if (role === 'patient') {
      console.log('[Auth Real] Creando Passkey para Paciente...');
      const passkey = await createPasskeyWallet(user.email || user.displayName || 'Paciente');
      stellarPublicKey = passkey.contractId;
      credentialId = passkey.keyId;
    } else {
      console.log(`[Auth Real] Derivando wallet determinística para ${role}...`);
      const derived = await deriveStellarPublicKey(user.email || '');
      stellarPublicKey = derived || 'GB2PFKB24QPIEB3VIKYTIEG7M4KRH5I4KBPV26LUC6KOE2YAWSCPXKZ6';
      primaryMethod = 'freighter';
    }

    await registerUserWithWallet(
      user.uid,
      user.displayName || (role === 'doctor' ? 'Médico' : 'Dispensario'),
      user.email || '',
      stellarPublicKey,
      primaryMethod,
      role
    );

    if (credentialId) {
      await setDoc(userRef, { credentialId }, { merge: true });
    }

    const userSnap = await getDoc(userRef);
    return userSnap.data();
  } catch (err) {
    console.error('[Auth Real] Error al registrar rol y wallet:', err);
    await signOut(auth);
    throw err;
  }
}


export async function registerUserWithWallet(
  uid: string,
  name: string,
  email: string,
  stellarPublicKey: string,
  primaryMethod: 'passkey' | 'freighter',
  role: string = 'patient'
) {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, {
    uid,
    name,
    email,
    stellarPublicKey,
    primaryMethod,
    role,
    createdAt: new Date().toISOString()
  });
  
  // Fund the newly mapped account in testnet via faucet API
  try {
    console.log('[Auth Real] Fondeando cuenta en Stellar Testnet...');
    const faucetResponse = await fetch('/api/stellar/faucet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role,
        address: stellarPublicKey
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
