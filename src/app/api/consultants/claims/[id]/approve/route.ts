/**
 * API Route: Aprovar reivindicação de vínculo
 * POST - Clinic admin aprova vínculo com consultor
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST - Aprovar reivindicação
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const claimId = params.id;

    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Token não fornecido" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Buscar reivindicação
    const claimDoc = await adminDb.collection("consultant_claims").doc(claimId).get();

    if (!claimDoc.exists) {
      return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 });
    }

    const claimData = claimDoc.data();

    // Verificar permissão: system_admin ou clinic_admin do tenant
    const isSystemAdmin = decodedToken.is_system_admin;
    const isClinicAdmin =
      decodedToken.role === "clinic_admin" &&
      decodedToken.tenant_id === claimData?.tenant_id;

    if (!isSystemAdmin && !isClinicAdmin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    if (claimData?.status !== "pending") {
      return NextResponse.json(
        { error: "Solicitação já foi processada" },
        { status: 400 }
      );
    }

    const consultantId = claimData.consultant_id;
    const tenantId = claimData.tenant_id;

    // Buscar consultor
    const consultantDoc = await adminDb.collection("consultants").doc(consultantId).get();

    if (!consultantDoc.exists) {
      return NextResponse.json({ error: "Consultor não encontrado" }, { status: 404 });
    }

    const consultantData = consultantDoc.data();

    // Verificar se clínica já tem consultor
    const tenantDoc = await adminDb.collection("tenants").doc(tenantId).get();
    const tenantData = tenantDoc.data();

    if (tenantData?.consultant_id && tenantData.consultant_id !== consultantId) {
      return NextResponse.json(
        { error: "Esta clínica já possui outro consultor vinculado" },
        { status: 400 }
      );
    }

    // Buscar nome do aprovador
    let approverName = decodedToken.name || "Administrador";
    try {
      const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
      if (userDoc.exists) {
        approverName = userDoc.data()?.full_name || approverName;
      }
    } catch (e) {
      // Ignorar erro ao buscar nome
    }

    // Executar atualizações em batch
    const batch = adminDb.batch();

    // 1. Atualizar reivindicação
    batch.update(claimDoc.ref, {
      status: "approved",
      approved_by: decodedToken.uid,
      approved_by_name: approverName,
      approved_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    // 2. Adicionar tenant à lista do consultor
    const authorizedTenants = consultantData?.authorized_tenants || [];
    if (!authorizedTenants.includes(tenantId)) {
      batch.update(consultantDoc.ref, {
        authorized_tenants: FieldValue.arrayUnion(tenantId),
        updated_at: FieldValue.serverTimestamp(),
      });
    }

    // 3. Atualizar tenant com dados do consultor
    batch.update(tenantDoc.ref, {
      consultant_id: consultantId,
      consultant_code: claimData.consultant_code,
      consultant_name: claimData.consultant_name,
      updated_at: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // 4. Atualizar custom claims do consultor
    if (consultantData?.user_id) {
      const currentClaims = (await adminAuth.getUser(consultantData.user_id)).customClaims || {};
      const updatedAuthorizedTenants = [...(currentClaims.authorized_tenants || [])];
      if (!updatedAuthorizedTenants.includes(tenantId)) {
        updatedAuthorizedTenants.push(tenantId);
      }

      await adminAuth.setCustomUserClaims(consultantData.user_id, {
        ...currentClaims,
        authorized_tenants: updatedAuthorizedTenants,
      });
    }

    // 5. Notificar consultor
    try {
      await adminDb.collection("email_queue").add({
        to: consultantData?.email,
        subject: "Vínculo aprovado - Curva Mestra",
        body: `
          <p>Olá ${consultantData?.name},</p>
          <p>Sua solicitação de vínculo com a clínica <strong>${claimData.tenant_name}</strong> foi aprovada!</p>
          <p>Você já pode acessar os dados da clínica no Portal do Consultor.</p>
          <p>Atenciosamente,<br>Equipe Curva Mestra</p>
        `,
        status: "pending",
        type: "consultant_claim_approved",
        created_at: FieldValue.serverTimestamp(),
      });
    } catch (emailError) {
      console.warn("Erro ao enviar email:", emailError);
    }

    return NextResponse.json({
      success: true,
      message: "Vínculo aprovado com sucesso",
    });
  } catch (error: any) {
    console.error("Erro ao aprovar reivindicação:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao aprovar solicitação" },
      { status: 500 }
    );
  }
}
