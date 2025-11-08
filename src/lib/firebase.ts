import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth, connectAuthEmulator } from "firebase/auth";
import {
  getFirestore,
  Firestore,
  connectFirestoreEmulator,
} from "firebase/firestore";
import {
  getStorage,
  FirebaseStorage,
  connectStorageEmulator,
} from "firebase/storage";
import {
  getFunctions,
  Functions,
  connectFunctionsEmulator,
} from "firebase/functions";

/**
 * Configuração do Firebase
 * IMPORTANTE: Substitua com suas credenciais do projeto curva-mestra
 * Obtenha em: Firebase Console > Project Settings > General > Your apps
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "curva-mestra",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

// Inicializar Firebase apenas uma vez
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let functions: Functions;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Inicializar serviços
auth = getAuth(app);
db = getFirestore(app);
storage = getStorage(app);
functions = getFunctions(app, "southamerica-east1"); // São Paulo

// Conectar aos emuladores se estiver em desenvolvimento
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

  if (useEmulators) {
    try {
      connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
      connectFirestoreEmulator(db, "localhost", 8080);
      connectStorageEmulator(storage, "localhost", 9199);
      connectFunctionsEmulator(functions, "localhost", 5001);
      console.log("🔥 Firebase Emulators conectados");
    } catch (error) {
      console.warn("Emuladores já conectados ou erro ao conectar:", error);
    }
  }
}

export { app, auth, db, storage, functions };

/**
 * Helper para verificar se o usuário está autenticado
 */
export const isAuthenticated = (): boolean => {
  return auth.currentUser !== null;
};

/**
 * Helper para obter o token do usuário
 */
export const getUserToken = async (): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
};

/**
 * Helper para obter as custom claims do usuário
 */
export const getUserClaims = async (): Promise<any> => {
  const user = auth.currentUser;
  if (!user) return null;

  const idTokenResult = await user.getIdTokenResult();
  return idTokenResult.claims;
};

/**
 * Helper para verificar se o usuário é system_admin
 */
export const isSystemAdmin = async (): Promise<boolean> => {
  const claims = await getUserClaims();
  return claims?.is_system_admin === true;
};

/**
 * Helper para obter o tenant_id do usuário
 */
export const getUserTenantId = async (): Promise<string | null> => {
  const claims = await getUserClaims();
  return claims?.tenant_id || null;
};
