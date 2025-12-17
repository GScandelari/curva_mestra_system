import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  try {
    // Obter token do usuário autenticado
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Verificar se é clinic_admin OU system_admin
    const isSystemAdmin = decodedToken.is_system_admin === true;
    const isClinicAdmin = decodedToken.role === "clinic_admin";

    if (!isSystemAdmin && !isClinicAdmin) {
      return NextResponse.json(
        { error: "Apenas administradores podem criar usuários" },
        { status: 403 }
      );
    }

    // Parse do body ANTES de determinar tenant_id
    const body = await request.json();
    const { email, displayName, password, role, tenant_id_override } = body;

    // Para system_admin, usar tenant_id_override
    // Para clinic_admin, usar tenant_id do token
    let tenantId: string;
    if (isSystemAdmin && tenant_id_override) {
      tenantId = tenant_id_override;
    } else if (isClinicAdmin) {
      tenantId = decodedToken.tenant_id;
      if (!tenantId) {
        return NextResponse.json(
          { error: "Tenant ID não encontrado" },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Tenant ID não especificado" },
        { status: 400 }
      );
    }

    // Validar campos obrigatórios
    if (!email || !displayName || !password || !role) {
      return NextResponse.json(
        { error: "Campos obrigatórios: email, displayName, password, role" },
        { status: 400 }
      );
    }

    // Validar role
    if (role !== "clinic_admin" && role !== "clinic_user") {
      return NextResponse.json(
        { error: "Role inválido. Deve ser 'clinic_admin' ou 'clinic_user'" },
        { status: 400 }
      );
    }

    // Buscar dados do tenant para obter o plan_id
    const tenantRef = adminDb.collection("tenants").doc(tenantId);
    const tenantDoc = await tenantRef.get();

    if (!tenantDoc.exists) {
      return NextResponse.json(
        { error: "Clínica não encontrada" },
        { status: 404 }
      );
    }

    const tenantData = tenantDoc.data();

    // Obter limite de usuários do tenant (baseado em CPF=1 ou CNPJ=5)
    const maxUsers = tenantData?.max_users || 5;

    // Contar usuários atuais (incluindo inativos) na coleção raiz users
    const usersSnapshot = await adminDb
      .collection("users")
      .where("tenant_id", "==", tenantId)
      .get();

    const currentUserCount = usersSnapshot.size;

    // Verificar se atingiu o limite
    if (currentUserCount >= maxUsers) {
      return NextResponse.json(
        {
          error: `Limite de ${maxUsers} usuários atingido para este plano`,
          currentCount: currentUserCount,
          maxUsers: maxUsers
        },
        { status: 400 }
      );
    }

    // Criar usuário no Firebase Auth
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName,
      emailVerified: false,
    });

    // Definir custom claims
    await adminAuth.setCustomUserClaims(userRecord.uid, {
      tenant_id: tenantId,
      role: role,
      active: true,
      is_system_admin: false,
    });

    // Criar documento do usuário no Firestore (coleção raiz users)
    const userDoc = {
      email,
      full_name: displayName, // Usar full_name para consistência
      displayName, // Manter displayName também para compatibilidade
      role,
      active: true,
      tenant_id: tenantId,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await adminDb
      .collection("users")
      .doc(userRecord.uid)
      .set(userDoc);

    return NextResponse.json(
      {
        success: true,
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName,
          role,
        },
        message: "Usuário criado com sucesso",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Erro ao criar usuário:", error);

    // Traduzir erros comuns do Firebase
    if (error.code === "auth/email-already-exists") {
      return NextResponse.json(
        { error: "Este email já está cadastrado no sistema" },
        { status: 400 }
      );
    }

    if (error.code === "auth/invalid-email") {
      return NextResponse.json(
        { error: "Email inválido" },
        { status: 400 }
      );
    }

    if (error.code === "auth/weak-password") {
      return NextResponse.json(
        { error: "Senha muito fraca. Use pelo menos 6 caracteres" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Erro ao criar usuário. Tente novamente." },
      { status: 500 }
    );
  }
}
