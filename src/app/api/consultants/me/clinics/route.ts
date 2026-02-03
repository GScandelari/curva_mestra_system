/**
 * API Route: Clínicas do consultor logado
 * GET - Listar clínicas vinculadas ao consultor autenticado
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

/**
 * GET - Listar clínicas do consultor logado
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

    // Verificar se é consultor
    if (!decodedToken.is_consultant || !decodedToken.consultant_id) {
      return NextResponse.json({ error: "Acesso restrito a consultores" }, { status: 403 });
    }

    const consultantId = decodedToken.consultant_id;

    // Buscar consultor
    const consultantDoc = await adminDb.collection("consultants").doc(consultantId).get();

    if (!consultantDoc.exists) {
      return NextResponse.json({ error: "Consultor não encontrado" }, { status: 404 });
    }

    const consultantData = consultantDoc.data();
    const authorizedTenants = consultantData?.authorized_tenants || [];

    if (authorizedTenants.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Buscar dados das clínicas
    const clinics = [];
    for (const tenantId of authorizedTenants) {
      const tenantDoc = await adminDb.collection("tenants").doc(tenantId).get();
      if (tenantDoc.exists) {
        const tenantData = tenantDoc.data();
        clinics.push({
          id: tenantDoc.id,
          name: tenantData?.name,
          document_type: tenantData?.document_type,
          document_number: tenantData?.document_number,
          email: tenantData?.email,
          phone: tenantData?.phone,
          active: tenantData?.active,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: clinics,
    });
  } catch (error: any) {
    console.error("Erro ao buscar clínicas do consultor:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao buscar clínicas" },
      { status: 500 }
    );
  }
}
