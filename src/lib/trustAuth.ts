import { GoogleAuthProvider, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

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
        await setDoc(userRef, {
          uid: result.user.uid,
          name: result.user.displayName || 'Paciente Registrado',
          email: result.user.email || '',
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Error registering user in Firestore:', err);
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
