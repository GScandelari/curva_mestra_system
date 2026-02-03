/**
 * API Route: Reivindicações de vínculo consultor-clínica
 * GET - Listar reivindicações
 * POST - Criar nova reivindicação
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * GET - Listar reivindicações
 */
export async function GET(req: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Token não fornecido" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    const { searchParams } = new URL(req.url);
    const consultantId = searchParams.get("consultant_id");
    const tenantId = searchParams.get("tenant_id");
    const status = searchParams.get("status");

    let query = adminDb.collection("consultant_claims").orderBy("created_at", "desc");

    // Filtrar baseado no role do usuário
    if (decodedToken.is_system_admin) {
      // System admin pode ver todas
      if (consultantId) {
        query = query.where("consultant_id", "==", consultantId) as any;
      }
      if (tenantId) {
        query = query.where("tenant_id", "==", tenantId) as any;
      }
    } else if (decodedToken.is_consultant && decodedToken.consultant_id) {
      // Consultor vê apenas suas próprias
      query = query.where("consultant_id", "==", decodedToken.consultant_id) as any;
    } else if (decodedToken.tenant_id && decodedToken.role === "clinic_admin") {
      // Clinic admin vê apenas do seu tenant
      query = query.where("tenant_id", "==", decodedToken.tenant_id) as any;
    } else {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    if (status) {
      query = query.where("status", "==", status) as any;
    }

    const snapshot = await query.get();
    const claims = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      data: claims,
    });
  } catch (error: any) {
    console.error("Erro ao listar reivindicações:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao listar reivindicações" },
      { status: 500 }
    );
  }
}

/**
 * POST - Criar reivindicação de vínculo
 */
export async function POST(req: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Token não fornecido" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Apenas consultores podem criar reivindicações
    if (!decodedToken.is_consultant || !decodedToken.consultant_id) {
      return NextResponse.json(
        { error: "Apenas consultores podem criar reivindicações" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { tenant_id } = body;

    if (!tenant_id) {
      return NextResponse.json(
        { error: "tenant_id é obrigatório" },
        { status: 400 }
      );
    }

    const consultantId = decodedToken.consultant_id;

    // Buscar dados do consultor
    const consultantDoc = await adminDb.collection("consultants").doc(consultantId).get();

    if (!consultantDoc.exists) {
      return NextResponse.json({ error: "Consultor não encontrado" }, { status: 404 });
    }

    const consultantData = consultantDoc.data();

    // Buscar dados da clínica
    const tenantDoc = await adminDb.collection("tenants").doc(tenant_id).get();

    if (!tenantDoc.exists) {
      return NextResponse.json({ error: "Clínica não encontrada" }, { status: 404 });
    }

    const tenantData = tenantDoc.data();

    // Verificar se a clínica já tem consultor
    if (tenantData?.consultant_id) {
      return NextResponse.json(
        { error: "Esta clínica já possui um consultor vinculado" },
        { status: 400 }
      );
    }

    // Verificar se já existe reivindicação pendente
    const existingClaim = await adminDb
      .collection("consultant_claims")
      .where("consultant_id", "==", consultantId)
      .where("tenant_id", "==", tenant_id)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (!existingClaim.empty) {
      return NextResponse.json(
        { error: "Já existe uma solicitação pendente para esta clínica" },
        { status: 400 }
      );
    }

    // Criar reivindicação
    const claimData = {
      consultant_id: consultantId,
      consultant_name: consultantData?.name,
      consultant_code: consultantData?.code,
      tenant_id,
      tenant_name: tenantData?.name,
      tenant_document: tenantData?.document_number,
      status: "pending",
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    };

    const claimRef = await adminDb.collection("consultant_claims").add(claimData);

    // Criar notificação para o admin da clínica
    try {
      await adminDb.collection(`tenants/${tenant_id}/notifications`).add({
        type: "consultant_claim",
        title: "Nova solicitação de consultoria",
        message: `O consultor ${consultantData?.name} (${consultantData?.code}) solicitou vínculo com sua clínica.`,
        claim_id: claimRef.id,
        read: false,
        created_at: FieldValue.serverTimestamp(),
      });
    } catch (notifError) {
      console.warn("Erro ao criar notificação:", notifError);
    }

    return NextResponse.json({
      success: true,
      message: "Solicitação de vínculo enviada com sucesso",
      data: {
        id: claimRef.id,
        ...claimData,
      },
    });
  } catch (error: any) {
    console.error("Erro ao criar reivindicação:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao criar reivindicação" },
      { status: 500 }
    );
  }
}
