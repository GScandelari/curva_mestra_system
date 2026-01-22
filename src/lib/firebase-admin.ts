/**
 * Firebase Admin SDK - Inicialização Centralizada
 * Usa variáveis de ambiente para credenciais (seguro para CI/CD)
 */

import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let adminApp: App | undefined;

/**
 * Inicializa o Firebase Admin SDK
 * Suporta tanto arquivo local (dev) quanto variáveis de ambiente (CI/CD)
 */
export function getAdminApp(): App {
  if (adminApp) {
    return adminApp;
  }

  const apps = getApps();
  if (apps.length > 0) {
    adminApp = apps[0];
    return adminApp;
  }

  try {
    // Opção 1: Usar variáveis de ambiente (CI/CD)
    if (process.env.FIREBASE_ADMIN_CREDENTIALS) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
      adminApp = initializeApp({
        credential: cert(serviceAccount),
      });
      console.log("[Firebase Admin] Inicializado com credenciais de ambiente");
      return adminApp;
    }

    // Opção 2: Usar arquivo local (desenvolvimento)
    try {
      const serviceAccount = require("../../curva-mestra-firebase-adminsdk.json");
      adminApp = initializeApp({
        credential: cert(serviceAccount),
      });
      console.log("[Firebase Admin] Inicializado com arquivo local");
      return adminApp;
    } catch (fileError) {
      console.error("[Firebase Admin] Arquivo de credenciais não encontrado");
      throw new Error(
        "Firebase Admin SDK não configurado. Configure FIREBASE_ADMIN_CREDENTIALS ou adicione o arquivo de credenciais."
      );
    }
  } catch (error) {
    console.error("[Firebase Admin] Erro ao inicializar:", error);
    throw error;
  }
}

/**
 * Retorna instância do Auth
 */
export function getAdminAuth() {
  return getAuth(getAdminApp());
}

/**
 * Retorna instância do Firestore
 */
export function getAdminFirestore() {
  return getFirestore(getAdminApp());
}

// Exports compatíveis com código existente
export const adminAuth = getAdminAuth();
export const adminDb = getAdminFirestore();
export const getFirebaseAdmin = getAdminApp;
