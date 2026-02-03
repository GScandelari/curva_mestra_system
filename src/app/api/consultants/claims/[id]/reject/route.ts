/**
 * API Route: Rejeitar reivindicação de vínculo
 * POST - Clinic admin rejeita vínculo com consultor
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST - Rejeitar reivindicação
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

    const body = await req.json();
    const { reason } = body;

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

    // Buscar nome do rejeitador
    let rejecterName = decodedToken.name || "Administrador";
    try {
      const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
      if (userDoc.exists) {
        rejecterName = userDoc.data()?.full_name || rejecterName;
      }
    } catch (e) {
      // Ignorar erro ao buscar nome
    }

    // Atualizar reivindicação
    await adminDb.collection("consultant_claims").doc(claimId).update({
      status: "rejected",
      rejected_by: decodedToken.uid,
      rejected_by_name: rejecterName,
      rejected_at: FieldValue.serverTimestamp(),
      rejection_reason: reason || "Não especificado",
      updated_at: FieldValue.serverTimestamp(),
    });

    // Buscar consultor para notificação
    const consultantDoc = await adminDb.collection("consultants").doc(claimData.consultant_id).get();
    const consultantData = consultantDoc.data();

    // Notificar consultor por email
    if (consultantData?.email) {
      try {
        await adminDb.collection("email_queue").add({
          to: consultantData.email,
          subject: "Solicitação de vínculo não aprovada - Curva Mestra",
          body: `
            <p>Olá ${consultantData.name},</p>
            <p>Infelizmente sua solicitação de vínculo com a clínica <strong>${claimData.tenant_name}</strong> não foi aprovada.</p>
            ${reason ? `<p><strong>Motivo:</strong> ${reason}</p>` : ""}
            <p>Se você tiver dúvidas, entre em contato com a clínica diretamente.</p>
            <p>Atenciosamente,<br>Equipe Curva Mestra</p>
          `,
          status: "pending",
          type: "consultant_claim_rejected",
          created_at: FieldValue.serverTimestamp(),
        });
      } catch (emailError) {
        console.warn("Erro ao enviar email:", emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Solicitação rejeitada",
    });
  } catch (error: any) {
    console.error("Erro ao rejeitar reivindicação:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao rejeitar solicitação" },
      { status: 500 }
    );
  }
}
