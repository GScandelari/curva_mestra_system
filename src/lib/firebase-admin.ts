import * as admin from "firebase-admin";

/**
 * Firebase Admin SDK para uso server-side (API Routes)
 *
 * IMPORTANTE:
 * - Para produção: Configure GOOGLE_APPLICATION_CREDENTIALS com service account key
 * - Para emuladores: Usa configuração automática do emulator
 */

// Singleton para garantir uma única instância
let adminApp: admin.app.App;
let adminAuth: admin.auth.Auth;
let adminDb: admin.firestore.Firestore;

// Verificar se estamos usando emuladores
// Só usa emuladores em desenvolvimento E se explicitamente configurado
const isDevelopment = process.env.NODE_ENV === "development";
const useEmulators = isDevelopment && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "curva-mestra";

if (!admin.apps.length) {
  if (useEmulators) {
    // Configuração para emuladores (desenvolvimento local)
    console.log("🔧 Inicializando Firebase Admin com emuladores...");

    adminApp = admin.initializeApp({
      projectId: projectId,
    });

    // Configurar emuladores
    process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
    process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";

    console.log("✅ Firebase Admin configurado para emuladores");
  } else {
    // Configuração para produção
    const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';

    if (!isBuildTime) {
      console.log("🌍 Inicializando Firebase Admin para produção...");
    }

    // Verificar se temos service account key
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIREBASE_SERVICE_ACCOUNT) {
      // Durante o build, não mostramos warning pois é comportamento esperado
      // Em produção no Firebase Hosting, Application Default Credentials funcionam automaticamente
      if (!isBuildTime) {
        console.warn("⚠️ GOOGLE_APPLICATION_CREDENTIALS não configurado. Tentando Application Default Credentials...");
      }

      adminApp = admin.initializeApp({
        projectId: projectId,
      });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // Service account como JSON string
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId,
      });
    } else {
      // Service account como arquivo
      adminApp = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: projectId,
      });
    }

    if (!isBuildTime) {
      console.log("✅ Firebase Admin configurado para produção");
    }
  }
} else {
  adminApp = admin.apps[0] as admin.app.App;
}

// Inicializar serviços
adminAuth = adminApp.auth();
adminDb = adminApp.firestore();

// Configurações do Firestore
adminDb.settings({
  ignoreUndefinedProperties: true,
});

export { adminApp, adminAuth, adminDb };

/**
 * Helper para obter instâncias do Firebase Admin
 */
export async function getFirebaseAdmin() {
  return {
    app: adminApp,
    auth: adminAuth,
    db: adminDb,
  };
}

/**
 * Helper para verificar se um usuário tem permissão
 */
export async function verifyUserPermission(
  uid: string,
  requiredRole: "system_admin" | "clinic_admin" | "clinic_user"
): Promise<boolean> {
  try {
    const user = await adminAuth.getUser(uid);
    const claims = user.customClaims || {};

    if (requiredRole === "system_admin") {
      return claims.is_system_admin === true;
    }

    if (requiredRole === "clinic_admin") {
      return claims.role === "clinic_admin" || claims.is_system_admin === true;
    }

    // clinic_user ou qualquer role válida
    return claims.role !== undefined && claims.active === true;
  } catch (error) {
    console.error("Erro ao verificar permissões:", error);
    return false;
  }
}

/**
 * Helper para obter dados do tenant
 */
export async function getTenantData(tenantId: string) {
  try {
    const tenantDoc = await adminDb.collection("tenants").doc(tenantId).get();

    if (!tenantDoc.exists) {
      return null;
    }

    return {
      id: tenantDoc.id,
      ...tenantDoc.data(),
    };
  } catch (error) {
    console.error("Erro ao buscar tenant:", error);
    return null;
  }
}

/**
 * Helper para contar usuários de um tenant
 */
export async function countTenantUsers(tenantId: string): Promise<number> {
  try {
    const usersSnapshot = await adminDb
      .collection("tenants")
      .doc(tenantId)
      .collection("users")
      .get();

    return usersSnapshot.size;
  } catch (error) {
    console.error("Erro ao contar usuários:", error);
    return 0;
  }
}
