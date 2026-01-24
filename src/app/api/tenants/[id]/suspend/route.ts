/**
 * API Route: Suspender/Reativar Clínica
 * Sistema de bloqueio de acesso com motivos
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { SuspensionReason } from "@/types";

/**
 * POST - Suspender clínica
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const tenantId = params.id;

    // Verificar autenticação
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Apenas system_admin pode suspender clínicas
    if (!decodedToken.is_system_admin) {
      return NextResponse.json(
        { error: "Apenas administradores do sistema podem suspender clínicas" },
        { status: 403 }
      );
    }

    // Obter dados da requisição
    const {
      reason,
      details,
      contact_email = "scandelari.guilherme@curvamestra.com.br",
    } = await req.json();

    // Validações
    if (!reason) {
      return NextResponse.json(
        { error: "Motivo da suspensão é obrigatório" },
        { status: 400 }
      );
    }

    const validReasons: SuspensionReason[] = [
      "payment_failure",
      "contract_breach",
      "terms_violation",
      "fraud_detected",
      "other",
    ];

    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        { error: "Motivo inválido" },
        { status: 400 }
      );
    }

    if (!details || details.trim().length === 0) {
      return NextResponse.json(
        { error: "Detalhes da suspensão são obrigatórios" },
        { status: 400 }
      );
    }

    // Buscar tenant
    const tenantDoc = await adminDb.collection("tenants").doc(tenantId).get();

    if (!tenantDoc.exists) {
      return NextResponse.json(
        { error: "Clínica não encontrada" },
        { status: 404 }
      );
    }

    // Atualizar tenant com informações de suspensão
    await adminDb.collection("tenants").doc(tenantId).update({
      active: false,
      suspension: {
        suspended: true,
        reason,
        details: details.trim(),
        suspended_at: FieldValue.serverTimestamp(),
        suspended_by: decodedToken.uid,
        contact_email,
      },
      updated_at: FieldValue.serverTimestamp(),
    });

    // Buscar todos os usuários da clínica
    const usersSnapshot = await adminDb
      .collection("users")
      .where("tenant_id", "==", tenantId)
      .get();

    // Atualizar custom claims de todos os usuários para desativá-los
    const updatePromises = usersSnapshot.docs.map(async (userDoc) => {
      const userId = userDoc.id;
      const userData = userDoc.data();

      // Atualizar custom claims
      await adminAuth.setCustomUserClaims(userId, {
        tenant_id: tenantId,
        role: userData.role,
        is_system_admin: false,
        active: false, // Desativar usuário
      });

      // Atualizar documento do usuário
      await adminDb.collection("users").doc(userId).update({
        active: false,
        updated_at: FieldValue.serverTimestamp(),
      });
    });

    await Promise.all(updatePromises);

    console.log(
      `✅ Clínica ${tenantId} suspensa por ${decodedToken.email}. Motivo: ${reason}`
    );

    return NextResponse.json({
      success: true,
      message: "Clínica suspensa com sucesso",
      tenant_id: tenantId,
      users_affected: usersSnapshot.size,
    });
  } catch (error: any) {
    console.error("❌ Erro ao suspender clínica:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao processar suspensão" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Reativar clínica (remover suspensão)
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const tenantId = params.id;

    // Verificar autenticação
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Apenas system_admin pode reativar clínicas
    if (!decodedToken.is_system_admin) {
      return NextResponse.json(
        { error: "Apenas administradores do sistema podem reativar clínicas" },
        { status: 403 }
      );
    }

    // Buscar tenant
    const tenantDoc = await adminDb.collection("tenants").doc(tenantId).get();

    if (!tenantDoc.exists) {
      return NextResponse.json(
        { error: "Clínica não encontrada" },
        { status: 404 }
      );
    }

    // Remover suspensão e reativar tenant
    await adminDb.collection("tenants").doc(tenantId).update({
      active: true,
      suspension: FieldValue.delete(), // Remove o campo suspension
      updated_at: FieldValue.serverTimestamp(),
    });

    // Buscar todos os usuários da clínica
    const usersSnapshot = await adminDb
      .collection("users")
      .where("tenant_id", "==", tenantId)
      .get();

    // Reativar custom claims de todos os usuários
    const updatePromises = usersSnapshot.docs.map(async (userDoc) => {
      const userId = userDoc.id;
      const userData = userDoc.data();

      // Atualizar custom claims
      await adminAuth.setCustomUserClaims(userId, {
        tenant_id: tenantId,
        role: userData.role,
        is_system_admin: userData.role === "system_admin",
        active: true, // Reativar usuário
      });

      // Atualizar documento do usuário
      await adminDb.collection("users").doc(userId).update({
        active: true,
        updated_at: FieldValue.serverTimestamp(),
      });
    });

    await Promise.all(updatePromises);

    console.log(
      `✅ Clínica ${tenantId} reativada por ${decodedToken.email}`
    );

    return NextResponse.json({
      success: true,
      message: "Clínica reativada com sucesso",
      tenant_id: tenantId,
      users_affected: usersSnapshot.size,
    });
  } catch (error: any) {
    console.error("❌ Erro ao reativar clínica:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao processar reativação" },
      { status: 500 }
    );
  }
}
