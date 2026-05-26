import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();

export function getFirebaseRuntimeStatus() {
  return {
    configured: Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.authDomain),
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
  };
}
