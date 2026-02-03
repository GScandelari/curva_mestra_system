/**
 * API Route: Gerenciamento do consultor de uma clínica
 * GET - Obter consultor atual
 * POST - Transferir consultoria
 * DELETE - Remover consultor
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * GET - Obter consultor atual da clínica
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const tenantId = params.id;

    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Token não fornecido" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Verificar permissão: system_admin, clinic_admin do tenant, ou consultor vinculado
    const isSystemAdmin = decodedToken.is_system_admin;
    const isClinicMember = decodedToken.tenant_id === tenantId;
    const isConsultantWithAccess =
      decodedToken.is_consultant &&
      decodedToken.authorized_tenants?.includes(tenantId);

    if (!isSystemAdmin && !isClinicMember && !isConsultantWithAccess) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // Buscar tenant
    const tenantDoc = await adminDb.collection("tenants").doc(tenantId).get();

    if (!tenantDoc.exists) {
      return NextResponse.json({ error: "Clínica não encontrada" }, { status: 404 });
    }

    const tenantData = tenantDoc.data();

    if (!tenantData?.consultant_id) {
      return NextResponse.json({
        success: true,
        data: null,
        message: "Clínica não possui consultor vinculado",
      });
    }

    // Buscar dados do consultor
    const consultantDoc = await adminDb
      .collection("consultants")
      .doc(tenantData.consultant_id)
      .get();

    if (!consultantDoc.exists) {
      return NextResponse.json({
        success: true,
        data: null,
        message: "Consultor não encontrado",
      });
    }

    const consultantData = consultantDoc.data();

    return NextResponse.json({
      success: true,
      data: {
        id: consultantDoc.id,
        code: consultantData?.code,
        name: consultantData?.name,
        email: consultantData?.email,
        phone: consultantData?.phone,
        status: consultantData?.status,
      },
    });
  } catch (error: any) {
    console.error("Erro ao buscar consultor da clínica:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao buscar consultor" },
      { status: 500 }
    );
  }
}

/**
 * POST - Transferir consultoria para outro consultor
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const tenantId = params.id;

    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Token não fornecido" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Apenas system_admin ou clinic_admin do tenant podem transferir
    const isSystemAdmin = decodedToken.is_system_admin;
    const isClinicAdmin =
      decodedToken.role === "clinic_admin" && decodedToken.tenant_id === tenantId;

    if (!isSystemAdmin && !isClinicAdmin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const body = await req.json();
    const { new_consultant_id } = body;

    if (!new_consultant_id) {
      return NextResponse.json(
        { error: "new_consultant_id é obrigatório" },
        { status: 400 }
      );
    }

    // Buscar tenant
    const tenantDoc = await adminDb.collection("tenants").doc(tenantId).get();

    if (!tenantDoc.exists) {
      return NextResponse.json({ error: "Clínica não encontrada" }, { status: 404 });
    }

    const tenantData = tenantDoc.data();
    const oldConsultantId = tenantData?.consultant_id;

    // Buscar novo consultor
    const newConsultantDoc = await adminDb
      .collection("consultants")
      .doc(new_consultant_id)
      .get();

    if (!newConsultantDoc.exists) {
      return NextResponse.json(
        { error: "Novo consultor não encontrado" },
        { status: 404 }
      );
    }

    const newConsultantData = newConsultantDoc.data();

    if (newConsultantData?.status !== "active") {
      return NextResponse.json(
        { error: "Novo consultor não está ativo" },
        { status: 400 }
      );
    }

    // Batch para operações atômicas
    const batch = adminDb.batch();

    // 1. Remover tenant do consultor antigo (se existir)
    if (oldConsultantId) {
      const oldConsultantRef = adminDb.collection("consultants").doc(oldConsultantId);
      batch.update(oldConsultantRef, {
        authorized_tenants: FieldValue.arrayRemove(tenantId),
        updated_at: FieldValue.serverTimestamp(),
      });
    }

    // 2. Adicionar tenant ao novo consultor
    batch.update(newConsultantDoc.ref, {
      authorized_tenants: FieldValue.arrayUnion(tenantId),
      updated_at: FieldValue.serverTimestamp(),
    });

    // 3. Atualizar tenant
    batch.update(tenantDoc.ref, {
      consultant_id: new_consultant_id,
      consultant_code: newConsultantData.code,
      consultant_name: newConsultantData.name,
      updated_at: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // 4. Atualizar custom claims do novo consultor
    if (newConsultantData?.user_id) {
      const userRecord = await adminAuth.getUser(newConsultantData.user_id);
      const currentClaims = userRecord.customClaims || {};
      const updatedAuthorizedTenants = [...(currentClaims.authorized_tenants || [])];
      if (!updatedAuthorizedTenants.includes(tenantId)) {
        updatedAuthorizedTenants.push(tenantId);
      }

      await adminAuth.setCustomUserClaims(newConsultantData.user_id, {
        ...currentClaims,
        authorized_tenants: updatedAuthorizedTenants,
      });
    }

    // 5. Remover tenant das claims do consultor antigo
    if (oldConsultantId) {
      const oldConsultantDoc = await adminDb
        .collection("consultants")
        .doc(oldConsultantId)
        .get();
      const oldConsultantData = oldConsultantDoc.data();

      if (oldConsultantData?.user_id) {
        const userRecord = await adminAuth.getUser(oldConsultantData.user_id);
        const currentClaims = userRecord.customClaims || {};
        const updatedAuthorizedTenants = (currentClaims.authorized_tenants || []).filter(
          (t: string) => t !== tenantId
        );

        await adminAuth.setCustomUserClaims(oldConsultantData.user_id, {
          ...currentClaims,
          authorized_tenants: updatedAuthorizedTenants,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Consultoria transferida com sucesso",
      data: {
        consultant_id: new_consultant_id,
        consultant_name: newConsultantData.name,
        consultant_code: newConsultantData.code,
      },
    });
  } catch (error: any) {
    console.error("Erro ao transferir consultoria:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao transferir consultoria" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Remover consultor da clínica
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const tenantId = params.id;

    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Token não fornecido" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Apenas system_admin ou clinic_admin do tenant podem remover
    const isSystemAdmin = decodedToken.is_system_admin;
    const isClinicAdmin =
      decodedToken.role === "clinic_admin" && decodedToken.tenant_id === tenantId;

    if (!isSystemAdmin && !isClinicAdmin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // Buscar tenant
    const tenantDoc = await adminDb.collection("tenants").doc(tenantId).get();

    if (!tenantDoc.exists) {
      return NextResponse.json({ error: "Clínica não encontrada" }, { status: 404 });
    }

    const tenantData = tenantDoc.data();
    const consultantId = tenantData?.consultant_id;

    if (!consultantId) {
      return NextResponse.json(
        { error: "Clínica não possui consultor vinculado" },
        { status: 400 }
      );
    }

    // Batch para operações atômicas
    const batch = adminDb.batch();

    // 1. Remover tenant da lista do consultor
    const consultantRef = adminDb.collection("consultants").doc(consultantId);
    batch.update(consultantRef, {
      authorized_tenants: FieldValue.arrayRemove(tenantId),
      updated_at: FieldValue.serverTimestamp(),
    });

    // 2. Remover dados do consultor do tenant
    batch.update(tenantDoc.ref, {
      consultant_id: FieldValue.delete(),
      consultant_code: FieldValue.delete(),
      consultant_name: FieldValue.delete(),
      updated_at: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // 3. Atualizar custom claims do consultor
    const consultantDoc = await adminDb.collection("consultants").doc(consultantId).get();
    const consultantData = consultantDoc.data();

    if (consultantData?.user_id) {
      const userRecord = await adminAuth.getUser(consultantData.user_id);
      const currentClaims = userRecord.customClaims || {};
      const updatedAuthorizedTenants = (currentClaims.authorized_tenants || []).filter(
        (t: string) => t !== tenantId
      );

      await adminAuth.setCustomUserClaims(consultantData.user_id, {
        ...currentClaims,
        authorized_tenants: updatedAuthorizedTenants,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Consultor removido com sucesso",
    });
  } catch (error: any) {
    console.error("Erro ao remover consultor:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao remover consultor" },
      { status: 500 }
    );
  }
}
