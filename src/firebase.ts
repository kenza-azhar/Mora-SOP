import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import defaultAppletConfig from '../firebase-applet-config.json';

export interface FirebaseAppConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
  firestoreDatabaseId?: string;
}

const STORAGE_KEY = 'mora_custom_firebase_config';

export function getEffectiveFirebaseConfig(): FirebaseAppConfig {
  // 1. Check localStorage for custom user-configured credentials
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ignore stale deleted projects from older sessions
        if (parsed && parsed.apiKey && parsed.projectId && !parsed.projectId.includes('psychic-cascade')) {
          return {
            apiKey: parsed.apiKey || '',
            authDomain: parsed.authDomain || (parsed.projectId ? `${parsed.projectId}.firebaseapp.com` : ''),
            projectId: parsed.projectId || '',
            storageBucket: parsed.storageBucket || (parsed.projectId ? `${parsed.projectId}.firebasestorage.app` : ''),
            messagingSenderId: parsed.messagingSenderId || '',
            appId: parsed.appId || '',
            measurementId: parsed.measurementId || '',
            firestoreDatabaseId: parsed.firestoreDatabaseId || '(default)'
          };
        }
      }
    } catch (e) {
      console.warn('Error reading saved firebase config', e);
    }
  }

  // 2. Check Vite environment variables (e.g. deployed to Vercel with env vars)
  const metaEnv = (import.meta as any).env || {};
  const envApiKey = metaEnv.VITE_FIREBASE_API_KEY;
  if (envApiKey) {
    const envProj = metaEnv.VITE_FIREBASE_PROJECT_ID || '';
    return {
      apiKey: envApiKey,
      authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || (envProj ? `${envProj}.firebaseapp.com` : ''),
      projectId: envProj,
      storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || (envProj ? `${envProj}.firebasestorage.app` : ''),
      messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: metaEnv.VITE_FIREBASE_APP_ID || '',
      measurementId: metaEnv.VITE_FIREBASE_MEASUREMENT_ID || '',
      firestoreDatabaseId: metaEnv.VITE_FIREBASE_FIRESTORE_DATABASE_ID || '(default)'
    };
  }

  // 3. Fallback to default bundled applet config
  return {
    apiKey: defaultAppletConfig.apiKey || '',
    authDomain: defaultAppletConfig.authDomain || '',
    projectId: defaultAppletConfig.projectId || '',
    storageBucket: defaultAppletConfig.storageBucket || '',
    messagingSenderId: defaultAppletConfig.messagingSenderId || '',
    appId: defaultAppletConfig.appId || '',
    measurementId: defaultAppletConfig.measurementId || '',
    firestoreDatabaseId: defaultAppletConfig.firestoreDatabaseId || '(default)'
  };
}

export function saveCustomFirebaseConfig(config: FirebaseAppConfig) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }
}

export function clearCustomFirebaseConfig() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function hasCustomFirebaseConfig(): boolean {
  if (typeof window !== 'undefined') {
    return !!localStorage.getItem(STORAGE_KEY);
  }
  return false;
}

const activeConfig = getEffectiveFirebaseConfig();

export const app: FirebaseApp = getApps().length === 0 ? initializeApp(activeConfig) : getApp();

export const db: Firestore = activeConfig.firestoreDatabaseId && activeConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, activeConfig.firestoreDatabaseId)
  : getFirestore(app);

export const auth: Auth = getAuth(app);

