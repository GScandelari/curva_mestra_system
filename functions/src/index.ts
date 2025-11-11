import * as admin from "firebase-admin";
import {onRequest} from "firebase-functions/v2/https";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
// import {setGlobalOptions} from "firebase-functions/v2";

// Inicializar Firebase Admin
admin.initializeApp();

// Configurações globais para Functions 2nd gen
// Comentado temporariamente para debug no emulator
// setGlobalOptions({
//   region: "southamerica-east1", // São Paulo
//   maxInstances: 10,
// });

/**
 * Middleware para verificar autenticação e tenant
 */
interface AuthContext {
  uid: string;
  tenantId: string;
  role: string;
  isSystemAdmin: boolean;
  active: boolean;
}

function getAuthContext(context: any): AuthContext {
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const {uid, token} = context.auth;

  if (!token.active) {
    throw new HttpsError("permission-denied", "Usuário inativo");
  }

  return {
    uid,
    tenantId: token.tenant_id,
    role: token.role,
    isSystemAdmin: token.is_system_admin || false,
    active: token.active,
  };
}

/**
 * Health check endpoint
 */
export const healthCheck = onRequest(async (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "curva-mestra-functions",
  });
});

/**
 * Exemplo: Função callable para criar tenant (apenas system_admin)
 */
export const createTenant = onCall(async (request) => {
  const auth = getAuthContext(request);

  if (!auth.isSystemAdmin) {
    throw new HttpsError(
      "permission-denied",
      "Apenas system_admin pode criar tenants"
    );
  }

  const {name, cnpj, email, planId} = request.data;

  if (!name || !cnpj || !email) {
    throw new HttpsError(
      "invalid-argument",
      "name, cnpj e email são obrigatórios"
    );
  }

  const tenantId = `tenant_${Date.now()}`;

  await admin.firestore().collection("tenants").doc(tenantId).set({
    id: tenantId,
    name,
    cnpj,
    email,
    plan_id: planId || "basic",
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
    active: true,
  });

  return {tenantId, message: "Tenant criado com sucesso"};
});

/**
 * Atualizar tenant existente (apenas system_admin)
 */
export const updateTenant = onCall(async (request) => {
  const auth = getAuthContext(request);

  if (!auth.isSystemAdmin) {
    throw new HttpsError(
      "permission-denied",
      "Apenas system_admin pode atualizar tenants"
    );
  }

  const {tenantId, name, cnpj, email, phone, address, planId, active} = request.data;

  if (!tenantId) {
    throw new HttpsError("invalid-argument", "tenantId é obrigatório");
  }

  const updateData: any = {
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (name !== undefined) updateData.name = name;
  if (cnpj !== undefined) updateData.cnpj = cnpj;
  if (email !== undefined) updateData.email = email;
  if (phone !== undefined) updateData.phone = phone;
  if (address !== undefined) updateData.address = address;
  if (planId !== undefined) updateData.plan_id = planId;
  if (active !== undefined) updateData.active = active;

  await admin.firestore().collection("tenants").doc(tenantId).update(updateData);

  return {tenantId, message: "Tenant atualizado com sucesso"};
});

/**
 * Listar todos os tenants (apenas system_admin)
 */
export const listTenants = onCall(async (request) => {
  const auth = getAuthContext(request);

  if (!auth.isSystemAdmin) {
    throw new HttpsError(
      "permission-denied",
      "Apenas system_admin pode listar tenants"
    );
  }

  const {limit = 50, activeOnly = false} = request.data;

  let query = admin.firestore().collection("tenants").orderBy("created_at", "desc").limit(limit);

  if (activeOnly) {
    query = query.where("active", "==", true) as any;
  }

  const snapshot = await query.get();

  const tenants = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return {tenants, count: tenants.length};
});

/**
 * Obter detalhes de um tenant específico (system_admin ou usuários do tenant)
 */
export const getTenant = onCall(async (request) => {
  const auth = getAuthContext(request);
  const {tenantId} = request.data;

  if (!tenantId) {
    throw new HttpsError("invalid-argument", "tenantId é obrigatório");
  }

  // System admin pode ver qualquer tenant, usuários normais só o próprio
  if (!auth.isSystemAdmin && auth.tenantId !== tenantId) {
    throw new HttpsError(
      "permission-denied",
      "Você não tem permissão para acessar este tenant"
    );
  }

  const doc = await admin.firestore().collection("tenants").doc(tenantId).get();

  if (!doc.exists) {
    throw new HttpsError("not-found", "Tenant não encontrado");
  }

  return {
    tenant: {
      id: doc.id,
      ...doc.data(),
    },
  };
});

/**
 * Desativar tenant (soft delete - apenas system_admin)
 */
export const deactivateTenant = onCall(async (request) => {
  const auth = getAuthContext(request);

  if (!auth.isSystemAdmin) {
    throw new HttpsError(
      "permission-denied",
      "Apenas system_admin pode desativar tenants"
    );
  }

  const {tenantId} = request.data;

  if (!tenantId) {
    throw new HttpsError("invalid-argument", "tenantId é obrigatório");
  }

  await admin.firestore().collection("tenants").doc(tenantId).update({
    active: false,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Também desativar todos os usuários do tenant
  const usersSnapshot = await admin.firestore()
    .collection("tenants")
    .doc(tenantId)
    .collection("users")
    .get();

  const batch = admin.firestore().batch();
  usersSnapshot.docs.forEach((doc) => {
    batch.update(doc.ref, {
      active: false,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();

  return {tenantId, message: "Tenant desativado com sucesso"};
});

/**
 * Exemplo: Trigger quando NF é importada
 */
export const onNfImported = onDocumentCreated(
  "tenants/{tenantId}/nf_imports/{nfId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const nfData = snapshot.data();
    const {tenantId} = event.params;

    console.log(`Nova NF importada para tenant ${tenantId}:`, nfData);

    // Aqui você pode adicionar lógica para:
    // 1. Processar OCR do PDF
    // 2. Extrair produtos
    // 3. Atualizar inventário
    // 4. Enviar notificações

    return null;
  }
);

/**
 * Exemplo: Função para buscar inventário do tenant
 */
export const getInventory = onCall(async (request) => {
  const auth = getAuthContext(request);
  const {limit = 50} = request.data;

  const inventorySnapshot = await admin.firestore()
    .collection("tenants")
    .doc(auth.tenantId)
    .collection("inventory")
    .orderBy("dt_validade", "asc")
    .limit(limit)
    .get();

  const inventory = inventorySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return {inventory};
});

/**
 * Exemplo: Função para alertar produtos próximos ao vencimento
 */
export const checkExpiringProducts = onCall(async (request) => {
  const auth = getAuthContext(request);
  const {daysThreshold = 30} = request.data;

  const now = new Date();
  const thresholdDate = new Date();
  thresholdDate.setDate(now.getDate() + daysThreshold);

  const expiringSnapshot = await admin.firestore()
    .collection("tenants")
    .doc(auth.tenantId)
    .collection("inventory")
    .where("dt_validade", "<=", thresholdDate)
    .where("quantidade_disponivel", ">", 0)
    .get();

  const expiringProducts = expiringSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return {
    count: expiringProducts.length,
    products: expiringProducts,
  };
});

/**
 * Função para atualizar custom claims de um usuário
 * Pode ser chamada por system_admin ou pela própria function durante setup
 */
export const setUserClaims = onCall(async (request) => {
  const {userId, tenantId, role, isSystemAdmin, active} = request.data;

  if (!userId) {
    throw new HttpsError("invalid-argument", "userId é obrigatório");
  }

  // Verificar se o chamador é system_admin (exceto se não houver auth, para setup inicial)
  if (request.auth) {
    const auth = getAuthContext(request);
    if (!auth.isSystemAdmin) {
      throw new HttpsError(
        "permission-denied",
        "Apenas system_admin pode configurar custom claims"
      );
    }
  }

  const claims: any = {};

  if (tenantId !== undefined) claims.tenant_id = tenantId;
  if (role !== undefined) claims.role = role;
  if (isSystemAdmin !== undefined) claims.is_system_admin = isSystemAdmin;
  if (active !== undefined) claims.active = active;

  await admin.auth().setCustomUserClaims(userId, claims);

  return {
    success: true,
    message: "Custom claims atualizados com sucesso",
    userId,
    claims,
  };
});

/**
 * Função para criar um sistema admin inicial (apenas para desenvolvimento)
 * Em produção, isso deveria ser feito via console ou script admin
 */
export const setupSystemAdmin = onCall(async (request) => {
  const {email, password, displayName} = request.data;

  if (!email || !password) {
    throw new HttpsError(
      "invalid-argument",
      "email e password são obrigatórios"
    );
  }

  try {
    // Criar usuário
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: displayName || "System Admin",
      emailVerified: true,
    });

    // Configurar custom claims
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      is_system_admin: true,
      role: "system_admin",
      active: true,
    });

    return {
      success: true,
      message: "System admin criado com sucesso",
      userId: userRecord.uid,
      email: userRecord.email,
    };
  } catch (error: any) {
    throw new HttpsError("internal", error.message);
  }
});

/**
 * Função para adicionar um usuário a um tenant
 */
export const addUserToTenant = onCall(async (request) => {
  const auth = getAuthContext(request);

  // Apenas system_admin ou admin do tenant pode adicionar usuários
  if (!auth.isSystemAdmin && auth.role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Apenas admin pode adicionar usuários"
    );
  }

  const {userId, tenantId, role} = request.data;

  if (!userId || !tenantId || !role) {
    throw new HttpsError(
      "invalid-argument",
      "userId, tenantId e role são obrigatórios"
    );
  }

  // System admin pode adicionar a qualquer tenant
  // Admin só pode adicionar ao próprio tenant
  if (!auth.isSystemAdmin && auth.tenantId !== tenantId) {
    throw new HttpsError(
      "permission-denied",
      "Você só pode adicionar usuários ao seu próprio tenant"
    );
  }

  // Atualizar custom claims
  await admin.auth().setCustomUserClaims(userId, {
    tenant_id: tenantId,
    role,
    is_system_admin: false,
    active: true,
  });

  // Criar documento do usuário no tenant
  await admin.firestore()
    .collection("tenants")
    .doc(tenantId)
    .collection("users")
    .doc(userId)
    .set({
      uid: userId,
      tenant_id: tenantId,
      role,
      active: true,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

  return {
    success: true,
    message: "Usuário adicionado ao tenant com sucesso",
    userId,
    tenantId,
    role,
  };
});
