import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, displayName, tenant_id } = body;

    // Validações
    if (!email || !password || !displayName) {
      return NextResponse.json(
        { success: false, message: "Dados incompletos" },
        { status: 400 }
      );
    }

    // Buscar access_request para obter document_type
    const accessRequestsSnapshot = await adminDb
      .collection("access_requests")
      .where("email", "==", email.toLowerCase())
      .where("status", "==", "ativa")
      .limit(1)
      .get();

    let documentType: "cpf" | "cnpj" = "cnpj"; // Default
    if (!accessRequestsSnapshot.empty) {
      const accessRequestData = accessRequestsSnapshot.docs[0].data();
      documentType = accessRequestData.document_type || "cnpj";
    }

    // Definir role baseado no document_type
    // CPF: sempre clinic_admin (conta individual)
    // CNPJ: clinic_user (pode ter múltiplos usuários)
    const userRole = documentType === "cpf" ? "clinic_admin" : "clinic_user";

    // Verificar se tenant_id existe (se fornecido)
    if (tenant_id) {
      const tenantDoc = await adminDb.collection("tenants").doc(tenant_id).get();
      if (!tenantDoc.exists) {
        return NextResponse.json(
          { success: false, message: "Clínica não encontrada" },
          { status: 404 }
        );
      }

      // Verificar limite de usuários
      const tenantData = tenantDoc.data();
      const maxUsers = tenantData?.max_users || 0;

      const usersSnapshot = await adminDb
        .collection(`tenants/${tenant_id}/users`)
        .where("active", "==", true)
        .get();

      if (usersSnapshot.size >= maxUsers) {
        return NextResponse.json(
          {
            success: false,
            message: "Clínica atingiu o limite de usuários ativos",
          },
          { status: 400 }
        );
      }
    }

    // Criar usuário no Firebase Auth
    const userRecord = await adminAuth.createUser({
      email: email.toLowerCase(),
      password: password,
      displayName: displayName,
      emailVerified: true, // Já foi verificado via código
    });

    // Definir custom claims
    const customClaims: any = {
      active: tenant_id ? true : false, // Se tem tenant, já ativa, senão aguarda system_admin
      role: userRole,
      is_system_admin: false,
    };

    if (tenant_id) {
      customClaims.tenant_id = tenant_id;
    }

    await adminAuth.setCustomUserClaims(userRecord.uid, customClaims);

    // Criar documento do usuário
    if (tenant_id) {
      // Criar em tenants/{tenant_id}/users/{uid}
      await adminDb
        .collection(`tenants/${tenant_id}/users`)
        .doc(userRecord.uid)
        .set({
          uid: userRecord.uid,
          email: email.toLowerCase(),
          displayName: displayName,
          tenant_id: tenant_id,
          role: userRole,
          active: true,
          created_at: Timestamp.now(),
          updated_at: Timestamp.now(),
        });
    } else {
      // Criar em usuários pendentes (system_admin precisa aprovar)
      await adminDb.collection("pending_users").doc(userRecord.uid).set({
        uid: userRecord.uid,
        email: email.toLowerCase(),
        displayName: displayName,
        role: userRole,
        active: false,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
    }

    return NextResponse.json({
      success: true,
      message: tenant_id
        ? "Conta criada com sucesso! Você já pode fazer login."
        : "Conta criada! Aguarde aprovação do administrador do sistema.",
      userId: userRecord.uid,
    });
  } catch (error: any) {
    console.error("Erro ao ativar conta:", error);

    // Tratar erros específicos do Firebase
    if (error.code === "auth/email-already-exists") {
      return NextResponse.json(
        { success: false, message: "Este email já está cadastrado" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Erro ao criar conta. Tente novamente.",
      },
      { status: 500 }
    );
  }
}
