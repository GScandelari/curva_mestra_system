/**
 * API Route: Buscar clínicas por documento (CNPJ/CPF)
 * GET - Buscar clínica para o consultor reivindicar
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

/**
 * Limpa documento (remove formatação)
 */
function cleanDocument(doc: string): string {
  return doc.replace(/\D/g, "");
}

/**
 * GET - Buscar clínicas por documento
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

    // Apenas consultores e system_admin podem buscar
    if (!decodedToken.is_consultant && !decodedToken.is_system_admin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const document = searchParams.get("document");

    if (!document) {
      return NextResponse.json(
        { error: "Parâmetro 'document' é obrigatório" },
        { status: 400 }
      );
    }

    const cleanDoc = cleanDocument(document);

    if (cleanDoc.length < 11) {
      return NextResponse.json(
        { error: "Documento deve ter pelo menos 11 dígitos (CPF)" },
        { status: 400 }
      );
    }

    // Buscar por documento exato
    const snapshot = await adminDb
      .collection("tenants")
      .where("document_number", "==", cleanDoc)
      .where("active", "==", true)
      .get();

    const tenants = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        document_type: data.document_type,
        document_number: data.document_number,
        email: data.email,
        consultant_id: data.consultant_id || null,
        consultant_name: data.consultant_name || null,
      };
    });

    return NextResponse.json({
      success: true,
      data: tenants,
    });
  } catch (error: any) {
    console.error("Erro ao buscar clínicas:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao buscar clínicas" },
      { status: 500 }
    );
  }
}
